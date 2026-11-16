package cl.licitawatch.asistente.bs;

import cl.licitawatch.asistente.bs.AsistenteService.Borrador;
import cl.licitawatch.asistente.bs.AsistenteService.Respuesta;
import cl.licitawatch.common.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

/** Capa BS de LicitAsist: la llama el BFF con la sesión en cabeceras. */
@RestController
public class AsistenteBsController {
    public record Pregunta(String texto) {}
    public record Redactar(long licitacionId) {}
    public record Revisar(long licitacionId, String mensaje) {}
    private final AsistenteService svc; private final AnalisisService analisis;
    public AsistenteBsController(AsistenteService svc, AnalisisService analisis) { this.svc = svc; this.analisis = analisis; }

    @PostMapping("/bs/asistente/preguntar")
    public Respuesta preguntar(HttpServletRequest r, @RequestBody Pregunta b) { return svc.preguntar(Auth.sesion(r).usuarioId(), b.texto()); }

    @PostMapping("/bs/asistente/redactar-postulacion")
    public Borrador redactar(HttpServletRequest r, @RequestBody Redactar b) { return svc.redactarPostulacion(Auth.sesion(r).usuarioId(), b.licitacionId()); }

    // LicitAsist razona por la Pyme (Premium): ¿me conviene postular?, mi plan del mes y revisa mi mensaje.
    @PostMapping("/bs/asistente/analizar-licitacion")
    public AnalisisService.AnalisisLicitacion analizar(HttpServletRequest r, @RequestBody Redactar b) { return analisis.analizar(Auth.sesion(r).usuarioId(), b.licitacionId()); }
    @PostMapping("/bs/asistente/plan-del-mes")
    public AnalisisService.PlanDelMes planDelMes(HttpServletRequest r) { return analisis.planDelMes(Auth.sesion(r).usuarioId()); }
    @PostMapping("/bs/asistente/revisar-mensaje")
    public AnalisisService.RevisionMensaje revisar(HttpServletRequest r, @RequestBody Revisar b) { return analisis.revisarMensaje(Auth.sesion(r).usuarioId(), b.licitacionId(), b.mensaje()); }
}
