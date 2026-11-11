package cl.licitawatch.usuarios.bs;

import jakarta.validation.constraints.*;
import java.time.Instant;

/** Contratos JSON de la capa BS; el BFF los entrega tal cual al front (coinciden con src/api/types.ts). */
public final class Dto {
    private Dto() {}
    public record Login(@NotBlank String email, @NotBlank String password) {}
    public record Recuperar(@NotBlank String email) {}
    public record CambioPassword(@NotBlank String actual, @NotBlank String nueva) {}
    /**
     * Configuración > Seguridad: passwordActualizadaAt null = sin cambios desde el registro; plan solo para Pymes (Estándar o Premium);
     * reenvioDisponibleEn = segundos que faltan para poder reenviar el correo de verificación (0 = ya se puede).
     */
    public record SeguridadDto(String email, Instant passwordActualizadaAt, boolean emailVerificado, boolean activo, String plan, Instant miembroDesde, long reenvioDisponibleEn) {}
    public record Restablecer(@NotBlank String token, @NotBlank String password) {}
    public record Verificar(@NotBlank String token) {}
    /** Respuesta del registro: la cuenta queda sin verificar y no se inicia sesión. */
    public record RegistroOk(String email, String mensaje) {}
    public record Estado(boolean activo) {}

    public record Registro(
            @NotBlank @Email String email, @NotBlank String password, @NotBlank String razonSocial,
            @NotBlank String rutEmpresa, @NotBlank String rutPersona, @NotBlank String nombreContacto,
            @NotBlank @Email String emailContacto, String telefono, @NotNull Integer rubroId, @NotNull Integer ciudadId,
            Integer tamanoEmpresaId, String descripcionEmpresa, String sitioWeb, String giro, boolean siiValidado,
            boolean aceptaTerminos, String versionTerminos, String versionPolitica) {}

    public record PerfilEdicion(String razonSocial, String giro, Integer rubroId, Integer tamanoEmpresaId, Integer ciudadId, String nombreContacto,
                                String emailContacto, String telefono, String sitioWeb, String descripcionEmpresa) {}

    public record UsuarioDto(Long id, String email, String rol, boolean activo, boolean emailVerificado, Instant createdAt, Instant ultimoLogin, String foto,
                             boolean aceptaTerminos, Instant terminosAceptadosAt, String versionTerminos, String versionPolitica) {}
    public record Foto(@NotBlank String foto) {}
    public record PerfilDto(Long usuarioId, String razonSocial, String rutEmpresa, String rutPersona, String nombreContacto, String emailContacto,
                            String telefono, Integer rubroId, Integer ciudadId, Integer tamanoEmpresaId, String descripcionEmpresa, String sitioWeb,
                            String giro, boolean siiValidado, Instant updatedAt) {}
    public record SesionDto(String token, UsuarioDto usuario, PerfilDto perfil) {}
    public record Disponible(boolean disponible) {}
    public record CatalogoDto(Integer id, String nombre) {}
    public record CiudadDto(Integer id, String nombre, Integer regionId) {}
    public record UsuarioAdmin(UsuarioDto usuario, String nombre, String rutEmpresa, String plan) {}
}
