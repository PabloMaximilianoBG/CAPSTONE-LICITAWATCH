package cl.licitawatch.asistente.bs;

import cl.licitawatch.asistente.ambassador.GroqClient;
import cl.licitawatch.common.ApiException;
import cl.licitawatch.common.InternalClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;

/** LicitAsist: función Premium. Busca entre las licitaciones abiertas y redacta la respuesta (con Groq si hay API key). */
@Service
public class AsistenteService {
    public record Respuesta(String rol, String texto, List<JsonNode> licitaciones) {}
    private final InternalClient interno; private final GroqClient groq; private final String urlVentas, urlLicitaciones;

    public AsistenteService(InternalClient interno, GroqClient groq, @Value("${lw.urls.ventas}") String urlVentas, @Value("${lw.urls.licitaciones}") String urlLicitaciones) {
        this.interno = interno; this.groq = groq; this.urlVentas = urlVentas; this.urlLicitaciones = urlLicitaciones;
    }

    public Respuesta preguntar(long pymeId, String texto) {
        JsonNode sus = interno.get(urlVentas + "/internal/suscripciones/" + pymeId, JsonNode.class);
        if (!"Premium".equals(sus.path("plan").path("nombre").asText())) throw ApiException.prohibido("LicitAsist es una función del plan Premium");
        if (texto == null || texto.isBlank()) throw ApiException.invalido("Escribe tu consulta");

        String q = norm(texto);
        if (q.contains("cuantas postulaciones")) {
            int usadas = sus.path("postulacionesUsadas").asInt(), lim = sus.path("plan").path("postulacionesMes").asInt();
            return new Respuesta("asistente", "Llevas " + usadas + " de " + lim + " postulaciones este mes; te quedan " + Math.max(0, lim - usadas) + ".", List.of());
        }
        if (q.contains("como postulo") || q.contains("como postular"))
            return new Respuesta("asistente", "Entra a Explorar licitaciones, abre la que te interese y escribe un mensaje para el Licitador en el cuadro “Postular”. El Licitador la revisará y te avisaremos del resultado.", List.of());

        JsonNode abiertas = interno.get(urlLicitaciones + "/internal/licitaciones/abiertas", JsonNode.class);
        List<String> palabras = Arrays.stream(q.split("[^a-z0-9]+")).filter(w -> w.length() > 3 && !STOP.contains(w)).toList();
        List<Map.Entry<JsonNode, Integer>> puntuadas = new ArrayList<>();
        for (JsonNode l : abiertas) {
            String hay = norm(l.path("titulo").asText() + " " + l.path("descripcion").asText() + " " + l.path("licitadorNombre").asText());
            int p = (int) palabras.stream().filter(hay::contains).count();
            if (p > 0 || palabras.isEmpty()) puntuadas.add(Map.entry(l, p));
        }
        puntuadas.sort((a, b) -> b.getValue() - a.getValue());
        List<JsonNode> top = puntuadas.stream().limit(3).map(Map.Entry::getKey).toList();

        String base = top.isEmpty() ? "No encontré licitaciones abiertas que calcen con tu consulta. Prueba con otro rubro o región." : "Encontré " + top.size() + " licitación(es) abierta(s) que podrían interesarte:";

        // La IA recibe el contexto real de la Pyme (plan, sus postulaciones y las licitaciones abiertas) y responde cualquier consulta
        JsonNode postulaciones;
        try { postulaciones = interno.get(urlLicitaciones + "/bs/postulaciones/mias", JsonNode.class); }
        catch (Exception e) { postulaciones = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode(); }
        StringBuilder ctx = new StringBuilder();
        ctx.append("Plan: ").append(sus.path("plan").path("nombre").asText()).append(" (").append(sus.path("postulacionesUsadas").asInt())
           .append(" de ").append(sus.path("plan").path("postulacionesMes").asInt()).append(" postulaciones usadas este mes)\n\n");
        ctx.append("Postulaciones de la Pyme (").append(postulaciones.size()).append("):\n");
        for (JsonNode p : postulaciones)
            ctx.append("- \"").append(p.path("licitacionTitulo").asText()).append("\" de ").append(p.path("licitadorNombre").asText())
               .append(" | estado: ").append(p.path("estado").asText()).append(p.path("adjudicada").asBoolean() ? " (adjudicada)" : "")
               .append(" | mensaje enviado: \"").append(corto(p.path("mensaje").asText(), 400)).append("\"\n");
        ctx.append("\nLicitaciones abiertas (").append(abiertas.size()).append("):\n");
        for (JsonNode l : abiertas)
            ctx.append("- [").append(l.path("id").asText()).append("] \"").append(l.path("titulo").asText()).append("\" de ").append(l.path("licitadorNombre").asText())
               .append(" | presupuesto $").append(l.path("presupuestoMin").asText("?")).append(" a $").append(l.path("presupuestoMax").asText("?"))
               .append(" | cierra ").append(l.path("fechaCierre").asText()).append(" | postulantes: ").append(l.path("postulantes").asText())
               .append(l.path("maxPostulantes").isNull() ? "" : " de " + l.path("maxPostulantes").asText())
               .append(" | ").append(corto(l.path("descripcion").asText(), 300)).append("\n");

        String sistema = """
                Eres LicitAsist, el asistente con IA de LicitaWatch, un marketplace B2B de licitaciones privadas en Chile.
                Ayudas a una Pyme a encontrar licitaciones, entender el estado de sus postulaciones, estimar qué tan probable es ganarlas
                (según cuántos postulantes hay, el cupo máximo, si su oferta calza con lo pedido y la calidad de su mensaje) y a redactar
                mejores mensajes de postulación. Usa SOLO los datos del contexto; nunca inventes licitaciones, montos ni estados.
                Si estimas probabilidades, explica que es una estimación. Responde en español de Chile, claro y breve (máximo 12 líneas),
                en texto plano sin Markdown (sin asteriscos ni #); usa guiones para las listas.""";
        String respuesta = groq.responder(sistema, "Contexto de la Pyme:\n" + ctx + "\nConsulta de la Pyme: " + texto)
                .map(t -> t.replace("**", "").replaceAll("(?m)^#+\\s*", "").replaceAll("(?m)[ \\t]+$", "")).orElse(base);
        return new Respuesta("asistente", respuesta, top);
    }

    private static String corto(String s, int max) { return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "…"; }

    private static final Set<String> STOP = Set.of("busca", "muestrame", "licitaciones", "licitacion", "quiero", "necesito", "para", "sobre", "dame", "cuales", "hay", "pronto", "cierran");
    private static String norm(String s) { return Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", ""); }
}
