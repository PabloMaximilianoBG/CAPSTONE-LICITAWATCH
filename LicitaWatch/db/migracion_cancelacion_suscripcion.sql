-- Migración: fecha en que la Pyme cancela su suscripción (se muestra en «Historial de pagos» como «Cancelada»).
-- Uso:  psql -U postgres -d licitawatch_ventas -f db/migracion_cancelacion_suscripcion.sql   (se puede ejecutar más de una vez)
-- Nota: ms-ventas también crea la columna al iniciar (ddl-auto: update). Las cancelaciones anteriores quedan sin fecha y no aparecen en el historial.

ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS cancelada_at TIMESTAMPTZ;
