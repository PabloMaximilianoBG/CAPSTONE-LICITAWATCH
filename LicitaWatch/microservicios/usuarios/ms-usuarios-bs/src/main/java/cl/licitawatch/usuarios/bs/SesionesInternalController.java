package cl.licitawatch.usuarios.bs;

import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Servicio a servicio (X-Internal-Key): los BFF preguntan si una sesión sigue vigente (lo guardan 30 s en caché). */
@RestController
@RequestMapping("/internal/sesiones")
public class SesionesInternalController {
    private final SesionService sesiones;
    public SesionesInternalController(SesionService sesiones) { this.sesiones = sesiones; }

    @GetMapping("/{tokenId}/vigente")
    public Map<String, Boolean> vigente(@PathVariable String tokenId) { return Map.of("vigente", sesiones.vigente(tokenId)); }
}
