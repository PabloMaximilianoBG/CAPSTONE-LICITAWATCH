package cl.licitawatch.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** Emite y valida los JWT. Todos los microservicios comparten el mismo secreto (lw.jwt.secret). */
@Component
public class JwtService {
    private final SecretKey key;
    private final long horas;

    public JwtService(@Value("${lw.jwt.secret}") String secret, @Value("${lw.jwt.horas:12}") long horas) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.horas = horas;
    }

    /** Token de sesión; tokenId (jti) identifica la sesión registrada en sesion_usuario para poder cerrarla. */
    public String emitir(long usuarioId, String rol, String tokenId) {
        Date ahora = new Date();
        return Jwts.builder().id(tokenId).subject(String.valueOf(usuarioId)).claim("rol", rol)
                .issuedAt(ahora).expiration(new Date(ahora.getTime() + horas * 3_600_000L))
                .signWith(key).compact();
    }

    /** Token de un solo propósito para restablecer contraseña (rol RESET: no sirve como sesión). Vence en 1 hora. */
    public String emitirReset(long usuarioId) {
        Date ahora = new Date();
        return Jwts.builder().subject(String.valueOf(usuarioId)).claim("rol", "RESET")
                .issuedAt(ahora).expiration(new Date(ahora.getTime() + 3_600_000L)).signWith(key).compact();
    }

    /** Devuelve el id de usuario si el token es de recuperación y está vigente; si no, null. */
    public Long validarReset(String token) {
        try { Claims c = validar(token); return "RESET".equals(c.get("rol", String.class)) ? Long.parseLong(c.getSubject()) : null; } catch (Exception e) { return null; }
    }

    /** Token de un solo propósito para verificar el correo al registrarse (rol VERIFICAR: no sirve como sesión). Vence en 24 horas. */
    public String emitirVerificacion(long usuarioId) {
        Date ahora = new Date();
        return Jwts.builder().subject(String.valueOf(usuarioId)).claim("rol", "VERIFICAR")
                .issuedAt(ahora).expiration(new Date(ahora.getTime() + 24 * 3_600_000L)).signWith(key).compact();
    }

    /** Devuelve el id de usuario si el token es de verificación y está vigente; si no, null. */
    public Long validarVerificacion(String token) {
        try { Claims c = validar(token); return "VERIFICAR".equals(c.get("rol", String.class)) ? Long.parseLong(c.getSubject()) : null; } catch (Exception e) { return null; }
    }

    /** Token temporal del login con 2FA (rol 2FA: no sirve como sesión). Vence en 5 minutos: solo permite enviar el código. */
    public String emitirDosPasos(long usuarioId) {
        Date ahora = new Date();
        return Jwts.builder().subject(String.valueOf(usuarioId)).claim("rol", "2FA")
                .issuedAt(ahora).expiration(new Date(ahora.getTime() + 5 * 60_000L)).signWith(key).compact();
    }
    /** Devuelve el id de usuario si el token es del paso 2FA y está vigente; si no, null. */
    public Long validarDosPasos(String token) {
        try { Claims c = validar(token); return "2FA".equals(c.get("rol", String.class)) ? Long.parseLong(c.getSubject()) : null; } catch (Exception e) { return null; }
    }

    /** Horas de vigencia de un token de sesión (lw.jwt.horas). */
    public long horas() { return horas; }

    public Claims validar(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
