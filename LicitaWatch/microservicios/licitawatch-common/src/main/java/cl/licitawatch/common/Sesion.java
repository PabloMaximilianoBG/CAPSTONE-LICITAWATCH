package cl.licitawatch.common;

/**
 * Usuario autenticado de la petición actual. tokenId = identificador (jti) de la sesión del JWT; null en los tokens anteriores
 * a las sesiones registradas o cuando la llamada interna no lo trae.
 */
public record Sesion(long usuarioId, String rol, String tokenId) {
    public Sesion(long usuarioId, String rol) { this(usuarioId, rol, null); }
    public boolean esAdmin() { return "ADMIN".equals(rol); }
    public boolean esLicitador() { return "LICITADOR".equals(rol); }
    public boolean esPyme() { return "PYME".equals(rol); }
}
