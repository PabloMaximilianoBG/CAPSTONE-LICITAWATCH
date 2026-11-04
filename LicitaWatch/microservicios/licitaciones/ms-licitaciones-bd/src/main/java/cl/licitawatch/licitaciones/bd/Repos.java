package cl.licitawatch.licitaciones.bd;

import cl.licitawatch.licitaciones.bd.Catalogos.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public final class Repos {
    private Repos() {}

    public interface EstadoLicitacionRepo extends JpaRepository<EstadoLicitacion, Integer> { Optional<EstadoLicitacion> findByNombre(String n); }
    public interface EstadoPostulacionRepo extends JpaRepository<EstadoPostulacion, Integer> { Optional<EstadoPostulacion> findByNombre(String n); }
    public interface TipoArchivoRepo extends JpaRepository<TipoArchivo, Integer> { Optional<TipoArchivo> findByNombre(String n); }

    public interface LicitacionRepo extends JpaRepository<Licitacion, Long> {
        List<Licitacion> findByLicitadorIdOrderByCreatedAtDesc(Long licitadorId);
        List<Licitacion> findAllByOrderByCreatedAtDesc();
        void deleteByLicitadorId(Long licitadorId);

        @Query("""
            select l from Licitacion l where (:rubro is null or l.rubroId = :rubro)
              and (:region is null or l.regionId = :region) and (:maxP is null or l.presupuestoMin is null or l.presupuestoMin <= :maxP)
              and (:q = '' or lower(l.titulo) like lower(concat('%', :q, '%')) or lower(l.descripcion) like lower(concat('%', :q, '%')))
            order by l.createdAt desc""")
        List<Licitacion> buscar(@Param("q") String q, @Param("rubro") Integer rubro, @Param("region") Integer region, @Param("maxP") BigDecimal maxP);
    }

    /** Datos de un documento adicional sin su contenido (largo = caracteres del data URL, para calcular el tamaño). */
    public interface DocResumen { Long getId(); Long getLicitacionId(); String getNombre(); String getTipo(); Integer getLargo(); }

    public interface DocumentoLicitacionRepo extends JpaRepository<DocumentoLicitacion, Long> {
        @Query("""
            select d.id as id, d.licitacionId as licitacionId, d.nombre as nombre, t.nombre as tipo, length(d.archivoUrl) as largo
            from DocumentoLicitacion d left join d.tipoArchivo t where d.licitacionId in :ids order by d.id""")
        List<DocResumen> resumen(@Param("ids") Collection<Long> ids);
        long countByLicitacionId(Long licitacionId);
        void deleteByLicitacionId(Long licitacionId);
    }

    public interface PostulacionRepo extends JpaRepository<Postulacion, Long> {
        List<Postulacion> findByLicitacionId(Long licitacionId);
        List<Postulacion> findByPymeIdOrderByFechaPostulacionDesc(Long pymeId);
        Optional<Postulacion> findByLicitacionIdAndPymeId(Long licitacionId, Long pymeId);
        long countByLicitacionId(Long licitacionId);
        long countByPymeIdAndFechaPostulacionGreaterThanEqual(Long pymeId, LocalDate desde);
        void deleteByPymeId(Long pymeId);
        void deleteByLicitacionId(Long licitacionId);
    }
}
