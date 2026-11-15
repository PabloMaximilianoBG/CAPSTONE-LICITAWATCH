package cl.licitawatch.usuarios.bd;

import jakarta.persistence.*;
import java.time.Instant;

/** Tabla usuario_codigo_recuperacion: códigos de un solo uso de la 2FA, guardados con BCrypt. usuario_id es FK real. */
@Entity @Table(name = "usuario_codigo_recuperacion", indexes = @Index(name = "ix_codigo_rec_usuario", columnList = "usuario_id"))
public class CodigoRecuperacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "usuario_id", nullable = false) private Long usuarioId;
    @Column(name = "codigo_hash", nullable = false, length = 100) private String codigoHash;
    @Column(name = "usado_at") private Instant usadoAt;

    public Long getId() { return id; } public Long getUsuarioId() { return usuarioId; } public void setUsuarioId(Long v) { usuarioId = v; }
    public String getCodigoHash() { return codigoHash; } public void setCodigoHash(String v) { codigoHash = v; }
    public Instant getUsadoAt() { return usadoAt; } public void setUsadoAt(Instant v) { usadoAt = v; }
}
