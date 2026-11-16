package cl.licitawatch.asistente.bs;

import cl.licitawatch.asistente.ambassador.GroqClient;
import cl.licitawatch.common.ApiException;
import cl.licitawatch.common.InternalClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * LicitAsist «razona» por la Pyme (solo Premium): ¿me conviene postular?, mi plan del mes y revisa mi mensaje.
 * Los números (compatibilidad, competencia, días, puntaje) los calcula el sistema; la IA (Groq) aporta el criterio y el texto.
 * Si la IA no responde, cada función entrega igual un análisis básico calculado aquí (ia = false).
 */
@Service
public class AnalisisService {
    public record Requisito(String texto, String estado, String nota) {}
    public record AnalisisLicitacion(Long licitacionId, String titulo, String veredicto, int puntaje, int compatibilidad, String competencia, long diasAlCierre,
                                     String resumen, List<Requisito> requisitos, List<String> riesgos, boolean ia) {}
    public record Recomendacion(JsonNode licitacion, int puntaje, String motivo) {}
    public record PlanDelMes(int restantes, int limite, List<Recomendacion> recomendaciones, boolean ia) {}
    public record RevisionMensaje(int puntaje, List<String> fortalezas, List<String> mejoras, String version, boolean ia) {}

    private static final ZoneId CHILE = ZoneId.of("America/Santiago");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", new Locale("es", "CL"));
    private final InternalClient interno; private final GroqClient groq; private final String urlVentas, urlLicitaciones, urlUsuarios;

    public AnalisisService(InternalClient interno, GroqClient groq, @Value("${lw.urls.ventas}") String urlVentas, @Value("${lw.urls.licitaciones}") String urlLicitaciones,
                           @Value("${lw.urls.usuarios}") String urlUsuarios) {
        this.interno = interno; this.groq = groq; this.urlVentas = urlVentas; this.urlLicitaciones = urlLicitaciones; this.urlUsuarios = urlUsuarios;
    }

    /** Fecha de cierre en hora de Chile («20 nov 2026, 23:59»): la IA no debe repetir la hora UTC del JSON. */
    public static String fechaChile(String iso) {
        try { return FECHA.format(Instant.parse(iso).atZone(CHILE)); } catch (Exception e) { return iso; }
    }

    private JsonNode exigirPremium(long pymeId) {
        JsonNode sus = interno.get(urlVentas + "/internal/suscripciones/" + pymeId, JsonNode.class);
        if (!"Premium".equals(sus.path("plan").path("nombre").asText())) throw ApiException.prohibido("Esta función de LicitAsist es un beneficio Premium. Mejora tu plan para usarla");
        return sus;
    }

    // ---------- datos de la Pyme ----------
    private record Pyme(String nombre, int rubroId, Integer regionId, Integer tamanoId, String descripcion, String rubro, String tamano) {}

    private Pyme pyme(long pymeId) {
        JsonNode u = interno.get(urlUsuarios + "/internal/usuarios/" + pymeId + "/resumen", JsonNode.class);
        Integer region = null;
        int ciudad = u.path("ciudadId").asInt(0);
        if (ciudad > 0) {
            try { for (JsonNode c : interno.get(urlUsuarios + "/bs/catalogos/ciudades", JsonNode.class)) if (c.path("id").asInt() == ciudad) region = c.path("regionId").asInt(); }
            catch (Exception ignorada) { /* sin región: no suma puntos de región */ }
        }
        Integer tamano = u.hasNonNull("tamanoEmpresaId") ? u.get("tamanoEmpresaId").asInt() : null;
        return new Pyme(u.path("nombre").asText("tu empresa"), u.path("rubroId").asInt(0), region, tamano, u.path("descripcionEmpresa").asText(""),
                catalogo("rubros", u.path("rubroId").asInt(0)), tamano == null ? "" : catalogo("tamanos", tamano));
    }

