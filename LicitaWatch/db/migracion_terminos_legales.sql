-- Migración: registro de aceptación y versiones de Términos y Condiciones y Política de Privacidad (licitawatch_usuarios).
-- Uso:  psql -U postgres -d licitawatch_usuarios -f db/migracion_terminos_legales.sql   (se puede ejecutar más de una vez)
-- Nota: ms-usuarios-bd también sincroniza las columnas al iniciar (ddl-auto: update).

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS acepta_terminos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS version_terminos VARCHAR(32) NOT NULL DEFAULT '1.0';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS version_politica VARCHAR(32) NOT NULL DEFAULT '1.0';

CREATE TABLE IF NOT EXISTS config_legal (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  url_terminos     VARCHAR(512) DEFAULT '/terminos-y-condiciones',
  url_politica     VARCHAR(512) DEFAULT '/politica-de-privacidad',
  version_terminos VARCHAR(32) NOT NULL DEFAULT '1.0',
  version_politica VARCHAR(32) NOT NULL DEFAULT '1.0'
);

ALTER TABLE config_legal ADD COLUMN IF NOT EXISTS version_terminos VARCHAR(32) NOT NULL DEFAULT '1.0';
ALTER TABLE config_legal ADD COLUMN IF NOT EXISTS version_politica VARCHAR(32) NOT NULL DEFAULT '1.0';

INSERT INTO config_legal (id, url_terminos, url_politica, version_terminos, version_politica)
VALUES (1, '/terminos-y-condiciones', '/politica-de-privacidad', '1.0', '1.0')
ON CONFLICT (id) DO NOTHING;

