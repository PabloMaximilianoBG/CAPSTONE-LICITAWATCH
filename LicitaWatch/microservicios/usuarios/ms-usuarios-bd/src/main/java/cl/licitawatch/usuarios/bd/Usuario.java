package cl.licitawatch.usuarios.bd;

import jakarta.persistence.*;
import java.time.Instant;

/** Tabla usuario (ER): id, email UQ, password (bcrypt), rol_id FK, activo, email_verificado, created_at, foto, ultimo_login. */
@Entity @Table(name = "usuario", uniqueConstraints = @UniqueConstraint(name = "uq_usuario_email", columnNames = "email"))
public class Usuario {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 160) private String email;
    @Column(nullable = false) private String password;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "rol_id", nullable = false) private Rol rol;
    @Column(nullable = false) private boolean activo = true;   // false = bloqueada por el administrador
    // false = registrada pero sin confirmar el correo (no puede iniciar sesión). DEFAULT TRUE: las cuentas que ya existían quedan verificadas.
    @Column(name = "email_verificado", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT TRUE") private boolean emailVerificado = true;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(columnDefinition = "TEXT") private String foto;   // foto de perfil: data URL JPEG 256x256 (null = iniciales)
    @Column(name = "ultimo_login") private Instant ultimoLogin;   // último inicio de sesión correcto (null = nunca)
    @Column(name = "password_actualizada_at") private Instant passwordActualizadaAt;   // último cambio de contraseña (null = sin cambios desde el registro)
    @Column(name = "acepta_terminos", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT TRUE") private boolean aceptaTerminos = true;
    @Column(name = "terminos_aceptados_at") private Instant terminosAceptadosAt;
    @Column(name = "version_terminos", nullable = false, length = 32, columnDefinition = "VARCHAR(32) NOT NULL DEFAULT '1.0'") private String versionTerminos = "1.0";
    @Column(name = "version_politica", nullable = false, length = 32, columnDefinition = "VARCHAR(32) NOT NULL DEFAULT '1.0'") private String versionPolitica = "1.0";

    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; } public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; } public void setPassword(String p) { this.password = p; }
    public Rol getRol() { return rol; } public void setRol(Rol rol) { this.rol = rol; }
    public String getRolNombre() { return rol.getNombre(); }
    public boolean isActivo() { return activo; } public void setActivo(boolean activo) { this.activo = activo; }
    public boolean isEmailVerificado() { return emailVerificado; } public void setEmailVerificado(boolean v) { this.emailVerificado = v; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant c) { this.createdAt = c; }
    public String getFoto() { return foto; } public void setFoto(String foto) { this.foto = foto; }
    public Instant getUltimoLogin() { return ultimoLogin; } public void setUltimoLogin(Instant t) { this.ultimoLogin = t; }
    public Instant getPasswordActualizadaAt() { return passwordActualizadaAt; } public void setPasswordActualizadaAt(Instant t) { this.passwordActualizadaAt = t; }
    public boolean isAceptaTerminos() { return aceptaTerminos; } public void setAceptaTerminos(boolean a) { this.aceptaTerminos = a; }
    public Instant getTerminosAceptadosAt() { return terminosAceptadosAt; } public void setTerminosAceptadosAt(Instant t) { this.terminosAceptadosAt = t; }
    public String getVersionTerminos() { return versionTerminos; } public void setVersionTerminos(String v) { this.versionTerminos = v; }
    public String getVersionPolitica() { return versionPolitica; } public void setVersionPolitica(String v) { this.versionPolitica = v; }
}