    /** id → nombre de un catálogo de Usuarios (rubros, regiones, tamanos); vacío si no responde. */
    public Map<Integer, String> nombres(String cual) {
        Map<Integer, String> m = new HashMap<>();
        try { for (JsonNode c : interno.get(urlUsuarios + "/bs/catalogos/" + cual, JsonNode.class)) m.put(c.path("id").asInt(), c.path("nombre").asText()); }
        catch (Exception ignorada) { }
        return m;
    }

    /** Perfil de la Pyme para el chat de LicitAsist: rubro, región, tamaño, descripción y qué le falta del perfil. */
    public String perfilParaChat(long pymeId) {
        Pyme p = pyme(pymeId);
        JsonNode u = interno.get(urlUsuarios + "/internal/usuarios/" + pymeId + "/resumen", JsonNode.class);
        List<String> falta = new ArrayList<>();
        if (p.descripcion().trim().length() < 30) falta.add("descripción de la empresa");
        if (!u.path("tieneSitioWeb").asBoolean()) falta.add("sitio web");
        if (p.tamanoId() == null) falta.add("tamaño de empresa");
        if (!u.path("tieneTelefono").asBoolean()) falta.add("teléfono");
        String region = p.regionId() == null ? "" : nombres("regiones").getOrDefault(p.regionId(), "");
        return contextoPyme(p) + "\nRegión: " + (region.isEmpty() ? "no indicada" : region) + "\nLe falta en el perfil: " + (falta.isEmpty() ? "nada (perfil completo)" : String.join(", ", falta));
    }

    private String catalogo(String cual, int id) {
        if (id == 0) return "";
        try { for (JsonNode c : interno.get(urlUsuarios + "/bs/catalogos/" + cual, JsonNode.class)) if (c.path("id").asInt() == id) return c.path("nombre").asText(); }
        catch (Exception ignorada) { }
        return "";
    }

    // ---------- cálculo del sistema (mismas reglas que «Compatibilidad contigo» del front) ----------
    /** Tamaño ideal según el presupuesto máximo: hasta $5M Pequeña (1), hasta $25M Mediana (2), más Grande (3); null = cualquiera. */
    private static Integer tamanoIdeal(JsonNode l) { if (!l.hasNonNull("presupuestoMax")) return null; long m = l.get("presupuestoMax").asLong(); return m <= 5_000_000 ? 1 : m <= 25_000_000 ? 2 : 3; }

    private static int compatibilidad(JsonNode l, Pyme p) {
        Integer ideal = tamanoIdeal(l);
        return (l.path("rubroId").asInt() == p.rubroId() ? 40 : 0) + (p.regionId() != null && l.path("regionId").asInt() == p.regionId() ? 30 : 0)
                + (p.tamanoId() != null && (ideal == null || ideal.equals(p.tamanoId())) ? 15 : 0) + (p.descripcion().trim().length() >= 30 ? 15 : 0);
    }

    /** 0 baja, 1 media, 2 alta: por cupos ocupados o, sin límite, por cantidad de postulaciones. */
    private static int competencia(JsonNode l) {
        long n = l.path("postulantes").asLong(); Long max = l.hasNonNull("maxPostulantes") ? l.get("maxPostulantes").asLong() : null;
        if (max != null && max > 0) { double r = (double) n / max; return r < 0.4 ? 0 : r < 0.75 ? 1 : 2; }
        return n <= 2 ? 0 : n <= 6 ? 1 : 2;
    }
    private static final String[] COMPETENCIA = {"Baja", "Media", "Alta"};

    private static long dias(JsonNode l) {
        try { return (long) Math.ceil(Duration.between(Instant.now(), Instant.parse(l.path("fechaCierre").asText())).toMinutes() / 1440.0); } catch (Exception e) { return 0; }
    }

    /** Puntaje 0–100: compatibilidad (60 %), competencia (25), tiempo para preparar la oferta (15). */
    private static int puntaje(JsonNode l, Pyme p) {
        int comp = competencia(l); long d = dias(l);
        return (int) Math.round(compatibilidad(l, p) * 0.6 + (comp == 0 ? 25 : comp == 1 ? 12 : 0) + (d > 3 ? 15 : d >= 1 ? 7 : 0));
    }

