package cl.licitawatch.usuarios.bs.dosfactores;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;

/**
 * Códigos TOTP (RFC 6238, compatibles con Google Authenticator): HMAC-SHA1, 6 dígitos, pasos de 30 s.
 * Se acepta el paso actual y ±1 (tolerancia de 30 s por diferencias de reloj). Sin librerías: solo javax.crypto.
 */
public final class Totp {
    private Totp() {}
    public static final int PASO_SEGUNDOS = 30, DIGITOS = 6, TOLERANCIA = 1;
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Secreto nuevo de 160 bits en Base32 (32 caracteres), como lo recomienda el RFC 4226. */
    public static String nuevoSecreto() {
        byte[] b = new byte[20];
        RANDOM.nextBytes(b);
        return base32(b);
    }

    /** ¿El código corresponde al secreto en el paso actual o en uno vecino? Comparación en tiempo constante. */
    public static boolean verificar(String secretoBase32, String codigo, Instant ahora) {
        if (codigo == null || !codigo.matches("\\d{" + DIGITOS + "}")) return false;
        byte[] clave = desdeBase32(secretoBase32);
        long paso = ahora.getEpochSecond() / PASO_SEGUNDOS;
        boolean ok = false;
        for (int d = -TOLERANCIA; d <= TOLERANCIA; d++)
            ok |= MessageDigest.isEqual(codigo(clave, paso + d).getBytes(), codigo.getBytes());
        return ok;
    }

    /** Código de 6 dígitos de un paso de tiempo (HOTP del RFC 4226 con contador = paso). */
    static String codigo(byte[] clave, long paso) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(clave, "HmacSHA1"));
            byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(paso).array());
            int o = h[h.length - 1] & 0x0f;
            int bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
            return String.format("%0" + DIGITOS + "d", bin % (int) Math.pow(10, DIGITOS));
        } catch (GeneralSecurityException e) { throw new IllegalStateException("HmacSHA1 no disponible", e); }
    }

    /** otpauth://totp/LicitaWatch:<email>?secret=...&issuer=LicitaWatch (lo que lee la app al escanear el QR). */
    public static String uri(String email, String secretoBase32) {
        String cuenta = "LicitaWatch:" + java.net.URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        return "otpauth://totp/" + cuenta + "?secret=" + secretoBase32 + "&issuer=LicitaWatch&algorithm=SHA1&digits=" + DIGITOS + "&period=" + PASO_SEGUNDOS;
    }

    static String base32(byte[] datos) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bits = 0;
        for (byte b : datos) {
            buffer = (buffer << 8) | (b & 0xff); bits += 8;
            while (bits >= 5) { sb.append(BASE32.charAt((buffer >> (bits - 5)) & 31)); bits -= 5; }
        }
        if (bits > 0) sb.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        return sb.toString();
    }

    static byte[] desdeBase32(String s) {
        String limpio = s.replace(" ", "").replace("=", "").toUpperCase();
        ByteBuffer out = ByteBuffer.allocate(limpio.length() * 5 / 8);
        int buffer = 0, bits = 0;
        for (char c : limpio.toCharArray()) {
            int v = BASE32.indexOf(c);
            if (v < 0) throw new IllegalArgumentException("Secreto Base32 inválido");
            buffer = (buffer << 5) | v; bits += 5;
            if (bits >= 8) { out.put((byte) (buffer >> (bits - 8))); bits -= 8; }
        }
        return java.util.Arrays.copyOf(out.array(), out.position());
    }
}
