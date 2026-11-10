-- Migración: el Licitador pide documentos al publicar y la Pyme los sube al postular.
-- Uso:  psql -U postgres -d licitawatch_licitaciones -f db/migracion_documentos_postulacion.sql   (se puede ejecutar más de una vez)
-- Nota: ms-licitaciones también crea las tablas al iniciar (ddl-auto: update), pero sin FK ni CASCADE; este script las deja igual que 02_licitaciones.sql.
-- Las licitaciones y postulaciones existentes no cambian: quedan sin documentos pedidos ni subidos.

CREATE TABLE IF NOT EXISTS licitacion_documento_requerido (   -- 1 licitación -> N documentos que el Licitador pide a las Pymes
  id             BIGSERIAL PRIMARY KEY,
  licitacion_id  BIGINT  NOT NULL REFERENCES licitacion(id) ON DELETE CASCADE,
  nombre         VARCHAR(160) NOT NULL,                   -- p. ej. «Certificado F30», «Referencias de obras»
  obligatorio    BOOLEAN NOT NULL DEFAULT TRUE            -- FALSE = la Pyme puede postular sin subirlo
);
CREATE INDEX IF NOT EXISTS ix_doc_req_lic ON licitacion_documento_requerido(licitacion_id);

CREATE TABLE IF NOT EXISTS postulacion_documento (        -- 1 postulación -> N documentos que subió la Pyme
  id               BIGSERIAL PRIMARY KEY,
  postulacion_id   BIGINT  NOT NULL REFERENCES postulacion(id) ON DELETE CASCADE,
  requisito_id     BIGINT  REFERENCES licitacion_documento_requerido(id) ON DELETE SET NULL,  -- documento pedido al que responde
  nombre_archivo   VARCHAR(255) NOT NULL,                 -- nombre original del archivo
  archivo_url      TEXT    NOT NULL,                      -- contenido del archivo (data URL base64), como documento_licitacion
  tipo_archivo_id  INTEGER REFERENCES tipo_archivo(id),
  fecha_subida     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_post_doc_req UNIQUE (postulacion_id, requisito_id)
);
CREATE INDEX IF NOT EXISTS ix_post_doc_post ON postulacion_documento(postulacion_id);

-- Si Hibernate ya creó las tablas, les faltan las FK, el CASCADE y la restricción única: se agregan (no hace nada si ya existen).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'licitacion_documento_requerido'::regclass AND contype = 'f') THEN
    ALTER TABLE licitacion_documento_requerido ADD CONSTRAINT fk_doc_req_lic FOREIGN KEY (licitacion_id) REFERENCES licitacion(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'postulacion_documento'::regclass AND contype = 'f' AND confrelid = 'postulacion'::regclass) THEN
    ALTER TABLE postulacion_documento ADD CONSTRAINT fk_post_doc_post FOREIGN KEY (postulacion_id) REFERENCES postulacion(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'postulacion_documento'::regclass AND contype = 'f' AND confrelid = 'licitacion_documento_requerido'::regclass) THEN
    ALTER TABLE postulacion_documento ADD CONSTRAINT fk_post_doc_req FOREIGN KEY (requisito_id) REFERENCES licitacion_documento_requerido(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'postulacion_documento'::regclass AND contype = 'f' AND confrelid = 'tipo_archivo'::regclass) THEN
    ALTER TABLE postulacion_documento ADD CONSTRAINT fk_post_doc_tipo FOREIGN KEY (tipo_archivo_id) REFERENCES tipo_archivo(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'postulacion_documento'::regclass AND conname = 'uq_post_doc_req') THEN
    ALTER TABLE postulacion_documento ADD CONSTRAINT uq_post_doc_req UNIQUE (postulacion_id, requisito_id);
  END IF;
END $$;

-- Las Pymes también pueden subir imágenes (JPG/PNG).
INSERT INTO tipo_archivo (nombre) VALUES ('JPG'), ('PNG') ON CONFLICT DO NOTHING;
