package cl.licitawatch.ventas.bs;

import java.util.List;
import java.util.Map;

/**
 * Condiciones comerciales de cada plan que aún son configuración del servicio: cupo de postulaciones y beneficios.
 * El precio mensual vive en plan_suscripcion.precio_mensual y lo administra el Admin (con auditoría en plan_precio_historial).
 */
public final class PlanInfo {
    private PlanInfo() {}
    public record Info(int postulacionesMes, String descripcion, List<String> beneficios) {}

    public static final Map<String, Info> POR_NOMBRE = Map.of(
            "Estándar", new Info(3, "Para empezar a encontrar oportunidades sin costo.",
                    List.of("Búsqueda ilimitada de licitaciones", "3 postulaciones al mes", "Chat con el Licitador al ser adjudicado", "Soporte estándar")),
            "Premium", new Info(7, "Más postulaciones, más visibilidad y tu asistente con IA.",
                    List.of("Búsqueda ilimitada de licitaciones", "7 postulaciones al mes", "LicitAsist: asistente con inteligencia artificial", "Prioridad de visibilidad ante los Licitadores",
                            "Alertas por correo de licitaciones de tu rubro", "Insignia Premium en tu perfil", "Soporte prioritario")));

    public static Info de(String nombre) { return POR_NOMBRE.getOrDefault(nombre, POR_NOMBRE.get("Estándar")); }
}
