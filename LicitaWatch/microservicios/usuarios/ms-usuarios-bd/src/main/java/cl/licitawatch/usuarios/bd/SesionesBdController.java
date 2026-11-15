package cl.licitawatch.usuarios.bd;

import cl.licitawatch.common.ApiException;
import cl.licitawatch.usuarios.bd.Repos.SesionUsuarioRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/** Capa BD de las sesiones (tabla sesion_usuario). Solo la llama la capa BS de Usuarios (X-Internal-Key). */
@RestController
@RequestMapping("/bd/sesiones")
public class SesionesBdController {
    public record SesionFila(Long id, Long usuarioId, String tokenId, String dispositivo, String navegador, String ip, Instant creadaAt, Instant ultimoUsoAt,
                             Instant expiraAt, Instant revocadaAt) {}
    public record NuevaSesion(Long usuarioId, String tokenId, String dispositivo, String navegador, String ip, Instant expiraAt) {}
    public record Revocar(Long usuarioId, String exceptoTokenId) {}
    /** Cada cuánto se actualiza ultimo_uso_at como máximo. */
    private static final Duration TOQUE = Duration.ofMinutes(5);
    /** Las sesiones cerradas o vencidas se guardan una semana antes de borrarlas. */
    private static final Duration RETENCION = Duration.ofDays(7);

    private final SesionUsuarioRepo sesiones;
    public SesionesBdController(SesionUsuarioRepo sesiones) { this.sesiones = sesiones; }

    private static SesionFila fila(SesionUsuario s) {
        return new SesionFila(s.getId(), s.getUsuarioId(), s.getTokenId(), s.getDispositivo(), s.getNavegador(), s.getIp(), s.getCreadaAt(), s.getUltimoUsoAt(),
                s.getExpiraAt(), s.getRevocadaAt());
    }

    @PostMapping @Transactional
    public SesionFila crear(@RequestBody NuevaSesion n) {
        SesionUsuario s = new SesionUsuario();
        s.setUsuarioId(n.usuarioId()); s.setTokenId(n.tokenId()); s.setDispositivo(n.dispositivo()); s.setNavegador(n.navegador()); s.setIp(n.ip()); s.setExpiraAt(n.expiraAt());
        return fila(sesiones.save(s));
    }

    /** Vigente = existe, no está cerrada y no venció. De paso actualiza su último uso (como mucho cada 5 minutos). */
    @PostMapping("/token/{tokenId}/vigente") @Transactional
    public Map<String, Boolean> vigente(@PathVariable String tokenId) {
        Instant ahora = Instant.now();
        boolean v = sesiones.findByTokenId(tokenId).filter(s -> s.getRevocadaAt() == null && s.getExpiraAt().isAfter(ahora)).isPresent();
        if (v) sesiones.tocar(tokenId, ahora, ahora.minus(TOQUE));
        return Map.of("vigente", v);
    }

    @GetMapping
    public List<SesionFila> deUsuario(@RequestParam long usuarioId) {
        return sesiones.findByUsuarioIdAndRevocadaAtIsNullAndExpiraAtAfterOrderByUltimoUsoAtDesc(usuarioId, Instant.now()).stream().map(SesionesBdController::fila).toList();
    }

    /** Cierra una sesión del usuario indicado (404 si no es suya o no existe). */
    @PutMapping("/{id}/revocar") @Transactional
    public SesionFila revocar(@PathVariable long id, @RequestParam long usuarioId) {
        SesionUsuario s = sesiones.findById(id).filter(x -> x.getUsuarioId().equals(usuarioId)).orElseThrow(() -> ApiException.noEncontrado("Sesión no encontrada"));
        if (s.getRevocadaAt() == null) s.setRevocadaAt(Instant.now());
        return fila(s);
    }

    /** Cierra la sesión de un token (logout). Si no existe, no hace nada. */
    @PutMapping("/token/{tokenId}/revocar") @Transactional
    public void revocarToken(@PathVariable String tokenId) {
        sesiones.findByTokenId(tokenId).filter(s -> s.getRevocadaAt() == null).ifPresent(s -> s.setRevocadaAt(Instant.now()));
    }

    /** Cierra todas las sesiones del usuario menos exceptoTokenId (null = todas). Devuelve cuántas cerró. */
    @PostMapping("/revocar") @Transactional
    public Map<String, Integer> revocarDe(@RequestBody Revocar r) {
        Instant ahora = Instant.now();
        return Map.of("cerradas", r.exceptoTokenId() == null ? sesiones.revocarTodas(r.usuarioId(), ahora) : sesiones.revocarOtras(r.usuarioId(), r.exceptoTokenId(), ahora));
    }

    /** Limpieza: borra las sesiones vencidas o cerradas hace más de una semana. */
    @DeleteMapping("/vencidas") @Transactional
    public Map<String, Integer> limpiar() {
        return Map.of("borradas", sesiones.borrarVencidas(Instant.now().minus(RETENCION).truncatedTo(ChronoUnit.SECONDS)));
    }
}
