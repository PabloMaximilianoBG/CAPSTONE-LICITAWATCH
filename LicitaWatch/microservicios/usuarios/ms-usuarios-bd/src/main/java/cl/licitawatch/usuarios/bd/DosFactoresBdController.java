package cl.licitawatch.usuarios.bd;

import cl.licitawatch.common.ApiException;
import cl.licitawatch.usuarios.bd.Repos.CodigoRecuperacionRepo;
import cl.licitawatch.usuarios.bd.Repos.UsuarioRepo;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Capa BD de la autenticación de dos factores: estado TOTP del usuario y sus códigos de recuperación.
 * Solo la llama la capa BS de Usuarios (X-Internal-Key); el secreto llega y sale cifrado, y los códigos solo como hash.
 */
@RestController
@RequestMapping("/bd/usuarios/{id}")
public class DosFactoresBdController {
    public record TotpFila(boolean activo, String secretoCifrado, Instant activadoAt, int intentosFallidos, Instant bloqueadoHasta, long codigosDisponibles) {}
    /** Cambios del estado TOTP (los null no se tocan; borrarSecreto = dejar el secreto en null). */
    public record CambiosTotp(Boolean activo, String secretoCifrado, Boolean borrarSecreto, Instant activadoAt, Integer intentosFallidos, Instant bloqueadoHasta,
                              Boolean desbloquear) {}
    public record CodigoFila(Long id, String codigoHash) {}

    private final UsuarioRepo usuarios; private final CodigoRecuperacionRepo codigos;
    public DosFactoresBdController(UsuarioRepo usuarios, CodigoRecuperacionRepo codigos) { this.usuarios = usuarios; this.codigos = codigos; }

    private Usuario usuario(long id) { return usuarios.findById(id).orElseThrow(() -> ApiException.noEncontrado("Usuario no encontrado")); }
    private TotpFila fila(Usuario u) {
        return new TotpFila(u.isTotpActivo(), u.getTotpSecretoCifrado(), u.getTotpActivadoAt(), u.getTotpIntentosFallidos(), u.getTotpBloqueadoHasta(),
                codigos.countByUsuarioIdAndUsadoAtIsNull(u.getId()));
    }

    @GetMapping("/totp") public TotpFila totp(@PathVariable long id) { return fila(usuario(id)); }

    @PatchMapping("/totp") @Transactional
    public TotpFila cambiar(@PathVariable long id, @RequestBody CambiosTotp c) {
        Usuario u = usuario(id);
        if (c.activo() != null) u.setTotpActivo(c.activo());
        if (c.secretoCifrado() != null) u.setTotpSecretoCifrado(c.secretoCifrado());
        if (Boolean.TRUE.equals(c.borrarSecreto())) { u.setTotpSecretoCifrado(null); u.setTotpActivadoAt(null); }
        if (c.activadoAt() != null) u.setTotpActivadoAt(c.activadoAt());
        if (c.intentosFallidos() != null) u.setTotpIntentosFallidos(c.intentosFallidos());
        if (c.bloqueadoHasta() != null) u.setTotpBloqueadoHasta(c.bloqueadoHasta());
        if (Boolean.TRUE.equals(c.desbloquear())) u.setTotpBloqueadoHasta(null);
        return fila(u);
    }

    /** Secreto pendiente: se guarda solo si no hay uno; devuelve el que quedó guardado (el ganador, si hubo dos a la vez). */
    @PutMapping("/totp/pendiente") @Transactional
    public TotpFila fijarPendiente(@PathVariable long id, @RequestBody Map<String, String> b) {
        usuarios.fijarSecretoSiVacio(id, b.get("secretoCifrado"));
        return fila(usuario(id));
    }

    /** Reemplaza todos los códigos de recuperación por los nuevos hashes (al activar la 2FA). Lista vacía = borrarlos (al desactivarla). */
    @PutMapping("/codigos-recuperacion") @Transactional
    public Map<String, Integer> reemplazar(@PathVariable long id, @RequestBody List<String> hashes) {
        usuario(id);
        codigos.deleteByUsuarioId(id); codigos.flush();
        for (String h : hashes) { CodigoRecuperacion c = new CodigoRecuperacion(); c.setUsuarioId(id); c.setCodigoHash(h); codigos.save(c); }
        return Map.of("guardados", hashes.size());
    }

    /** Códigos disponibles (sin usar), solo como hash, para que la BS compare con BCrypt. */
    @GetMapping("/codigos-recuperacion")
    public List<CodigoFila> disponibles(@PathVariable long id) {
        return codigos.findByUsuarioIdAndUsadoAtIsNull(id).stream().map(c -> new CodigoFila(c.getId(), c.getCodigoHash())).toList();
    }

    /** Marca un código como usado (un solo uso). 409 si ya se había usado (dos intentos a la vez). */
    @PutMapping("/codigos-recuperacion/{codigoId}/usar") @Transactional
    public void usar(@PathVariable long id, @PathVariable long codigoId) {
        CodigoRecuperacion c = codigos.findById(codigoId).filter(x -> x.getUsuarioId().equals(id)).orElseThrow(() -> ApiException.noEncontrado("Código no encontrado"));
        if (c.getUsadoAt() != null) throw ApiException.conflicto("Ese código de recuperación ya se usó");
        c.setUsadoAt(Instant.now());
    }
}
