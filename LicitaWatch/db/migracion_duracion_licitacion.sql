-- Migración: duración del contrato de la licitación (meses que trabajará la Pyme adjudicada).
-- Uso:  psql -U postgres -d licitawatch_licitaciones -f db/migracion_duracion_licitacion.sql   (se puede ejecutar más de una vez)
-- Las licitaciones ya publicadas quedan con duracion_meses vacío; las nuevas la exigen al publicar (1 a 120 meses).

ALTER TABLE licitacion ADD COLUMN IF NOT EXISTS duracion_meses INTEGER;

-- Si Hibernate ya creó la columna, le falta el CHECK: se agrega (no hace nada si ya existe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'licitacion'::regclass AND conname = 'ck_duracion') THEN
    ALTER TABLE licitacion ADD CONSTRAINT ck_duracion CHECK (duracion_meses IS NULL OR duracion_meses BETWEEN 1 AND 120);
  END IF;
END $$;
