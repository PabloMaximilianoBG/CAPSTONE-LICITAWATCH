package cl.licitawatch.usuarios.bs.dosfactores;

import cl.licitawatch.common.ApiException;
import cl.licitawatch.common.InternalClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Autenticación de dos factores (TOTP), opcional para todos los roles:
 * activar en 3 pasos (QR → confirmar con un código → 8 códigos de recuperación), verificar el código en el login y desactivar.
 * 5 códigos incorrectos seguidos bloquean la verificación 5 minutos. Ni el secreto ni los códigos se escriben en logs.
 */
@Service
public class DosFactoresService {
    public record TotpFila(boolean activo, String secretoCifrado, Instant activadoAt, int intentosFallidos, Instant bloqueadoHasta, long codigosDisponibles) {}
    record CodigoFila(Long id, String codigoHash) {}
    /** Paso 1 del asistente: QR de vinculación, clave manual y QR de las tiendas de Google Authenticator. */
    public record Configuracion2fa(String clave, String otpauthUri, String qr, String urlAndroid, String qrAndroid, String urlIos, String qrIos) {}

    static final int MAX_INTENTOS = 5, CODIGOS = 8;
    static final Duration BLOQUEO = Duration.ofMinutes(5);
    static final String URL_ANDROID = "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2";
    static final String URL_IOS = "https://apps.apple.com/app/google-authenticator/id388497605";
    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // sin 0/O ni 1/I/L para no confundirlos
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InternalClient bd; private final String url; private final CifradoTotp cifrado;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public DosFactoresService(InternalClient bd, @Value("${lw.urls.bd}") String url, CifradoTotp cifrado) { this.bd = bd; this.url = url; this.cifrado = cifrado; }

    public TotpFila estado(long usuarioId) { return bd.get(url + "/bd/usuarios/" + usuarioId + "/totp", TotpFila.class); }
    private void cambiar(long usuarioId, Map<String, Object> c) { bd.patch(url + "/bd/usuarios/" + usuarioId + "/totp", c, TotpFila.class); }

    /**
     * Paso 1: genera el secreto (pendiente hasta confirmar) y los QR. Si ya había una activación pendiente se reutiliza su secreto,
     * para que un QR ya escaneado siga sirviendo aunque se vuelva a abrir el asistente. Si ya está activa, 409.
     */
    public Configuracion2fa iniciar(long usuarioId, String email) {
        TotpFila t = estado(usuarioId);
        if (t.activo()) throw ApiException.conflicto("La autenticación de dos factores ya está activa");
        String secreto = null;
        if (t.secretoCifrado() != null) {
            try { secreto = cifrado.descifrar(t.secretoCifrado()); }
            catch (IllegalStateException e) { cambiar(usuarioId, Map.of("borrarSecreto", true)); }   // cambió LW_TOTP_KEY: se descarta y se genera otro
        }
        if (secreto == null) {
            // Guardado atómico: si llegan dos peticiones a la vez, ambas devuelven el mismo secreto (el que quedó en la BD).
            TotpFila f = bd.put(url + "/bd/usuarios/" + usuarioId + "/totp/pendiente", Map.of("secretoCifrado", cifrado.cifrar(Totp.nuevoSecreto())), TotpFila.class);
            secreto = cifrado.descifrar(f.secretoCifrado());
        }
        String uri = Totp.uri(email, secreto);
        return new Configuracion2fa(secreto.replaceAll("(.{4})(?!$)", "$1 "), uri, CodigoQr.png(uri, 240), URL_ANDROID, CodigoQr.png(URL_ANDROID, 140), URL_IOS, CodigoQr.png(URL_IOS, 140));
    }

    /** Paso 2: el código de la app confirma la vinculación; recién ahí queda activa. Paso 3: devuelve los 8 códigos de recuperación (única vez). */
    public List<String> confirmar(long usuarioId, String codigo) {
        TotpFila t = estado(usuarioId);
        if (t.activo()) throw ApiException.conflicto("La autenticación de dos factores ya está activa");
        if (t.secretoCifrado() == null) throw ApiException.invalido("Primero escanea el código QR (vuelve a empezar la activación)");
        exigirNoBloqueado(t);
        if (!Totp.verificar(cifrado.descifrar(t.secretoCifrado()), limpiarTotp(codigo), Instant.now())) fallo(usuarioId, t);
        List<String> codigos = new ArrayList<>(), hashes = new ArrayList<>();
        for (int i = 0; i < CODIGOS; i++) { String c = nuevoCodigo(); codigos.add(c); hashes.add(enc.encode(normalizar(c))); }
        bd.put(url + "/bd/usuarios/" + usuarioId + "/codigos-recuperacion", hashes, Map.class);
        Map<String, Object> c = new HashMap<>();
        c.put("activo", true); c.put("activadoAt", Instant.now()); c.put("intentosFallidos", 0); c.put("desbloquear", true);
        cambiar(usuarioId, c);
        return codigos;
    }