    /** Requisitos de la sección «REQUISITOS PARA POSTULAR» de la descripción y documentos obligatorios pedidos. */
    private static List<String> requisitos(JsonNode l) {
        List<String> out = new ArrayList<>();
        String[] lineas = l.path("descripcion").asText("").split("\n");
        boolean en = false;
        for (String x : lineas) {
            String t = x.trim();
            if (t.toUpperCase().startsWith("REQUISITOS PARA POSTULAR")) { en = true; continue; }
            if (en) {
                if (t.matches("^([-•*]|\\d+[.)])\\s+.+")) { String r = t.replaceFirst("^([-•*]|\\d+[.)])\\s+", ""); if (!r.toLowerCase().startsWith("agrega otros requisitos")) out.add(r); }
                else if (!t.isEmpty()) en = false;
            }
        }
        for (JsonNode d : l.path("documentosRequeridos")) if (d.path("obligatorio").asBoolean()) out.add("Documento: " + d.path("nombre").asText());
        return out.size() > 12 ? out.subList(0, 12) : out;
    }

    private static String corto(String s, int max) { return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "…"; }
    private static String limpiar(String t) { return t.replace("**", "").replaceAll("(?m)^#+\\s*", "").trim(); }

    private String contextoPyme(Pyme p) {
        return "Empresa: " + p.nombre() + "\nRubro: " + (p.rubro().isEmpty() ? "no indicado" : p.rubro()) + "\nTamaño: " + (p.tamano().isEmpty() ? "no indicado" : p.tamano())
                + "\nDescripción de la empresa: " + (p.descripcion().isBlank() ? "no indicada" : corto(p.descripcion(), 700));
    }

