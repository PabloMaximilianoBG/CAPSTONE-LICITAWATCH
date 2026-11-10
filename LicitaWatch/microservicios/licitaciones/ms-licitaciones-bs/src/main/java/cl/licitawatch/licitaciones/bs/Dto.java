package cl.licitawatch.licitaciones.bs;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class Dto {
    private Dto() {}
    /**
     * contenido = data URL del archivo; solo viene al publicar o agregar (en las respuestas va null y se pide con /documento).
     * id = null para el documento principal (guardado en la licitación) y el id de documento_licitacion para los adicionales.
     */
    public record DocumentoDto(@NotBlank String nombre, String tipo, int tamanoKb, String contenido, Long id) {}
    public record ArchivoDto(String nombre, String tipo, String contenido) {}
    /** Documento que el Licitador pide a las Pymes; id = null al publicar. */
    public record DocumentoRequeridoDto(Long id, @NotBlank @Size(max = 160) String nombre, boolean obligatorio) {}
    /** Documento subido por la Pyme al postular (sin contenido; se pide aparte con /documentos/{docId}). */
    public record DocumentoPostulacionDto(Long id, Long requisitoId, String requisitoNombre, String nombre, String tipo, int tamanoKb, Instant fechaSubida) {}
    /** Archivo de la Pyme para un documento pedido: contenido = data URL (base64). */
    public record ArchivoPostulacion(@NotNull Long requisitoId, @NotBlank String nombre, @NotBlank String contenido) {}
    public record NuevaLicitacion(@NotBlank @Size(max = 160) String titulo, @NotBlank String descripcion, @NotNull Integer rubroId, @NotNull Integer regionId,
                                  Long presupuestoMin, Long presupuestoMax, Integer maxPostulantes, @NotNull @Min(1) @Max(120) Integer duracionMeses, String imagenUrl,
                                  List<DocumentoDto> documentos, @NotNull Instant fechaCierre, List<DocumentoRequeridoDto> documentosRequeridos) {}
    public record LicitacionDto(Long id, Long licitadorId, String licitadorNombre, String titulo, String descripcion, Integer rubroId, Integer regionId, Long presupuestoMin,
                                Long presupuestoMax, Integer maxPostulantes, Integer duracionMeses, String imagenUrl, List<DocumentoDto> documentos, Instant fechaCierre, String estado,
                                Instant createdAt, long postulantes, Long pymeAdjudicadaId, List<DocumentoRequeridoDto> documentosRequeridos) {}
    public record Postular(String mensaje, List<ArchivoPostulacion> documentos) {}
    public record Decision(@NotBlank String estado) {}
    public record Archivar(boolean archivada) {}
    public record PostulacionDto(Long id, Long licitacionId, String licitacionTitulo, String licitadorNombre, Long pymeId, String pymeNombre, Integer pymeRubroId,
                                 Integer pymeTamanoId, boolean premium, String mensaje, Instant fecha, String estado, boolean adjudicada, Instant updatedAt, Long conversacionId, boolean archivada,
                                 Integer pymeCiudadId, List<DocumentoPostulacionDto> documentos) {}
    /** desde/hasta = null cuando hay muy pocas licitaciones del rubro para sugerir un rango. */
    public record ReferenciaPresupuesto(long cantidad, Long desde, Long hasta) {}
    /** Confianza de un licitador: solo conteos y desde cuándo está en la plataforma (nunca datos privados). */
    public record ConfianzaLicitador(long publicadas, long adjudicadas, Instant desde) {}
    public record PuntoMensual(String mes, long valor) {}
    /** Cupos y pulso de una licitación (vista del dueño). cupos = null si no tiene máximo; porDia = últimos 7 días (fecha ISO, el último es hoy). */
    public record PulsoLicitacion(long total, Integer cupos, long hoy, List<PuntoDia> porDia, List<ConteoEstado> conteoPorEstado) {}
    public record PuntoDia(String fecha, long valor) {}
    public record ConteoEstado(String estado, long cantidad) {}
    public record ResumenLicitador(long publicadas, long abiertas, long adjudicadas, long postulacionesRecibidas, long pendientes, List<PuntoMensual> porMes, List<LicitacionDto> recientes) {}
    public record ResumenPyme(long postulacionesTotal, long pendientes, long aprobadas, long rechazadas, long adjudicadas, long usadasMes, long limiteMes, String plan,
                              List<PuntoMensual> porMes, List<LicitacionDto> recomendadas) {}
}
