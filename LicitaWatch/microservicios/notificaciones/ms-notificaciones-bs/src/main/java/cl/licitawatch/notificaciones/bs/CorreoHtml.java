package cl.licitawatch.notificaciones.bs;

import org.springframework.web.util.HtmlUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Diseño único de los correos de LicitaWatch (cabecera con la marca, título, saludo, botón, enlace alternativo,
 * aviso y pie). Arma el HTML a partir del mismo asunto y cuerpo que envía cada microservicio, así que no cambia
 * el contrato de /internal/notificaciones. El cuerpo original se envía además como texto plano alternativo.
 */
final class CorreoHtml {
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Pattern PAGO = Pattern.compile("suscripción (\\S+) está activa\\. Orden de compra (\\S+), código de autorización ([^.\\s]+)");
    private static final String VERDE = "#15803d", VERDE_BG = "#dcfce7", ROJO = "#b91c1c", ROJO_BG = "#fee2e2", AZUL = "#1d4ed8", AZUL_BG = "#dbeafe";

    private CorreoHtml() {
    }

    /** Contenido del correo listo para la plantilla. */
    private static final class Contenido {
        String etiqueta = "Notificación", titulo, saludo, botonTexto, botonUrl, aviso, estado, estadoColor, estadoFondo, detallesTitulo;
        boolean mostrarEnlace;
        final List<String> parrafos = new ArrayList<>();
        final Map<String, String> detalles = new LinkedHashMap<>();
    }

    static String armar(String tipo, String asunto, String cuerpo, String nombre, String rol, String appUrl) {
        String texto = cuerpo == null ? "" : cuerpo;
        String enlace = primerEnlace(texto);
        String hola = "Hola " + (nombre == null || nombre.isBlank() ? "" : nombre.trim()) + ",";
        Contenido c = new Contenido();
        c.saludo = hola.replace("Hola ,", "Hola,");
        c.titulo = asunto;

        if ("CORREO".equals(tipo) && asunto != null && asunto.startsWith("Verifica")) {
            c.etiqueta = "Bienvenida";
            c.titulo = "¡Bienvenido/a a LicitaWatch!";
            c.parrafos.add("Gracias por registrarte como " + perfil(rol) + " en LicitaWatch, la plataforma privada de gestión de licitaciones.");
            c.parrafos.add("Para activar tu cuenta y comenzar a usar las funcionalidades privadas, confirma tu correo electrónico presionando el siguiente botón.");
            c.botonTexto = "Confirmar correo"; c.botonUrl = enlace; c.mostrarEnlace = true;
            c.aviso = "Por seguridad, este enlace expira en 24 horas y solo puede usarse una vez. Si no creaste esta cuenta, ignora este correo.";
        } else if ("CORREO".equals(tipo) && asunto != null && asunto.startsWith("Recupera")) {
            c.etiqueta = "Seguridad";
            c.titulo = "Restablece tu contraseña";
            c.parrafos.add("Recibimos una solicitud para restablecer la contraseña de tu cuenta en LicitaWatch.");
            c.parrafos.add("Para crear una nueva contraseña, presiona el siguiente botón.");
            c.botonTexto = "Restablecer contraseña"; c.botonUrl = enlace; c.mostrarEnlace = true;
            c.aviso = "Por seguridad, este enlace expira en 1 hora y solo puede usarse una vez. Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue siendo válida.";
        } else if ("Licitación de tu rubro".equals(tipo)) {
            c.etiqueta = "Oportunidad";
            c.titulo = "Nueva licitación de tu rubro";
            rubro(texto, c);
            c.estado = "NUEVA"; c.estadoColor = AZUL; c.estadoFondo = AZUL_BG;
            c.botonTexto = "Ver licitación y postular"; c.botonUrl = enlace != null ? enlace : appUrl + "/app/explorar";
        } else if ("Pago confirmado".equals(tipo)) {
            c.etiqueta = "Comprobante de pago";
            c.titulo = "COMPROBANTE DE PAGO";
            c.estado = "Estado: PAGADO / APROBADO"; c.estadoColor = VERDE; c.estadoFondo = VERDE_BG;
            Matcher m = PAGO.matcher(texto);
            if (m.find()) {
                c.parrafos.add("¡Gracias por tu compra! Tu pago fue aprobado por Webpay Plus y tu suscripción " + m.group(1) + " ya está activa.");
                c.detallesTitulo = "Detalle de la compra";
                c.detalles.put("Cliente", nombre);
                c.detalles.put("Plan", m.group(1));
                c.detalles.put("Número de orden", m.group(2));
                c.detalles.put("Código de autorización", m.group(3));
                c.detalles.put("Pasarela", "Webpay Plus");
            } else {
                parrafos(texto, c);
            }
            c.botonTexto = "Ver mi suscripción"; c.botonUrl = appUrl + "/app/suscripcion";
        } else {
            parrafos(texto, c);
            switch (tipo == null ? "" : tipo) {
                case "Postulación recibida" -> {
                    c.etiqueta = "Postulación recibida"; c.estado = "NUEVA"; c.estadoColor = AZUL; c.estadoFondo = AZUL_BG;
                    c.botonTexto = "Revisar postulaciones"; c.botonUrl = appUrl + "/app/licitaciones";
                }
                case "Postulación aprobada" -> {
                    c.etiqueta = "Resultado de postulación"; c.estado = "ADJUDICADA"; c.estadoColor = VERDE; c.estadoFondo = VERDE_BG;
                    c.botonTexto = "Ir al chat"; c.botonUrl = appUrl + "/app/chat";
                }
                case "Postulación rechazada" -> {
                    c.etiqueta = "Resultado de postulación"; c.estado = "NO SELECCIONADA"; c.estadoColor = ROJO; c.estadoFondo = ROJO_BG;
                    c.botonTexto = "Ver otras licitaciones"; c.botonUrl = appUrl + "/app/explorar";
                }
                case "Licitación publicada" -> {
                    c.etiqueta = "Licitación publicada"; c.estado = "PUBLICADA"; c.estadoColor = VERDE; c.estadoFondo = VERDE_BG;
                    c.botonTexto = "Ver mis licitaciones"; c.botonUrl = appUrl + "/app/licitaciones";
                }
                default -> {
                    c.botonTexto = enlace != null ? "Abrir en LicitaWatch" : "Ir a LicitaWatch";
                    c.botonUrl = enlace != null ? enlace : appUrl + "/app/notificaciones";
                }
            }
        }
        return plantilla(c);
    }