    /** Desactiva: la BS ya validó la contraseña; aquí se exige un código vigente (de la app o de recuperación). */
    public void desactivar(long usuarioId, String codigo) {
        TotpFila t = estado(usuarioId);
        if (!t.activo()) throw ApiException.invalido("La autenticación de dos factores no está activa");
        verificar(usuarioId, codigo);
        Map<String, Object> c = new HashMap<>();
        c.put("activo", false); c.put("borrarSecreto", true); c.put("intentosFallidos", 0); c.put("desbloquear", true);
        cambiar(usuarioId, c);
        bd.put(url + "/bd/usuarios/" + usuarioId + "/codigos-recuperacion", List.of(), Map.class);
    }

    /**
     * Verifica un código de la app (6 dígitos, ±30 s) o un código de recuperación (XXXX-XXXX, de un solo uso).
     * Si es incorrecto suma un intento; al 5.º se bloquea 5 minutos (429).
     */
    public void verificar(long usuarioId, String codigo) {
        TotpFila t = estado(usuarioId);
        exigirNoBloqueado(t);
        String totp = limpiarTotp(codigo);
        boolean ok;
        if (totp.matches("\\d{6}")) ok = t.secretoCifrado() != null && Totp.verificar(cifrado.descifrar(t.secretoCifrado()), totp, Instant.now());
        else ok = usarCodigoRecuperacion(usuarioId, codigo);
        if (!ok) fallo(usuarioId, t);
        if (t.intentosFallidos() > 0 || t.bloqueadoHasta() != null) {
            Map<String, Object> c = new HashMap<>(); c.put("intentosFallidos", 0); c.put("desbloquear", true); cambiar(usuarioId, c);
        }
    }

    private boolean usarCodigoRecuperacion(long usuarioId, String codigo) {
        String n = normalizar(codigo);
        if (n.length() != 8) return false;
        for (CodigoFila c : bd.get(url + "/bd/usuarios/" + usuarioId + "/codigos-recuperacion", CodigoFila[].class)) {
            if (enc.matches(n, c.codigoHash())) {
                try { bd.put(url + "/bd/usuarios/" + usuarioId + "/codigos-recuperacion/" + c.id() + "/usar", Map.of(), Void.class); return true; }
                catch (ApiException e) { return false; }   // otro intento lo usó al mismo tiempo
            }
        }
        return false;
    }

    private void exigirNoBloqueado(TotpFila t) {
        if (t.bloqueadoHasta() != null && t.bloqueadoHasta().isAfter(Instant.now())) {
            long min = Math.max(1, (Duration.between(Instant.now(), t.bloqueadoHasta()).getSeconds() + 59) / 60);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados códigos incorrectos. Intenta de nuevo en " + min + (min == 1 ? " minuto." : " minutos."));
        }
    }

    /** Suma el intento fallido (o bloquea al 5.º) y responde con el mensaje correspondiente. */
    private void fallo(long usuarioId, TotpFila t) {
        int intentos = t.intentosFallidos() + 1;
        Map<String, Object> c = new HashMap<>();
        if (intentos >= MAX_INTENTOS) {
            c.put("intentosFallidos", 0); c.put("bloqueadoHasta", Instant.now().plus(BLOQUEO));
            cambiar(usuarioId, c);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados códigos incorrectos. Por seguridad, espera 5 minutos e intenta de nuevo.");
        }
        c.put("intentosFallidos", intentos);
        cambiar(usuarioId, c);
        int quedan = MAX_INTENTOS - intentos;
        throw ApiException.invalido("Código incorrecto. Te queda" + (quedan == 1 ? " 1 intento" : "n " + quedan + " intentos") + " antes de un bloqueo de 5 minutos.");
    }

    private static String limpiarTotp(String c) { return c == null ? "" : c.replaceAll("\\s", ""); }
    private static String normalizar(String c) { return c == null ? "" : c.toUpperCase().replaceAll("[^A-Z0-9]", ""); }
    private static String nuevoCodigo() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) { if (i == 4) sb.append('-'); sb.append(ALFABETO.charAt(RANDOM.nextInt(ALFABETO.length()))); }
        return sb.toString();
    }
}
