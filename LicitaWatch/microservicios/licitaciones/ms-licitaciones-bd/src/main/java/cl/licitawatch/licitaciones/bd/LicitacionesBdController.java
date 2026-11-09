package cl.licitawatch.licitaciones.bd;

import cl.licitawatch.common.ApiException;
import cl.licitawatch.licitaciones.bd.Catalogos.*;
import cl.licitawatch.licitaciones.bd.Repos.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/** Capa BD de Licitaciones: licitacion, postulacion y sus catálogos. Solo la llama la capa BS (X-Internal-Key). */
@RestController
@RequestMapping("/bd")
public class LicitacionesBdController {
    /** Fila de licitacion con el nombre de sus catálogos, más el n.º de postulaciones y la Pyme con la postulación aprobada (si hay). */
    public record LicFila(Long id, Long licitadorId, String titulo, String descripcion, Integer rubroId, Integer regionId, Long presupuestoMin, Long presupuestoMax,
                          Integer maxPostulantes, Integer duracionMeses, String imagenUrl, String archivoUrl, String archivoNombre, String tipoArchivo, LocalDate fechaCierre, String estado,
                          Instant createdAt, long postulantes, Long pymeAdjudicadaId, Integer archivoKb, List<DocFila> adicionales) {}
    /** Documento adicional (tabla documento_licitacion) sin su contenido. */
    public record DocFila(Long id, String nombre, String tipo, int tamanoKb) {}
    /** Documento complementario con su contenido (data URL guardado en archivo_url); contenido null si se publicó sin archivo real. */
    public record ArchivoFila(String nombre, String tipo, String contenido) {}
    public record PostFila(Long id, Long licitacionId, Long pymeId, String mensaje, LocalDate fechaPostulacion, String estado, Instant updatedAt, boolean archivada) {}
    public record NuevaLic(Long licitadorId, String titulo, String descripcion, Integer rubroId, Integer regionId, Long presupuestoMin, Long presupuestoMax,
                           Integer maxPostulantes, Integer duracionMeses, String imagenUrl, String archivoNombre, String tipoArchivo, String archivoContenido, LocalDate fechaCierre,
                           List<NuevoDoc> adicionales) {}
    /** Documento adicional nuevo: contenido = data URL (base64). */
    public record NuevoDoc(String nombre, String tipo, String contenido) {}
    public record NuevaPost(Long licitacionId, Long pymeId, String mensaje) {}
    public record Estado(String estado) {}
    public record Archivo(boolean archivada) {}

    private final LicitacionRepo lics; private final PostulacionRepo posts; private final EstadoLicitacionRepo estadosLic; private final EstadoPostulacionRepo estadosPost;
    private final TipoArchivoRepo tipos; private final DocumentoLicitacionRepo docs;

    public LicitacionesBdController(LicitacionRepo lics, PostulacionRepo posts, EstadoLicitacionRepo estadosLic, EstadoPostulacionRepo estadosPost, TipoArchivoRepo tipos,
                                    DocumentoLicitacionRepo docs) {
        this.lics = lics; this.posts = posts; this.estadosLic = estadosLic; this.estadosPost = estadosPost; this.tipos = tipos; this.docs = docs;
    }

    /** Documentos adicionales de varias licitaciones en una sola consulta (sin leer su contenido). */
    private Map<Long, List<DocFila>> adicionales(Collection<Long> ids) {
        Map<Long, List<DocFila>> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (DocResumen d : docs.resumen(ids))
            out.computeIfAbsent(d.getLicitacionId(), k -> new ArrayList<>()).add(new DocFila(d.getId(), d.getNombre(), d.getTipo() == null ? "Otro" : d.getTipo(), Math.max(1, (int) (d.getLargo() * 3L / 4 / 1024))));
        return out;
    }

