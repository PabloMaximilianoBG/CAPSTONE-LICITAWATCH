package cl.licitawatch.usuarios.bs.dosfactores;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifra el secreto TOTP antes de guardarlo (AES-256-GCM, IV aleatorio de 12 bytes). La clave sale de LW_TOTP_KEY
 * (Base64 de 32 bytes); si no está definida se usa una clave SOLO PARA DESARROLLO (ver correo.env.example).
 * Formato guardado: "v1:" + Base64(IV || texto cifrado con su etiqueta).
 */
@Component
public class CifradoTotp {
    private static final Logger log = LoggerFactory.getLogger(CifradoTotp.class);
    static final String CLAVE_DESARROLLO = "licitawatch-solo-desarrollo-cambiar-en-produccion";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKey clave;

    public CifradoTotp(@Value("${lw.totp.key:}") String claveConfig) {
        if (claveConfig == null || claveConfig.isBlank()) {
            log.warn("LW_TOTP_KEY no está definida: se usa la clave de desarrollo para cifrar los secretos 2FA. No la uses en producción.");
            claveConfig = CLAVE_DESARROLLO;
        }
        this.clave = new SecretKeySpec(derivar(claveConfig), "AES");
    }

    /** Base64 de 32 bytes se usa tal cual; cualquier otro texto se convierte en 32 bytes con SHA-256. */
    private static byte[] derivar(String c) {
        try {
            byte[] b = Base64.getDecoder().decode(c.trim());
            if (b.length == 32) return b;
        } catch (IllegalArgumentException ignorada) { /* no es Base64: se deriva */ }
        try { return MessageDigest.getInstance("SHA-256").digest(c.getBytes(StandardCharsets.UTF_8)); }
        catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
    }

    public String cifrar(String texto) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, clave, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (GeneralSecurityException e) { throw new IllegalStateException("No se pudo cifrar el secreto 2FA", e); }
    }

    public String descifrar(String guardado) {
        try {
            byte[] todo = Base64.getDecoder().decode(guardado.substring(3));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, clave, new GCMParameterSpec(128, todo, 0, 12));
            return new String(c.doFinal(todo, 12, todo.length - 12), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | RuntimeException e) {
            // Clave LW_TOTP_KEY distinta de la usada al activar: la 2FA de esa cuenta no se puede verificar.
            throw new IllegalStateException("No se pudo descifrar el secreto 2FA (¿cambió LW_TOTP_KEY?)", e);
        }
    }
}
