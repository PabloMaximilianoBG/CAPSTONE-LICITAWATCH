package cl.licitawatch.licitaciones.bd;

import cl.licitawatch.licitaciones.bd.Catalogos.TipoArchivo;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Tabla documento_licitacion: documentos adicionales de una licitación (anexos, planos, especificaciones…), además del documento
 * principal que guarda la propia licitación (archivo_url). licitacion_id es FK real; el archivo va como data URL (base64) en archivo_url.
 */
@Entity @Table(name = "documento_licitacion", indexes = @Index(name = "ix_doc_lic", columnList = "licitacion_id"))
public class DocumentoLicitacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "licitacion_id", nullable = false) private Long licitacionId;
    @Column(nullable = false) private String nombre;
    @Column(name = "archivo_url", nullable = false, columnDefinition = "TEXT") private String archivoUrl;
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "tipo_archivo_id") private TipoArchivo tipoArchivo;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

    public Long getId() { return id; } public Long getLicitacionId() { return licitacionId; } public void setLicitacionId(Long v) { licitacionId = v; }
    public String getNombre() { return nombre; } public void setNombre(String v) { nombre = v; }
    public String getArchivoUrl() { return archivoUrl; } public void setArchivoUrl(String v) { archivoUrl = v; }
    public TipoArchivo getTipoArchivo() { return tipoArchivo; } public void setTipoArchivo(TipoArchivo v) { tipoArchivo = v; }
    public Instant getCreatedAt() { return createdAt; }
}
