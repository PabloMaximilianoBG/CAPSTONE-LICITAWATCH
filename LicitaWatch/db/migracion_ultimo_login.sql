-- Migración: último acceso (inicio de sesión) en la tabla usuario. Lo muestra el administrador en «Usuarios».
-- Uso:  psql -U postgres -d licitawatch_usuarios -f db/migracion_ultimo_login.sql   (se puede ejecutar más de una vez)
-- Nota: ms-usuarios también la crea solo al iniciar (ddl-auto: update). Las cuentas existentes quedan en NULL («Nunca») hasta su próximo login.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;
