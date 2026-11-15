package cl.licitawatch.usuarios.bd;

import cl.licitawatch.usuarios.bd.Catalogos.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public final class Repos {
    private Repos() {}
    public interface RolRepo extends JpaRepository<Rol, Integer> { Optional<Rol> findByNombre(String nombre); }
    public interface UsuarioRepo extends JpaRepository<Usuario, Long> {
        Optional<Usuario> findByEmailIgnoreCase(String email);
        boolean existsByEmailIgnoreCase(String email);
        long countByRol_Nombre(String rol);
        long countByActivoFalse();
        /** Guarda el secreto 2FA pendiente solo si no hay otro (atómico: si llegan dos activaciones a la vez, gana una sola). */
        @Modifying(clearAutomatically = true) @Query("update Usuario u set u.totpSecretoCifrado = :secreto where u.id = :id and u.totpSecretoCifrado is null")
        int fijarSecretoSiVacio(@Param("id") Long id, @Param("secreto") String secretoCifrado);
    }
    public interface CodigoRecuperacionRepo extends JpaRepository<CodigoRecuperacion, Long> {
        List<CodigoRecuperacion> findByUsuarioIdAndUsadoAtIsNull(Long usuarioId);
        long countByUsuarioIdAndUsadoAtIsNull(Long usuarioId);
        void deleteByUsuarioId(Long usuarioId);
    }
    public interface SesionUsuarioRepo extends JpaRepository<SesionUsuario, Long> {
        Optional<SesionUsuario> findByTokenId(String tokenId);
        /** Sesiones vigentes de un usuario (no cerradas y sin vencer), la de uso más reciente primero. */
        List<SesionUsuario> findByUsuarioIdAndRevocadaAtIsNullAndExpiraAtAfterOrderByUltimoUsoAtDesc(Long usuarioId, Instant ahora);
        /** Último uso: se escribe solo si el anterior tiene más de 5 minutos (no se carga la BD en cada petición). */
        @Modifying @Query("update SesionUsuario s set s.ultimoUsoAt = :ahora where s.tokenId = :token and s.ultimoUsoAt < :antesDe")
        int tocar(@Param("token") String tokenId, @Param("ahora") Instant ahora, @Param("antesDe") Instant antesDe);
        @Modifying @Query("update SesionUsuario s set s.revocadaAt = :ahora where s.usuarioId = :usuario and s.revocadaAt is null")
        int revocarTodas(@Param("usuario") Long usuarioId, @Param("ahora") Instant ahora);
        @Modifying @Query("update SesionUsuario s set s.revocadaAt = :ahora where s.usuarioId = :usuario and s.revocadaAt is null and s.tokenId <> :excepto")
        int revocarOtras(@Param("usuario") Long usuarioId, @Param("excepto") String exceptoTokenId, @Param("ahora") Instant ahora);
        @Modifying @Query("delete from SesionUsuario s where s.expiraAt < :limite or s.revocadaAt < :limite")
        int borrarVencidas(@Param("limite") Instant limite);
        void deleteByUsuarioId(Long usuarioId);
    }
    public interface AdministradorRepo extends JpaRepository<Administrador, Long> { Optional<Administrador> findByUsuarioId(Long usuarioId); void deleteByUsuarioId(Long usuarioId); }
    public interface LicitadorRepo extends JpaRepository<Licitador, Long> { Optional<Licitador> findByUsuarioId(Long usuarioId); boolean existsByRut(String rut); boolean existsByRutPersona(String rutPersona); void deleteByUsuarioId(Long usuarioId); }
    public interface PymeRepo extends JpaRepository<Pyme, Long> { Optional<Pyme> findByUsuarioId(Long usuarioId); List<Pyme> findByRubroId(Integer rubroId); boolean existsByRut(String rut); boolean existsByRutPersona(String rutPersona); void deleteByUsuarioId(Long usuarioId); }
    public interface RubroRepo extends JpaRepository<Rubro, Integer> { List<Rubro> findAllByOrderByNombre(); }
    public interface RegionRepo extends JpaRepository<Region, Integer> { List<Region> findAllByOrderByNombre(); }
    public interface CiudadRepo extends JpaRepository<Ciudad, Integer> { List<Ciudad> findAllByOrderByNombre(); List<Ciudad> findByRegionIdOrderByNombre(Integer regionId); }
    public interface TamanoRepo extends JpaRepository<TamanoEmpresa, Integer> { List<TamanoEmpresa> findAllByOrderByIdAsc(); }
}
