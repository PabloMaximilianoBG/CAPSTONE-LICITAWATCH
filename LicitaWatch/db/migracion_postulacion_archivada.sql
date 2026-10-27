-- Migración: la Pyme puede archivar sus postulaciones para ordenar «Mis postulaciones» (solo afecta su vista).
-- Uso:  psql -U postgres -d licitawatch_licitaciones -f db/migracion_postulacion_archivada.sql   (se puede ejecutar más de una vez)
-- Nota: ms-licitaciones también la crea solo al iniciar (ddl-auto: update). Las postulaciones existentes quedan sin archivar.

ALTER TABLE postulacion ADD COLUMN IF NOT EXISTS archivada BOOLEAN NOT NULL DEFAULT FALSE;
