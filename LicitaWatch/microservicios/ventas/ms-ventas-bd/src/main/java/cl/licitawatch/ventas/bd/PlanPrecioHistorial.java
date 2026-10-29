package cl.licitawatch.ventas.bd;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Tabla plan_precio_historial: auditoría de cada cambio de precio de un plan (usuarioId es REF a Usuarios, sin FK). */
@Entity @Table(name = "plan_precio_historial", indexes = @Index(name = "ix_precio_hist_plan", columnList = "plan_id"))
public class PlanPrecioHistorial {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "plan_id", nullable = false) private Integer planId;
    @Column(name = "precio_anterior") private Integer precioAnterior;
    @Column(name = "precio_nuevo", nullable = false) private Integer precioNuevo;
    @Column(name = "usuario_id", nullable = false) private Long usuarioId;
    @Column(length = 200) private String motivo;
    @Column(nullable = false) private LocalDateTime fecha = LocalDateTime.now();

    public Long getId() { return id; }
    public Integer getPlanId() { return planId; } public void setPlanId(Integer v) { planId = v; }
    public Integer getPrecioAnterior() { return precioAnterior; } public void setPrecioAnterior(Integer v) { precioAnterior = v; }
    public Integer getPrecioNuevo() { return precioNuevo; } public void setPrecioNuevo(Integer v) { precioNuevo = v; }
    public Long getUsuarioId() { return usuarioId; } public void setUsuarioId(Long v) { usuarioId = v; }
    public String getMotivo() { return motivo; } public void setMotivo(String v) { motivo = v; }
    public LocalDateTime getFecha() { return fecha; }
}
