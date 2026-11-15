package cl.licitawatch.usuarios.bff;

import jakarta.validation.constraints.*;

/** Datos de entrada que el BFF valida antes de pasarlos a la capa BS (las respuestas vienen armadas desde la BS). */
public final class Dto {
    private Dto() {}
    public record Login(@NotBlank String email, @NotBlank String password) {}
    public record Recuperar(@NotBlank String email) {}
    public record Login2fa(@NotBlank String tokenTemporal, @NotBlank(message = "Ingresa el código") String codigo) {}
    public record Codigo2fa(@NotBlank(message = "Ingresa el código de 6 dígitos") String codigo) {}
    public record Desactivar2fa(@NotBlank(message = "Ingresa tu contraseña") String password, @NotBlank(message = "Ingresa un código") String codigo) {}
    public record CambioPassword(@NotBlank String actual, @NotBlank String nueva, boolean cerrarOtras) {}
    public record Restablecer(@NotBlank String token, @NotBlank String password) {}
    public record Verificar(@NotBlank String token) {}
    public record Estado(boolean activo) {}
    public record Foto(@NotBlank String foto) {}

    public record Registro(
            @NotBlank @Email String email, @NotBlank String password, @NotBlank String razonSocial,
            @NotBlank String rutEmpresa, @NotBlank String rutPersona, @NotBlank String nombreContacto,
            @NotBlank @Email String emailContacto, String telefono, @NotNull Integer rubroId, @NotNull Integer ciudadId,
            Integer tamanoEmpresaId, String descripcionEmpresa, String sitioWeb, String giro, boolean siiValidado,
            @AssertTrue(message = "Debes aceptar los Términos y Condiciones y la Política de Privacidad de LicitaWatch") boolean aceptaTerminos,
            String versionTerminos, String versionPolitica) {}

    public record PerfilEdicion(String razonSocial, String giro, Integer rubroId, Integer tamanoEmpresaId, Integer ciudadId, String nombreContacto,
                                String emailContacto, String telefono, String sitioWeb, String descripcionEmpresa) {}
}
