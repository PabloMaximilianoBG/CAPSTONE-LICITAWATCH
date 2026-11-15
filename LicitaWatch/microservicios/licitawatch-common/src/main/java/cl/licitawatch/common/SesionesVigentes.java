package cl.licitawatch.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ¿La sesión (jti del JWT) sigue vigente? La pregunta cada BFF a ms-usuarios-bs y guarda la respuesta 30 s en memoria para no
 * consultar en cada petición: una sesión cerrada desde otro dispositivo deja de funcionar en 30 s como máximo.
 * Si ms-usuarios no responde, se deja pasar (sin guardar la respuesta) para no tumbar toda la plataforma.
 */
@Component
public class SesionesVigentes {
    private static final Logger log = LoggerFactory.getLogger(SesionesVigentes.class);
    private static final long TTL_MS = 30_000;
    private record Entrada(boolean vigente, long hasta) {}
    private final Map<String, Entrada> cache = new ConcurrentHashMap<>();
    private final InternalClient interno;
    private final String urlUsuarios;

    public SesionesVigentes(InternalClient interno, @Value("${lw.urls.sesiones:${URL_USUARIOS_BS:http://localhost:8181}}") String urlUsuarios) {
        this.interno = interno; this.urlUsuarios = urlUsuarios;
    }

    public boolean vigente(String tokenId) {
        long ahora = System.currentTimeMillis();
        Entrada e = cache.get(tokenId);
        if (e != null && e.hasta() > ahora) return e.vigente();
        try {
            boolean v = Boolean.TRUE.equals(interno.get(urlUsuarios + "/internal/sesiones/" + InternalClient.q(tokenId) + "/vigente", Map.class).get("vigente"));
            if (cache.size() > 10_000) cache.entrySet().removeIf(x -> x.getValue().hasta() <= ahora);
            cache.put(tokenId, new Entrada(v, ahora + TTL_MS));
            return v;
        } catch (Exception ex) {
            log.warn("No se pudo verificar la sesión con ms-usuarios: {}", ex.getMessage());   // nunca se registra el token
            return true;
        }
    }

    /** Olvida la respuesta guardada (p. ej. al cerrar sesión en este mismo servicio). */
    public void olvidar(String tokenId) { if (tokenId != null) cache.remove(tokenId); }
}