    private LicFila fila(Licitacion l) { return fila(l, adicionales(List.of(l.getId())).getOrDefault(l.getId(), List.of())); }
    private LicFila fila(Licitacion l, List<DocFila> adicionales) {
        Long adjudicada = null;
        if ("Adjudicada".equals(l.getEstado().getNombre()))
            adjudicada = posts.findByLicitacionId(l.getId()).stream().filter(p -> "Aprobada".equals(p.getEstado().getNombre())).map(Postulacion::getPymeId).findFirst().orElse(null);
        // El contenido del archivo no viaja en las listas: solo su tamaño; se pide aparte con /archivo.
        String url = l.getArchivoUrl(); boolean conContenido = url != null && url.startsWith("data:");
        Integer kb = conContenido ? Math.max(1, (int) ((url.length() - url.indexOf(',') - 1) * 3L / 4 / 1024)) : null;
        return new LicFila(l.getId(), l.getLicitadorId(), l.getTitulo(), l.getDescripcion(), l.getRubroId(), l.getRegionId(), aLong(l.getPresupuestoMin()), aLong(l.getPresupuestoMax()),
                l.getMaxPostulantes(), l.getDuracionMeses(), l.getImagenUrl(), conContenido ? null : url, l.getArchivoNombre(), l.getTipoArchivo() == null ? null : l.getTipoArchivo().getNombre(), l.getFechaCierre(),
                l.getEstado().getNombre(), l.getCreatedAt(), posts.countByLicitacionId(l.getId()), adjudicada, kb, adicionales);
    }
    private static PostFila fila(Postulacion p) { return new PostFila(p.getId(), p.getLicitacionId(), p.getPymeId(), p.getMensaje(), p.getFechaPostulacion(), p.getEstado().getNombre(), p.getUpdatedAt(), p.isArchivada()); }
    private List<LicFila> filas(Collection<Licitacion> ls) {
        Map<Long, List<DocFila>> ad = adicionales(ls.stream().map(Licitacion::getId).toList());
        return ls.stream().map(l -> fila(l, ad.getOrDefault(l.getId(), List.of()))).toList();
    }
    private static Long aLong(BigDecimal b) { return b == null ? null : b.longValue(); }
    private static BigDecimal aDec(Long l) { return l == null ? null : BigDecimal.valueOf(l); }

    private Licitacion lic(long id) { return lics.findById(id).orElseThrow(() -> ApiException.noEncontrado("Licitación no encontrada")); }
    private Postulacion post(long id) { return posts.findById(id).orElseThrow(() -> ApiException.noEncontrado("Postulación no encontrada")); }
    private TipoArchivo tipo(String n) { return tipos.findByNombre(n == null ? "Otro" : n).orElseGet(() -> tipos.findByNombre("Otro").orElse(null)); }
    private EstadoLicitacion el(String n) { return estadosLic.findByNombre(n).orElseThrow(() -> ApiException.invalido("Estado de licitación inexistente: " + n)); }
    private EstadoPostulacion ep(String n) { return estadosPost.findByNombre(n).orElseThrow(() -> ApiException.invalido("Estado de postulación inexistente: " + n)); }

