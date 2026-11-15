package cl.licitawatch.usuarios.bff;

import cl.licitawatch.common.Auth;
import cl.licitawatch.common.InternalClient;
import cl.licitawatch.usuarios.bff.Dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static cl.licitawatch.common.InternalClient.q;

/** BFF de autenticación, registro y perfil: valida el formato de los datos y la sesión, y delega en la capa BS. */
@RestController
public class AuthController {
    private final InternalClient bs; private final String urlBs;
    public AuthController(InternalClient bs, @Value("${lw.urls.bs}") String urlBs) { this.bs = bs; this.urlBs = urlBs; }

    private JsonNode get(String ruta) { return bs.get(urlBs + ruta, JsonNode.class); }
    private JsonNode post(String ruta, Object body) { return bs.post(urlBs + ruta, body, JsonNode.class); }

    /** Se agregan el navegador (User-Agent) y la IP de origen para registrar la sesión; la contraseña nunca se registra en logs. */
    @PostMapping("/api/auth/login")
    public JsonNode login(HttpServletRequest r, @Valid @RequestBody Login b) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("email", b.email()); body.put("password", b.password()); body.put("userAgent", r.getHeader("User-Agent")); body.put("ip", ipDe(r));
        return post("/bs/auth/login", body);
    }
    /** Segundo paso del login con 2FA (pública: aún no hay sesión, solo el token temporal de 5 minutos). */
    @PostMapping("/api/auth/login/2fa")
    public JsonNode login2fa(HttpServletRequest r, @Valid @RequestBody Login2fa b) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("tokenTemporal", b.tokenTemporal()); body.put("codigo", b.codigo()); body.put("userAgent", r.getHeader("User-Agent")); body.put("ip", ipDe(r));
        return post("/bs/auth/login/2fa", body);
    }
    // Autenticación de dos factores (opcional, cualquier rol con sesión)
    @PostMapping("/api/usuarios/2fa/iniciar") public JsonNode iniciar2fa(HttpServletRequest r) { Auth.sesion(r); return post("/bs/usuarios/2fa/iniciar", Map.of()); }
    @PostMapping("/api/usuarios/2fa/confirmar") public JsonNode confirmar2fa(HttpServletRequest r, @Valid @RequestBody Codigo2fa b) { Auth.sesion(r); return post("/bs/usuarios/2fa/confirmar", b); }
    @PostMapping("/api/usuarios/2fa/desactivar") public JsonNode desactivar2fa(HttpServletRequest r, @Valid @RequestBody Desactivar2fa b) { Auth.sesion(r); return post("/bs/usuarios/2fa/desactivar", b); }

    /** Cierra la sesión actual en el servidor (deja de servir aunque el token no haya vencido). */
    @PostMapping("/api/auth/logout") public Map<String, String> logout(HttpServletRequest r) { Auth.sesion(r); post("/bs/auth/logout", Map.of()); return Map.of("mensaje", "Sesión cerrada"); }

    /** IP del navegador: el gateway la deja en X-Forwarded-For (la primera de la lista); si no, la de la conexión. */
    private static String ipDe(HttpServletRequest r) {
        String xff = r.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String real = r.getHeader("X-Real-IP");
        return real != null && !real.isBlank() ? real.trim() : r.getRemoteAddr();
    }

    /** La capa BS arma la sesión; el token es el mismo que trajo la petición. */
    @GetMapping("/api/auth/me")
    public JsonNode me(HttpServletRequest r) {
        Auth.sesion(r);
        JsonNode s = get("/bs/auth/me");
        ((ObjectNode) s).put("token", r.getHeader("Authorization").substring(7));
        return s;
    }

    @PostMapping("/api/auth/recuperar")
    public Map<String, String> recuperar(@Valid @RequestBody Recuperar b) { post("/bs/auth/recuperar", b); return Map.of("mensaje", "Si el correo existe, enviamos un enlace de recuperación"); }

    @PostMapping("/api/auth/restablecer")
    public Map<String, String> restablecer(@Valid @RequestBody Restablecer b) { post("/bs/auth/restablecer", b); return Map.of("mensaje", "Contraseña actualizada"); }

    @PostMapping("/api/auth/verificar")
    public Map<String, String> verificar(@Valid @RequestBody Verificar b) { post("/bs/auth/verificar", b); return Map.of("mensaje", "Cuenta verificada"); }

    @PostMapping("/api/auth/reenviar-verificacion")
    public Map<String, String> reenviar(@Valid @RequestBody Recuperar b) { post("/bs/auth/reenviar-verificacion", b); return Map.of("mensaje", "Si la cuenta está pendiente de verificación, enviamos un nuevo enlace"); }

    @PostMapping("/api/usuarios/registro/licitador")
    public ResponseEntity<JsonNode> regLicitador(@Valid @RequestBody Registro b) { return ResponseEntity.status(HttpStatus.CREATED).body(post("/bs/usuarios/registro/LICITADOR", b)); }

    @PostMapping("/api/usuarios/registro/pyme")
    public ResponseEntity<JsonNode> regPyme(@Valid @RequestBody Registro b) { return ResponseEntity.status(HttpStatus.CREATED).body(post("/bs/usuarios/registro/PYME", b)); }

    @GetMapping("/api/usuarios/disponibilidad/email") public JsonNode email(@RequestParam String valor) { return get("/bs/usuarios/disponibilidad/email?valor=" + q(valor)); }
    @GetMapping("/api/usuarios/disponibilidad/rut") public JsonNode rut(@RequestParam String valor) { return get("/bs/usuarios/disponibilidad/rut?valor=" + q(valor)); }
    @GetMapping("/api/usuarios/disponibilidad/rut-persona") public JsonNode rutPersona(@RequestParam String valor) { return get("/bs/usuarios/disponibilidad/rut-persona?valor=" + q(valor)); }

    @GetMapping("/api/usuarios/alcance")
    public JsonNode alcance(HttpServletRequest r, @RequestParam int rubroId, @RequestParam(required = false) Integer regionId) {
        Auth.exigir(r, "LICITADOR"); return get("/bs/usuarios/alcance?rubroId=" + rubroId + (regionId == null ? "" : "&regionId=" + regionId));
    }
    @GetMapping("/api/usuarios/radar")
    public JsonNode radar(HttpServletRequest r, @RequestParam int rubroId, @RequestParam int regionId) {
        Auth.exigir(r, "LICITADOR"); return get("/bs/usuarios/radar?rubroId=" + rubroId + "&regionId=" + regionId);
    }
    // Configuración > Seguridad (Licitador y Pyme)
    @GetMapping("/api/usuarios/seguridad") public JsonNode seguridad(HttpServletRequest r) { Auth.exigir(r, "LICITADOR", "PYME"); return get("/bs/usuarios/seguridad"); }
    @PutMapping("/api/usuarios/password")
    public JsonNode password(HttpServletRequest r, @Valid @RequestBody CambioPassword b) { Auth.exigir(r, "LICITADOR", "PYME"); return bs.put(urlBs + "/bs/usuarios/password", b, JsonNode.class); }
    @GetMapping("/api/usuarios/sesiones") public JsonNode sesiones(HttpServletRequest r) { Auth.exigir(r, "LICITADOR", "PYME"); return get("/bs/usuarios/sesiones"); }
    @DeleteMapping("/api/usuarios/sesiones/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cerrarSesion(HttpServletRequest r, @PathVariable long id) { Auth.exigir(r, "LICITADOR", "PYME"); bs.delete(urlBs + "/bs/usuarios/sesiones/" + id); }
    @PostMapping("/api/usuarios/sesiones/cerrar-otras")
    public JsonNode cerrarOtras(HttpServletRequest r) { Auth.exigir(r, "LICITADOR", "PYME"); return post("/bs/usuarios/sesiones/cerrar-otras", Map.of()); }
    @PostMapping("/api/usuarios/verificacion/reenviar")
    public JsonNode reenviarVerificacion(HttpServletRequest r) { Auth.exigir(r, "LICITADOR", "PYME"); return post("/bs/usuarios/verificacion/reenviar", Map.of()); }
    @PutMapping("/api/usuarios/foto") public JsonNode foto(HttpServletRequest r, @Valid @RequestBody Foto b) { Auth.sesion(r); return bs.put(urlBs + "/bs/usuarios/foto", b, JsonNode.class); }
    @DeleteMapping("/api/usuarios/foto") public JsonNode quitarFoto(HttpServletRequest r) { Auth.sesion(r); return bs.reenviar(HttpMethod.DELETE, urlBs + "/bs/usuarios/foto", null); }

    @PutMapping("/api/usuarios/perfil")
    public JsonNode perfil(HttpServletRequest r, @RequestBody PerfilEdicion b) { Auth.sesion(r); return bs.put(urlBs + "/bs/usuarios/perfil", b, JsonNode.class); }
}
