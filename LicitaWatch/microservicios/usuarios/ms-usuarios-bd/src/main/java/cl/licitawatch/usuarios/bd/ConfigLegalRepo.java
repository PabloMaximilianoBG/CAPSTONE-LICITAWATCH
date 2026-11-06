package cl.licitawatch.usuarios.bd;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio singleton para la configuración legal (siempre id = 1). */
public interface ConfigLegalRepo extends JpaRepository<ConfigLegal, Integer> {}
