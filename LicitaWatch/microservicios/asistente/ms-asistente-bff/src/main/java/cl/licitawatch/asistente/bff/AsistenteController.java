package cl.licitawatch.asistente.bff;

import cl.licitawatch.common.Auth;
import cl.licitawatch.common.InternalClient;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

/** BFF de LicitAsist: solo Pymes (el plan Premium lo valida la capa BS); delega en la capa BS. */
@RestController
public class AsistenteController {
    public record Pregunta(String texto) {}
    public record Redactar(@NotNull Long licitacionId) {}
    private final InternalClient bs; private final String urlBs;
    public AsistenteController(InternalClient bs, @Value("${lw.urls.bs}") String urlBs) { this.bs = bs; this.urlBs = urlBs; }

    @PostMapping("/api/asistente/preguntar")
    public JsonNode preguntar(HttpServletRequest r, @RequestBody Pregunta b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/preguntar", b, JsonNode.class); }

    /** Borrador del mensaje de postulación (Premium; la BS responde 403 si la Pyme es Estándar). */
    @PostMapping("/api/asistente/redactar-postulacion")
    public JsonNode redactar(HttpServletRequest r, @Valid @RequestBody Redactar b) { Auth.exigir(r, "PYME"); return bs.post(urlBs + "/bs/asistente/redactar-postulacion", b, JsonNode.class); }
}