    private static String perfil(String rol) {
        if ("LICITADOR".equalsIgnoreCase(rol)) return "Licitador";
        if ("PYME".equalsIgnoreCase(rol)) return "Pyme";
        return "usuario";
    }

    private static String primerEnlace(String texto) {
        Matcher m = URL.matcher(texto);
        return m.find() ? m.group().replaceAll("[).,;:]+$", "") : null;
    }

    /** Párrafos separados por líneas en blanco, sin los enlaces (que pasan a ser el botón). */
    private static void parrafos(String texto, Contenido c) {
        for (String p : texto.split("\\n\\s*\\n")) {
            String limpio = URL.matcher(p).replaceAll("").replaceAll("[ \\t]+", " ").trim();
            if (!limpio.isEmpty() && !limpio.equals("Equipo LicitaWatch")) c.parrafos.add(limpio);
        }
    }

    /** Aviso de rubro: las líneas con sangría son la ficha de la licitación (título y "Clave: valor"). */
    private static void rubro(String texto, Contenido c) {
        StringBuilder parrafo = new StringBuilder();
        for (String linea : texto.split("\\n")) {
            if (linea.startsWith("  ") && !linea.isBlank()) {
                String l = linea.trim();
                int dp = l.indexOf(": ");
                if (dp > 0) c.detalles.put(l.substring(0, dp), l.substring(dp + 2));
                else c.detalles.put("Licitación", l);
                continue;
            }
            String l = linea.trim();
            if (l.startsWith("Hola")) { c.saludo = l.endsWith(":") ? l.substring(0, l.length() - 1) + "," : l; continue; }
            if (l.isEmpty() || URL.matcher(l).matches() || l.startsWith("Revisa el detalle") || l.equals("Equipo LicitaWatch")) {
                if (!parrafo.isEmpty()) { c.parrafos.add(parrafo.toString().trim()); parrafo.setLength(0); }
                continue;
            }
            parrafo.append(l).append(' ');
        }
        if (!parrafo.isEmpty()) c.parrafos.add(parrafo.toString().trim());
        if (!c.detalles.isEmpty()) c.detallesTitulo = "Detalle";
    }