    // ---------- #1 ¿Me conviene postular? ----------
    public AnalisisLicitacion analizar(long pymeId, long licitacionId) {
        exigirPremium(pymeId);
        JsonNode l = interno.get(urlLicitaciones + "/bs/licitaciones/" + licitacionId, JsonNode.class);
        if (!"Abierta".equals(l.path("estado").asText())) throw ApiException.invalido("Esta licitación ya no recibe postulaciones");
        Pyme p = pyme(pymeId);
        int compat = compatibilidad(l, p), comp = competencia(l), punt = puntaje(l, p);
        long d = dias(l);
        List<String> reqs = requisitos(l);

        // Riesgos: los calcula el sistema.
        List<String> riesgos = new ArrayList<>();
        if (d <= 2) riesgos.add(d < 1 ? "Cierra hoy: tendrías que postular de inmediato." : "Cierra en " + d + " días: poco tiempo para preparar la oferta.");
        long docs = 0; for (JsonNode x : l.path("documentosRequeridos")) if (x.path("obligatorio").asBoolean()) docs++;
        if (docs > 0) riesgos.add("Pide " + docs + " documento" + (docs == 1 ? "" : "s") + " obligatorio" + (docs == 1 ? "" : "s") + ": tenlos listos antes de postular.");
        if (comp == 2) riesgos.add("Competencia alta: ya hay muchas propuestas o quedan pocos cupos.");
        Integer ideal = tamanoIdeal(l);
        if (ideal != null && p.tamanoId() != null && !ideal.equals(p.tamanoId())) riesgos.add("El presupuesto apunta a una empresa " + catalogo("tamanos", ideal).toLowerCase() + " y la tuya es " + p.tamano().toLowerCase() + ".");
        if (l.path("rubroId").asInt() != p.rubroId()) riesgos.add("No es de tu rubro: el Licitador podría preferir especialistas.");
        if (!l.hasNonNull("presupuestoMax") && !l.hasNonNull("presupuestoMin")) riesgos.add("Presupuesto a convenir: aclara tus valores en el mensaje.");

        // La IA juzga cada requisito y resume.
        StringBuilder lista = new StringBuilder();
        for (int i = 0; i < reqs.size(); i++) lista.append(i + 1).append(". ").append(reqs.get(i)).append("\n");
        String sistema = """
                Eres LicitAsist, asesor de licitaciones para Pymes chilenas. Evalúa si la empresa cumple cada requisito usando SOLO los datos dados.
                Si no hay información suficiente para afirmarlo, responde REVISAR (no inventes). Responde en español de Chile, texto plano, con EXACTAMENTE este formato:
                RESUMEN: <la licitación en máximo 3 líneas: qué piden, dónde, plazo y presupuesto>
                <número>|CUMPLE o NO o REVISAR|<nota de máximo 12 palabras>
                (una línea por requisito, en el mismo orden)""";
        String usuario = contextoPyme(p) + "\n\nLicitación: " + l.path("titulo").asText() + " (de " + l.path("licitadorNombre").asText() + ")\nCierra: " + fechaChile(l.path("fechaCierre").asText())
                + (l.path("duracionMeses").isNull() ? "" : "\nDuración del contrato: " + l.path("duracionMeses").asText() + " meses")
                + "\nDescripción:\n" + corto(l.path("descripcion").asText(), 2500) + "\n\nRequisitos a evaluar:\n" + (lista.length() == 0 ? "(no hay requisitos listados)\n" : lista);
        Optional<String> r = groq.responder(sistema, usuario).map(AnalisisService::limpiar);

        String resumen = corto(l.path("descripcion").asText("").replaceAll("\\s+", " "), 260);
        List<Requisito> evaluados = new ArrayList<>();
        Map<Integer, String[]> porNumero = new HashMap<>();
        if (r.isPresent()) {
            for (String linea : r.get().split("\n")) {
                String t = linea.trim();
                if (t.toUpperCase().startsWith("RESUMEN:")) resumen = t.substring(8).trim();
                else if (t.matches("^\\d+\\s*\\|.*")) { String[] partes = t.split("\\|", 3); try { porNumero.put(Integer.parseInt(partes[0].trim()), partes); } catch (NumberFormatException ignorada) { } }
            }
        }
        int noCumple = 0;
        for (int i = 0; i < reqs.size(); i++) {
            String[] x = porNumero.get(i + 1);
            String est = x == null || x.length < 2 ? "revisar" : x[1].trim().toUpperCase().startsWith("CUMPLE") ? "cumple" : x[1].trim().toUpperCase().startsWith("NO") ? "no-cumple" : "revisar";
            if (est.equals("no-cumple")) noCumple++;
            evaluados.add(new Requisito(reqs.get(i), est, x != null && x.length > 2 ? x[2].trim() : "Verifica que lo cumples antes de postular."));
        }
        // Veredicto: el puntaje del sistema, bajado un nivel si la IA detecta 2 o más requisitos que no cumples.
        int nivel = punt >= 70 ? 0 : punt >= 45 ? 1 : 2;
        if (noCumple >= 2) nivel = Math.min(2, nivel + 1);
        String veredicto = nivel == 0 ? "postular" : nivel == 1 ? "con-cuidado" : "no-postular";
        return new AnalisisLicitacion(licitacionId, l.path("titulo").asText(), veredicto, punt, compat, COMPETENCIA[comp], d, resumen, evaluados, riesgos, r.isPresent());
    }

