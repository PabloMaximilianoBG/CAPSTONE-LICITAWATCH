-- Migración · Configuración > Seguridad, fase 1: fecha del último cambio de contraseña.
-- Uso:  psql -U postgres -d licitawatch_usuarios -f db/migracion_seguridad_fase1.sql   (se puede ejecutar más de una vez)
-- Nota: ms-usuarios también la crea al iniciar (ddl-auto: update). Las cuentas existentes quedan en NULL
-- («Sin cambios desde el registro») hasta que cambien o restablezcan su contraseña.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS password_actualizada_at TIMESTAMPTZ;