    private static String e(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s, "UTF-8");
    }

    private static String plantilla(Contenido c) {
        StringBuilder h = new StringBuilder(4096);
        h.append("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\">")
         .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><meta name=\"color-scheme\" content=\"light\">")
         .append("<title>").append(e(c.titulo)).append("</title>")
         .append("<style>@media only screen and (max-width:620px){.container{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}}</style>")
         .append("</head><body style=\"margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;\">")
         .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#eef2f7;padding:28px 12px;\"><tr><td align=\"center\">")
         .append("<table role=\"presentation\" class=\"container\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08);\">")
         // Encabezado de marca
         .append("<tr><td class=\"px\" style=\"background:#0b1220;background-image:linear-gradient(135deg,#0b1220 0%,#1e3a8a 60%,#2563eb 100%);padding:28px 36px;\">")
         .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"vertical-align:middle;\">")
         .append("<span style=\"display:inline-block;width:34px;height:34px;border-radius:9px;background:#3b82f6;color:#fff;font-weight:800;font-size:18px;line-height:34px;text-align:center;vertical-align:middle;\">L</span>")
         .append("<span style=\"color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px;vertical-align:middle;margin-left:8px;\">Licita<span style=\"color:#93c5fd;\">Watch</span></span>")
         .append("</td><td align=\"right\" style=\"color:#93c5fd;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;\">").append(e(c.etiqueta)).append("</td></tr></table></td></tr>")
         // Cuerpo
         .append("<tr><td class=\"px\" style=\"padding:34px 36px 8px 36px;\">");
        if (c.estado != null) {
            h.append("<div style=\"display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.4px;margin-bottom:16px;background:")
             .append(c.estadoFondo).append(";color:").append(c.estadoColor).append(";\">").append(e(c.estado)).append("</div>");
        }
        h.append("<h1 style=\"margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0f172a;\">").append(e(c.titulo)).append("</h1>")
         .append("<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;\">").append(e(c.saludo)).append("</p>");
        for (String p : c.parrafos) {
            h.append("<p style=\"margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;\">").append(e(p)).append("</p>");
        }
        h.append("</td></tr>");
        // Tabla de detalles
        if (!c.detalles.isEmpty()) {
            h.append("<tr><td class=\"px\" style=\"padding:8px 36px;\">");
            if (c.detallesTitulo != null) {
                h.append("<div style=\"font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1.2px;margin:6px 0 8px 0;\">").append(e(c.detallesTitulo)).append("</div>");
            }
            h.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden;\">");
            int i = 0;
            for (Map.Entry<String, String> d : c.detalles.entrySet()) {
                if (d.getValue() == null || d.getValue().isBlank()) continue;
                String fondo = (i++ % 2 == 0) ? "#f8fafc" : "#ffffff";
                h.append("<tr style=\"background:").append(fondo).append(";\">")
                 .append("<td style=\"padding:11px 16px;font-size:13px;color:#64748b;width:45%;border-bottom:1px solid #eef2f7;\">").append(e(d.getKey())).append("</td>")
                 .append("<td style=\"padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #eef2f7;word-break:break-word;\">").append(e(d.getValue())).append("</td></tr>");
            }
            h.append("</table></td></tr>");
        }
        // Botón y enlace alternativo
        if (c.botonUrl != null) {
            h.append("<tr><td class=\"px\" align=\"left\" style=\"padding:22px 36px 6px 36px;\">")
             .append("<a href=\"").append(e(c.botonUrl)).append("\" style=\"display:inline-block;background:#2563eb;background-image:linear-gradient(135deg,#2563eb,#4f46e5);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;\">")
             .append(e(c.botonTexto)).append("</a></td></tr>");
            if (c.mostrarEnlace) {
                h.append("<tr><td class=\"px\" style=\"padding:12px 36px 0 36px;font-size:12px;line-height:1.6;color:#64748b;\">")
                 .append("Si el botón no funciona, copia y pega este enlace en tu navegador:<br>")
                 .append("<a href=\"").append(e(c.botonUrl)).append("\" style=\"color:#2563eb;word-break:break-all;\">").append(e(c.botonUrl)).append("</a></td></tr>");
            }
        }
        // Aviso
        if (c.aviso != null) {
            h.append("<tr><td class=\"px\" style=\"padding:18px 36px 0 36px;\">")
             .append("<div style=\"background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;\">")
             .append(e(c.aviso)).append("</div></td></tr>");
        }
        // Pie
        h.append("<tr><td class=\"px\" style=\"padding:30px 36px;\"><hr style=\"border:none;border-top:1px solid #e2e8f0;margin:0 0 16px 0;\">")
         .append("<p style=\"margin:0;font-size:12px;line-height:1.6;color:#94a3b8;\">LicitaWatch · Plataforma privada de gestión de licitaciones.<br>")
         .append("Este es un correo automático, por favor no respondas a este mensaje.</p></td></tr>")
         .append("</table></td></tr></table></body></html>");
        return h.toString();
    }
}