    // ---------- #2 Mi plan del mes ----------
    public PlanDelMes planDelMes(long pymeId) {
        JsonNode sus = exigirPremium(pymeId);
        int limite = sus.path("plan").path("postulacionesMes").asInt(7), usadas = sus.path("postulacionesUsadas").asInt();
        int restantes = Math.max(0, limite - usadas);
        Pyme p = pyme(pymeId);
        Set<Long> postuladas = new HashSet<>();
        try { for (JsonNode x : interno.get(urlLicitaciones + "/bs/postulaciones/mias", JsonNode.class)) postuladas.add(x.path("licitacionId").asLong()); }
        catch (Exception ignorada) { }
        List<JsonNode> candidatas = new ArrayList<>();
        for (JsonNode l : interno.get(urlLicitaciones + "/internal/licitaciones/abiertas", JsonNode.class))
            if (!postuladas.contains(l.path("id").asLong()) && dias(l) >= 0) candidatas.add(l);
        candidatas.sort(Comparator.comparingInt((JsonNode l) -> -puntaje(l, p)).thenComparing(l -> l.path("fechaCierre").asText()));
        List<JsonNode> top = candidatas.stream().limit(5).toList();

        // Motivo base calculado por el sistema; la IA lo reescribe en una línea más persuasiva y concreta.
        Map<Long, String> motivos = new LinkedHashMap<>();
        for (JsonNode l : top) motivos.put(l.path("id").asLong(), motivoBase(l, p));
        boolean ia = false;
        if (!top.isEmpty()) {
            StringBuilder lista = new StringBuilder();
            for (JsonNode l : top) lista.append(l.path("id").asText()).append("|").append(l.path("titulo").asText()).append(" | ").append(motivos.get(l.path("id").asLong()))
                    .append(" | cierra ").append(fechaChile(l.path("fechaCierre").asText())).append(" | ").append(corto(l.path("descripcion").asText().replaceAll("\\s+", " "), 220)).append("\n");
            String sistema = """
                    Eres LicitAsist. Para cada licitación escribe POR QUÉ le conviene a esta empresa, en una sola línea de máximo 22 palabras,
                    concreta y basada solo en los datos (rubro, región, competencia, plazo, alcance). Español de Chile, texto plano. Formato exacto, una línea por licitación:
                    <id>|<motivo>""";
            Optional<String> r = groq.responder(sistema, contextoPyme(p) + "\n\nLicitaciones (id | título | datos):\n" + lista).map(AnalisisService::limpiar);
            if (r.isPresent()) for (String linea : r.get().split("\n")) {
                String[] x = linea.trim().split("\\|", 2);
                try { long id = Long.parseLong(x[0].trim()); if (x.length == 2 && motivos.containsKey(id) && !x[1].isBlank()) { motivos.put(id, x[1].trim()); ia = true; } }
                catch (NumberFormatException ignorada) { }
            }
        }
        List<Recomendacion> recs = top.stream().map(l -> new Recomendacion(l, puntaje(l, p), motivos.get(l.path("id").asLong()))).collect(Collectors.toList());
        return new PlanDelMes(restantes, limite, recs, ia);
    }

    private String motivoBase(JsonNode l, Pyme p) {
        List<String> m = new ArrayList<>();
        if (l.path("rubroId").asInt() == p.rubroId()) m.add("tu rubro");
        if (p.regionId() != null && l.path("regionId").asInt() == p.regionId()) m.add("tu región");
        m.add("competencia " + COMPETENCIA[competencia(l)].toLowerCase());
        long d = dias(l); m.add(d < 1 ? "cierra hoy" : "cierra en " + d + " día" + (d == 1 ? "" : "s"));
        return Character.toUpperCase(String.join(" · ", m).charAt(0)) + String.join(" · ", m).substring(1);
    }

