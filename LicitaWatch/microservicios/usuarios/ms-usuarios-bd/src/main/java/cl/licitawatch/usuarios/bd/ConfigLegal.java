package cl.licitawatch.usuarios.bd;

import jakarta.persistence.*;

/**
 * Configuración legal de la plataforma: URLs de Términos y Condiciones y Política de Privacidad.
 * Hay exactamente 1 fila con id = 1 (patrón singleton). El Seeder la inicializa vacía.
 */
@Entity
@Table(name = "config_legal")
public class ConfigLegal {
    @Id
    private Integer id = 1;

    @Column(name = "url_terminos", length = 512)
    private String urlTerminos = "/terminos-y-condiciones";

    @Column(name = "url_politica", length = 512)
    private String urlPolitica = "/politica-de-privacidad";

    @Column(name = "version_terminos", nullable = false, length = 32, columnDefinition = "VARCHAR(32) NOT NULL DEFAULT '1.0'")
    private String versionTerminos = "1.0";

    @Column(name = "version_politica", nullable = false, length = 32, columnDefinition = "VARCHAR(32) NOT NULL DEFAULT '1.0'")
    private String versionPolitica = "1.0";

    public ConfigLegal() {}

    public Integer getId() { return id; }
    public String getUrlTerminos() { return urlTerminos != null && !urlTerminos.isBlank() ? urlTerminos : "/terminos-y-condiciones"; }
    public String getUrlPolitica() { return urlPolitica != null && !urlPolitica.isBlank() ? urlPolitica : "/politica-de-privacidad"; }
    public String getVersionTerminos() { return versionTerminos != null && !versionTerminos.isBlank() ? versionTerminos : "1.0"; }
    public String getVersionPolitica() { return versionPolitica != null && !versionPolitica.isBlank() ? versionPolitica : "1.0"; }
    public void setUrlTerminos(String v) { urlTerminos = v != null && !v.isBlank() ? v : "/terminos-y-condiciones"; }
    public void setUrlPolitica(String v) { urlPolitica = v != null && !v.isBlank() ? v : "/politica-de-privacidad"; }
    public void setVersionTerminos(String v) { versionTerminos = v != null && !v.isBlank() ? v : "1.0"; }
    public void setVersionPolitica(String v) { versionPolitica = v != null && !v.isBlank() ? v : "1.0"; }
}
