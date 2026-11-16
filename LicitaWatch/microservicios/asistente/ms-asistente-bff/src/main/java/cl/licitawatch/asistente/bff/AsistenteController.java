package cl.licitawatch.asistente.bff;

import cl.licitawatch.common.Auth;
import cl.licitawatch.common.InternalClient;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

/** BFF de LicitAsist: solo Pymes (el plan Premium lo valida la capa BS); delega en la capa BS. */
@RestController
public class AsistenteController {
    public record Pregunta(String texto) {}
    public record Redactar(@NotNull Long licitacionId) {}
    public record Revisar(@NotNull Long licitacionId, @NotBlank(message = "Escribe tu mensaje para que LicitAsist lo revise") String mensaje) {}
    private final InternalClient bs; private final String urlBs;
    public AsistenteController(InternalClient bs, @Value("${lw.urls.bs}") String urlBs) { this.bs = bs; this.urlBs = urlBs; }

    @PostMapping("/api/asistente/preguntar")
    public JsonNode preguntar(HttpServletRequest r, @RequestBody Pregunta b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/preguntar", b, JsonNode.class); }

    /** Borrador del mensaje de postulación (Premium; la BS responde 403 si la Pyme es Estándar). */
    @PostMapping("/api/asistente/redactar-postulacion")
    public JsonNode redactar(HttpServletRequest r, @Valid @RequestBody Redactar b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/redactar-postulacion", b, JsonNode.class); }

    /** ¿Me conviene postular? (Premium; la BS responde 403 si la Pyme es Estándar). */
    @PostMapping("/api/asistente/analizar-licitacion")
    public JsonNode analizar(HttpServletRequest r, @Valid @RequestBody Redactar b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/analizar-licitacion", b, JsonNode.class); }
    /** Mi plan del mes: en qué licitaciones usar las postulaciones que quedan (Premium). */
    @PostMapping("/api/asistente/plan-del-mes")
    public JsonNode planDelMes(HttpServletRequest r) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/plan-del-mes", java.util.Map.of(), JsonNode.class); }
    /** Revisa mi mensaje: puntaje, fortalezas, mejoras y versión mejorada (Premium). */
    @PostMapping("/api/asistente/revisar-mensaje")
    public JsonNode revisar(HttpServletRequest r, @Valid @RequestBody Revisar b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/revisar-mensaje", b, JsonNode.class); }
}
