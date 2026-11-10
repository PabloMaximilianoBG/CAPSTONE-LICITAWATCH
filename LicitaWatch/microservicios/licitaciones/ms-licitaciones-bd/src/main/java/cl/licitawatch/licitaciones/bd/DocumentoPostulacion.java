package cl.licitawatch.licitaciones.bd;

import cl.licitawatch.licitaciones.bd.Catalogos.TipoArchivo;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Tabla postulacion_documento: archivos que sube la Pyme al postular, uno por documento pedido (requisito_id).
 * postulacion_id y requisito_id son FK reales; el archivo va como data URL (base64) en archivo_url, igual que documento_licitacion.
 */
@Entity @Table(name = "postulacion_documento", indexes = @Index(name = "ix_post_doc_post", columnList = "postulacion_id"),
        uniqueConstraints = @UniqueConstraint(name = "uq_post_doc_req", columnNames = {"postulacion_id", "requisito_id"}))
public class DocumentoPostulacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "postulacion_id", nullable = false) private Long postulacionId;
    @Column(name = "requisito_id") private Long requisitoId;
    @Column(name = "nombre_archivo", nullable = false) private String nombreArchivo;
    @Column(name = "archivo_url", nullable = false, columnDefinition = "TEXT") private String archivoUrl;
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "tipo_archivo_id") private TipoArchivo tipoArchivo;
    @Column(name = "fecha_subida", nullable = false) private Instant fechaSubida = Instant.now();

    public Long getId() { return id; } public Long getPostulacionId() { return postulacionId; } public void setPostulacionId(Long v) { postulacionId = v; }
    public Long getRequisitoId() { return requisitoId; } public void setRequisitoId(Long v) { requisitoId = v; }
    public String getNombreArchivo() { return nombreArchivo; } public void setNombreArchivo(String v) { nombreArchivo = v; }
    public String getArchivoUrl() { return archivoUrl; } public void setArchivoUrl(String v) { archivoUrl = v; }
    public TipoArchivo getTipoArchivo() { return tipoArchivo; } public void setTipoArchivo(TipoArchivo v) { tipoArchivo = v; }
    public Instant getFechaSubida() { return fechaSubida; }
}
