package cl.licitawatch.licitaciones.bd;

import jakarta.persistence.*;

/** Tabla licitacion_documento_requerido: documentos que el Licitador pide a las Pymes al publicar (obligatorios u opcionales). licitacion_id es FK real. */
@Entity @Table(name = "licitacion_documento_requerido", indexes = @Index(name = "ix_doc_req_lic", columnList = "licitacion_id"))
public class DocumentoRequerido {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "licitacion_id", nullable = false) private Long licitacionId;
    @Column(nullable = false, length = 160) private String nombre;
    @Column(nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT TRUE") private boolean obligatorio = true;

    public Long getId() { return id; } public Long getLicitacionId() { return licitacionId; } public void setLicitacionId(Long v) { licitacionId = v; }
    public String getNombre() { return nombre; } public void setNombre(String v) { nombre = v; }
    public boolean isObligatorio() { return obligatorio; } public void setObligatorio(boolean v) { obligatorio = v; }
}
