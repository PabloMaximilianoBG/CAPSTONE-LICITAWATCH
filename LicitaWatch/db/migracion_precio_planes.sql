-- LicitaWatch · migración: precio de los planes configurable por el administrador, con auditoría.
-- psql -U postgres -d licitawatch_ventas -f migracion_precio_planes.sql
ALTER TABLE plan_suscripcion ADD COLUMN IF NOT EXISTS precio_mensual INTEGER;
UPDATE plan_suscripcion SET precio_mensual = 0     WHERE nombre = 'Estándar' AND precio_mensual IS NULL;
UPDATE plan_suscripcion SET precio_mensual = 24990 WHERE nombre = 'Premium'  AND precio_mensual IS NULL;

CREATE TABLE IF NOT EXISTS plan_precio_historial (
  id              BIGSERIAL PRIMARY KEY,
  plan_id         INTEGER NOT NULL REFERENCES plan_suscripcion(id),
  precio_anterior INTEGER,
  precio_nuevo    INTEGER NOT NULL,
  usuario_id      BIGINT  NOT NULL,
  motivo          VARCHAR(200),
  fecha           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_precio_hist_plan ON plan_precio_historial(plan_id);
