-- Migración: una licitación puede tener varios documentos (hasta 5 contando el principal que ya guarda licitacion.archivo_url).
-- Uso:  psql -U postgres -d licitawatch_licitaciones -f db/migracion_documentos_licitacion.sql   (se puede ejecutar más de una vez)
-- Nota: ms-licitaciones también crea la tabla al iniciar (ddl-auto: update), pero sin el ON DELETE CASCADE; este script lo deja igual que 02_licitaciones.sql.
-- Las licitaciones existentes no cambian: su documento sigue siendo el principal.

CREATE TABLE IF NOT EXISTS documento_licitacion (
  id               BIGSERIAL PRIMARY KEY,
  licitacion_id    BIGINT  NOT NULL REFERENCES licitacion(id) ON DELETE CASCADE,
  nombre           VARCHAR(255) NOT NULL,
  archivo_url      TEXT    NOT NULL,
  tipo_archivo_id  INTEGER REFERENCES tipo_archivo(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_doc_lic ON documento_licitacion(licitacion_id);

-- Si Hibernate ya la creó, le faltan la FK y el CASCADE: se agregan (no hace nada si ya existen).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'documento_licitacion'::regclass AND contype = 'f' AND confrelid = 'licitacion'::regclass) THEN
    ALTER TABLE documento_licitacion ADD CONSTRAINT fk_doc_lic FOREIGN KEY (licitacion_id) REFERENCES licitacion(id) ON DELETE CASCADE;
  END IF;
END $$;
