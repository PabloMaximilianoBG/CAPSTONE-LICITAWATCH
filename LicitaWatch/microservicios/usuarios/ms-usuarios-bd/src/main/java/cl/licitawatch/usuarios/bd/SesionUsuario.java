package cl.licitawatch.usuarios.bd;

import jakarta.persistence.*;
import java.time.Instant;

/** Tabla sesion_usuario: una fila por inicio de sesión. token_id = jti del JWT (el token no se guarda). usuario_id es FK real. */
@Entity @Table(name = "sesion_usuario", indexes = @Index(name = "ix_sesion_usuario", columnList = "usuario_id"),
        uniqueConstraints = @UniqueConstraint(name = "uq_sesion_token", columnNames = "token_id"))
public class SesionUsuario {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "usuario_id", nullable = false) private Long usuarioId;
    @Column(name = "token_id", nullable = false, length = 64) private String tokenId;
    @Column(length = 80) private String dispositivo;
    @Column(length = 80) private String navegador;
    @Column(length = 45) private String ip;
    @Column(name = "creada_at", nullable = false) private Instant creadaAt = Instant.now();
    @Column(name = "ultimo_uso_at", nullable = false) private Instant ultimoUsoAt = Instant.now();
    @Column(name = "expira_at", nullable = false) private Instant expiraAt;
    @Column(name = "revocada_at") private Instant revocadaAt;

    public Long getId() { return id; } public Long getUsuarioId() { return usuarioId; } public void setUsuarioId(Long v) { usuarioId = v; }
    public String getTokenId() { return tokenId; } public void setTokenId(String v) { tokenId = v; }
    public String getDispositivo() { return dispositivo; } public void setDispositivo(String v) { dispositivo = v; }
    public String getNavegador() { return navegador; } public void setNavegador(String v) { navegador = v; }
    public String getIp() { return ip; } public void setIp(String v) { ip = v; }
    public Instant getCreadaAt() { return creadaAt; }
    public Instant getUltimoUsoAt() { return ultimoUsoAt; } public void setUltimoUsoAt(Instant v) { ultimoUsoAt = v; }
    public Instant getExpiraAt() { return expiraAt; } public void setExpiraAt(Instant v) { expiraAt = v; }
    public Instant getRevocadaAt() { return revocadaAt; } public void setRevocadaAt(Instant v) { revocadaAt = v; }
}