    // ---------- licitacion ----------
    /** Todas (más reciente primero), o filtradas por licitadorId o por ids. */
    @GetMapping("/licitaciones")
    public List<LicFila> licitaciones(@RequestParam(required = false) Long licitadorId, @RequestParam(required = false) List<Long> ids) {
        if (ids != null) return filas(lics.findAllById(ids));
        return filas(licitadorId != null ? lics.findByLicitadorIdOrderByCreatedAtDesc(licitadorId) : lics.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/licitaciones/buscar")
    public List<LicFila> buscar(@RequestParam(defaultValue = "") String q, @RequestParam(required = false) Integer rubroId, @RequestParam(required = false) Integer regionId,
                                @RequestParam(required = false) Long presupuestoMax) {
        return filas(lics.buscar(q.trim(), rubroId, regionId, aDec(presupuestoMax)));
    }

    @GetMapping("/licitaciones/{id}") public LicFila obtener(@PathVariable long id) { return fila(lic(id)); }

    @GetMapping("/licitaciones/{id}/archivo")
    public ArchivoFila archivo(@PathVariable long id) {
        Licitacion l = lic(id);
        if (l.getArchivoNombre() == null) throw ApiException.noEncontrado("La licitación no tiene documento adjunto");
        String url = l.getArchivoUrl();
        return new ArchivoFila(l.getArchivoNombre(), l.getTipoArchivo() == null ? "Otro" : l.getTipoArchivo().getNombre(), url != null && url.startsWith("data:") ? url : null);
    }

    /** Nueva licitación en estado 'Abierta'. El ER guarda un documento complementario opcional (archivo_url / archivo_nombre / tipo_archivo_id). */
    @PostMapping("/licitaciones") @Transactional
    public LicFila crear(@RequestBody NuevaLic d) {
        Licitacion l = new Licitacion();
        l.setLicitadorId(d.licitadorId()); l.setTitulo(d.titulo()); l.setDescripcion(d.descripcion()); l.setRubroId(d.rubroId()); l.setRegionId(d.regionId());
        l.setPresupuestoMin(aDec(d.presupuestoMin())); l.setPresupuestoMax(aDec(d.presupuestoMax())); l.setMaxPostulantes(d.maxPostulantes()); l.setDuracionMeses(d.duracionMeses()); l.setImagenUrl(d.imagenUrl());
        l.setFechaCierre(d.fechaCierre()); l.setEstado(el("Abierta"));
        if (d.archivoNombre() != null) {
            // archivo_url guarda el archivo como data URL (base64): el ER no tiene otra columna para el contenido.
            l.setArchivoNombre(d.archivoNombre()); l.setArchivoUrl(d.archivoContenido() != null ? d.archivoContenido() : "/archivos/" + d.archivoNombre());
            l.setTipoArchivo(tipo(d.tipoArchivo()));
        }
        l = lics.save(l);
        if (d.adicionales() != null) for (NuevoDoc n : d.adicionales()) guardarDoc(l.getId(), n);
        return fila(l);
    }

    private void guardarDoc(long licitacionId, NuevoDoc n) {
        DocumentoLicitacion doc = new DocumentoLicitacion();
        doc.setLicitacionId(licitacionId); doc.setNombre(n.nombre()); doc.setArchivoUrl(n.contenido()); doc.setTipoArchivo(tipo(n.tipo()));
        docs.save(doc);
    }

    /** Cuántos documentos tiene la licitación en total (el principal más los adicionales). */
    private long totalDocs(Licitacion l) { return (l.getArchivoNombre() == null ? 0 : 1) + docs.countByLicitacionId(l.getId()); }

    // ---------- documento_licitacion ----------
    @GetMapping("/licitaciones/{id}/documentos/{docId}")
    public ArchivoFila documento(@PathVariable long id, @PathVariable long docId) {
        DocumentoLicitacion d = docs.findById(docId).filter(x -> x.getLicitacionId().equals(id)).orElseThrow(() -> ApiException.noEncontrado("Documento no encontrado"));
        return new ArchivoFila(d.getNombre(), d.getTipoArchivo() == null ? "Otro" : d.getTipoArchivo().getNombre(), d.getArchivoUrl());
    }

    /** Agrega un documento adicional; maxTotal = documentos permitidos por licitación contando el principal (lo valida la BS y se repite aquí por si llegan dos a la vez). */
    @PostMapping("/licitaciones/{id}/documentos") @Transactional
    public LicFila agregarDocumento(@PathVariable long id, @RequestParam int maxTotal, @RequestBody NuevoDoc n) {
        Licitacion l = lic(id);
        if (totalDocs(l) >= maxTotal) throw ApiException.conflicto("La licitación ya tiene el máximo de " + maxTotal + " documentos");
        guardarDoc(id, n);
        return fila(l);
    }

    @DeleteMapping("/licitaciones/{id}/documentos/{docId}") @Transactional
    public LicFila quitarDocumento(@PathVariable long id, @PathVariable long docId) {
        DocumentoLicitacion d = docs.findById(docId).filter(x -> x.getLicitacionId().equals(id)).orElseThrow(() -> ApiException.noEncontrado("Documento no encontrado"));
        docs.delete(d); docs.flush();
        return fila(lic(id));
    }

    @PutMapping("/licitaciones/{id}/estado") @Transactional
    public LicFila cambiarEstado(@PathVariable long id, @RequestBody Estado e) { Licitacion l = lic(id); l.setEstado(el(e.estado())); return fila(l); }

    /** Borra la licitación. Si en ese instante una Pyme postuló, la FK postulacion → licitacion lo impide (409). */
    @DeleteMapping("/licitaciones/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void eliminar(@PathVariable long id) {
        try { docs.deleteByLicitacionId(id); lics.delete(lic(id)); lics.flush(); }
        catch (DataIntegrityViolationException e) { throw ApiException.conflicto("Una Pyme acaba de postular a esta licitación, por lo que ya no se puede eliminar."); }
    }

    /** Catálogo estado_postulacion en orden de id (para mostrar los estados reales con su conteo). */
    @GetMapping("/catalogos/estados-postulacion")
    public List<String> estadosPostulacion() { return estadosPost.findAll(org.springframework.data.domain.Sort.by("id")).stream().map(EstadoPostulacion::getNombre).toList(); }

    // ---------- postulacion ----------
    /** Filtradas por licitacionIds, pymeId (más reciente primero) o ids. */
    @GetMapping("/postulaciones")
    public List<PostFila> postulaciones(@RequestParam(required = false) List<Long> licitacionIds, @RequestParam(required = false) Long pymeId, @RequestParam(required = false) List<Long> ids) {
        List<Postulacion> l = ids != null ? posts.findAllById(ids) : pymeId != null ? posts.findByPymeIdOrderByFechaPostulacionDesc(pymeId)
                : licitacionIds != null ? licitacionIds.stream().flatMap(x -> posts.findByLicitacionId(x).stream()).toList() : posts.findAll();
        return l.stream().map(LicitacionesBdController::fila).toList();
    }

    @GetMapping("/postulaciones/{id}") public PostFila postulacion(@PathVariable long id) { return fila(post(id)); }

    /** Cuántas postulaciones hizo una Pyme desde una fecha (cupo mensual), o el total si no se indica la Pyme. */
    @GetMapping("/postulaciones/contar")
    public Map<String, Long> contar(@RequestParam(required = false) Long pymeId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde) {
        return Map.of("total", pymeId == null ? posts.count() : posts.countByPymeIdAndFechaPostulacionGreaterThanEqual(pymeId, desde == null ? LocalDate.EPOCH : desde));
    }

    /** Nueva postulación 'Pendiente'. La restricción única (licitacion_id, pyme_id) evita postular dos veces. */
    @PostMapping("/postulaciones") @Transactional
    public PostFila postular(@RequestBody NuevaPost d) {
        lic(d.licitacionId());
        Postulacion p = new Postulacion();
        p.setLicitacionId(d.licitacionId()); p.setPymeId(d.pymeId()); p.setMensaje(d.mensaje()); p.setEstado(ep("Pendiente"));
        try { return fila(posts.saveAndFlush(p)); }
        catch (DataIntegrityViolationException e) { throw ApiException.conflicto("Ya postulaste a esta licitación"); }
    }

    /**
     * Cambia el estado de una postulación en una sola transacción. ER: al aprobar una, la licitación pasa a 'Adjudicada'
     * y las demás postulaciones pendientes quedan 'Rechazada'.
     */
    @PostMapping("/postulaciones/{id}/decision") @Transactional
    public PostFila decidir(@PathVariable long id, @RequestBody Estado e) {
        Postulacion p = post(id);
        p.setEstado(ep(e.estado()));
        if ("Aprobada".equals(e.estado())) {
            Licitacion l = lic(p.getLicitacionId());
            l.setEstado(el("Adjudicada"));
            for (Postulacion o : posts.findByLicitacionId(l.getId()))
                if (!o.getId().equals(p.getId()) && "Pendiente".equals(o.getEstado().getNombre())) o.setEstado(ep("Rechazada"));
        }
        return fila(p);
    }

    /** Archiva o desarchiva la postulación en la lista de la Pyme (no cambia su estado ni updated_at). */
    @PutMapping("/postulaciones/{id}/archivada") @Transactional
    public PostFila archivar(@PathVariable long id, @RequestBody Archivo a) { Postulacion p = post(id); p.setArchivada(a.archivada()); return fila(p); }

    /** Al eliminar una cuenta: sus licitaciones (con sus postulaciones y documentos) y sus postulaciones. */
    @DeleteMapping("/usuarios/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void eliminarUsuario(@PathVariable long id) {
        for (Licitacion l : lics.findByLicitadorIdOrderByCreatedAtDesc(id)) { posts.deleteByLicitacionId(l.getId()); docs.deleteByLicitacionId(l.getId()); }
        lics.deleteByLicitadorId(id); posts.deleteByPymeId(id);
    }
}
