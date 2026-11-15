package cl.licitawatch.usuarios.bs;

import cl.licitawatch.common.InternalClient;
import cl.licitawatch.common.JwtService;
import cl.licitawatch.usuarios.bs.Dto.SesionActivaDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sesiones de los usuarios (tabla sesion_usuario): se registra una por cada inicio de sesión con el jti del JWT, el dispositivo y el navegador
 * (derivados del User-Agent) y la IP. Cada BFF consulta si siguen vigentes (con caché de 30 s) y el usuario puede cerrarlas.
 */
@Service
public class SesionService {
    private static final Logger log = LoggerFactory.getLogger(SesionService.class);
    public record SesionFila(Long id, Long usuarioId, String tokenId, String dispositivo, String navegador, String ip, Instant creadaAt, Instant ultimoUsoAt,
                             Instant expiraAt, Instant revocadaAt) {}
    private final InternalClient bd; private final JwtService jwt; private final String url;

    public SesionService(InternalClient bd, JwtService jwt, @Value("${lw.urls.bd}") String url) { this.bd = bd; this.jwt = jwt; this.url = url; }

    /** Registra la sesión y devuelve su identificador (jti) para emitir el JWT. */
    public String registrar(long usuarioId, String userAgent, String ip) {
        String tokenId = UUID.randomUUID().toString().replace("-", "");
        Map<String, Object> b = new HashMap<>();
        b.put("usuarioId", usuarioId); b.put("tokenId", tokenId); b.put("dispositivo", dispositivo(userAgent)); b.put("navegador", navegador(userAgent));
        b.put("ip", ip == null ? null : ip.length() > 45 ? ip.substring(0, 45) : ip);
        b.put("expiraAt", Instant.now().plus(jwt.horas(), ChronoUnit.HOURS));
        bd.post(url + "/bd/sesiones", b, SesionFila.class);
        return tokenId;
    }

    public boolean vigente(String tokenId) {
        return Boolean.TRUE.equals(bd.post(url + "/bd/sesiones/token/" + InternalClient.q(tokenId) + "/vigente", Map.of(), Map.class).get("vigente"));
    }

    /** Sesiones abiertas del usuario; actual = la de este dispositivo (tokenActual). La IP se entrega sin el último octeto. */
    public List<SesionActivaDto> listar(long usuarioId, String tokenActual) {
        return List.of(bd.get(url + "/bd/sesiones?usuarioId=" + usuarioId, SesionFila[].class)).stream()
                .map(s -> new SesionActivaDto(s.id(), s.dispositivo(), s.navegador(), ipParcial(s.ip()), s.creadaAt(), s.ultimoUsoAt(), s.tokenId().equals(tokenActual)))
                .toList();
    }

    public void cerrar(long usuarioId, long id) { bd.put(url + "/bd/sesiones/" + id + "/revocar?usuarioId=" + usuarioId, Map.of(), SesionFila.class); }
    public void cerrarToken(String tokenId) { if (tokenId != null) bd.put(url + "/bd/sesiones/token/" + InternalClient.q(tokenId) + "/revocar", Map.of(), Void.class); }

    /** Cierra todas las sesiones del usuario menos la actual (exceptoTokenId null = todas). Devuelve cuántas cerró. */
    public int cerrarOtras(long usuarioId, String exceptoTokenId) {
        Map<String, Object> b = new HashMap<>();
        b.put("usuarioId", usuarioId); b.put("exceptoTokenId", exceptoTokenId);
        Object n = bd.post(url + "/bd/sesiones/revocar", b, Map.class).get("cerradas");
        return n instanceof Number x ? x.intValue() : 0;
    }

    /** Limpieza diaria (3:30): borra las sesiones vencidas o cerradas hace más de una semana. */
    @Scheduled(cron = "0 30 3 * * *")
    public void limpiar() {
        try { bd.delete(url + "/bd/sesiones/vencidas"); }
        catch (Exception e) { log.warn("No se pudo limpiar las sesiones vencidas: {}", e.getMessage()); }
    }

    // ---------- User-Agent e IP ----------
    static String navegador(String ua) {
        if (ua == null || ua.isBlank()) return "Navegador desconocido";
        if (ua.contains("Edg/")) return "Edge";
        if (ua.contains("OPR/") || ua.contains("Opera")) return "Opera";
        if (ua.contains("SamsungBrowser/")) return "Samsung Internet";
        if (ua.contains("Firefox/") || ua.contains("FxiOS/")) return "Firefox";
        if (ua.contains("Chrome/") || ua.contains("CriOS/")) return "Chrome";
        if (ua.contains("Safari/")) return "Safari";
        return "Navegador desconocido";
    }

    static String dispositivo(String ua) {
        if (ua == null || ua.isBlank()) return "Dispositivo desconocido";
        if (ua.contains("iPad")) return "iPad · Tablet";
        if (ua.contains("iPhone")) return "iPhone · Celular";
        if (ua.contains("Android")) return "Android · " + (ua.contains("Mobile") ? "Celular" : "Tablet");
        if (ua.contains("Windows")) return "Windows · Computador";
        if (ua.contains("Mac OS X") || ua.contains("Macintosh")) return "macOS · Computador";
        if (ua.contains("CrOS")) return "ChromeOS · Computador";
        if (ua.contains("Linux")) return "Linux · Computador";
        return "Dispositivo desconocido";
    }

    /** Oculta el último octeto (IPv4) o los últimos grupos (IPv6): 190.22.15.*** */
    static String ipParcial(String ip) {
        if (ip == null || ip.isBlank()) return "IP desconocida";
        int i = ip.lastIndexOf('.');
        if (i > 0 && !ip.contains(":")) return ip.substring(0, i) + ".***";
        String[] g = ip.split(":");
        return g.length > 3 ? g[0] + ":" + g[1] + ":" + g[2] + ":****" : ip;
    }
}