    // ---------- #3 Revisa mi mensaje ----------
    public RevisionMensaje revisarMensaje(long pymeId, long licitacionId, String mensaje) {
        exigirPremium(pymeId);
        if (mensaje == null || mensaje.trim().length() < 30) throw ApiException.invalido("Escribe al menos unas líneas para que LicitAsist pueda revisarlas");
        JsonNode l = interno.get(urlLicitaciones + "/bs/licitaciones/" + licitacionId, JsonNode.class);
        Pyme p = pyme(pymeId);
        List<String> reqs = requisitos(l);

        // Revisión básica del sistema (también es el respaldo si la IA no responde).
        String m = mensaje.toLowerCase();
        int palabras = mensaje.trim().split("\\s+").length;
        List<String> bien = new ArrayList<>(), falta = new ArrayList<>();
        int base = 40;
        if (palabras >= 60 && palabras <= 250) { base += 15; bien.add("Buen largo: ni muy corto ni excesivo."); } else falta.add(palabras < 60 ? "Es muy breve: desarrolla por qué tu empresa calza." : "Es largo: resume lo esencial.");
        if (m.matches("(?s).*(experiencia|años|proyectos|clientes|trabajos similares).*")) { base += 15; bien.add("Mencionas experiencia."); } else falta.add("Menciona tu experiencia en trabajos similares.");
        if (m.matches("(?s).*(plazo|días|semanas|inicio|disponib).*")) { base += 10; bien.add("Indicas plazos o disponibilidad."); } else falta.add("Indica tu disponibilidad o plazos de inicio.");
        long cubiertos = reqs.stream().filter(rq -> Arrays.stream(rq.toLowerCase().split("[^a-záéíóúñ]+")).filter(w -> w.length() > 5).anyMatch(m::contains)).count();
        if (!reqs.isEmpty() && cubiertos * 2 >= reqs.size()) { base += 15; bien.add("Respondes a los requisitos pedidos."); } else if (!reqs.isEmpty()) falta.add("Explica cómo cumples los requisitos (" + Math.max(0, reqs.size() - cubiertos) + " sin mencionar).");
        if (mensaje.contains("[")) falta.add("Quedan textos entre [corchetes] por completar.");
        int punt = Math.min(100, base);

        String sistema = """
                Eres LicitAsist. Revisa el mensaje de postulación de una Pyme a una licitación. Usa SOLO los datos dados; no inventes certificaciones, años ni clientes.
                Responde en español de Chile, texto plano, con EXACTAMENTE este formato:
                PUNTAJE: <0 a 100>
                BIEN: <fortaleza 1>
                BIEN: <fortaleza 2>
                FALTA: <mejora concreta 1>
                FALTA: <mejora concreta 2>
                FALTA: <mejora concreta 3>
                VERSION:
                <versión mejorada del mensaje, 120 a 200 palabras, primera persona plural; deja [entre corchetes] solo los datos que falten>""";
        String usuario = contextoPyme(p) + "\n\nLicitación: " + l.path("titulo").asText() + "\nRequisitos:\n" + (reqs.isEmpty() ? "(no listados)" : String.join("\n", reqs))
                + "\nDescripción:\n" + corto(l.path("descripcion").asText(), 1500) + "\n\nMensaje de la Pyme:\n" + corto(mensaje, 3000);
        Optional<String> r = groq.responder(sistema, usuario).map(AnalisisService::limpiar);
        if (r.isEmpty()) return new RevisionMensaje(punt, bien, falta, null, false);

        int puntIa = punt; List<String> bienIa = new ArrayList<>(), faltaIa = new ArrayList<>(); StringBuilder version = new StringBuilder(); boolean enVersion = false;
        for (String linea : r.get().split("\n")) {
            String t = linea.trim();
            if (enVersion) { version.append(linea).append("\n"); continue; }
            if (t.toUpperCase().startsWith("PUNTAJE:")) { try { puntIa = Math.max(0, Math.min(100, Integer.parseInt(t.replaceAll("[^0-9]", "").replaceAll("^(\\d{1,3}).*", "$1")))); } catch (NumberFormatException ignorada) { } }
            else if (t.toUpperCase().startsWith("BIEN:")) bienIa.add(t.substring(5).trim());
            else if (t.toUpperCase().startsWith("FALTA:")) faltaIa.add(t.substring(6).trim());
            else if (t.toUpperCase().startsWith("VERSION")) enVersion = true;
        }
        return new RevisionMensaje(puntIa, bienIa.isEmpty() ? bien : bienIa, faltaIa.isEmpty() ? falta : faltaIa, version.toString().trim().isEmpty() ? null : version.toString().trim(), true);
    }
}
