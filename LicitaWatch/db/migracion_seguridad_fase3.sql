-- Migración · Configuración > Seguridad, fase 3: autenticación de dos factores (TOTP) y códigos de recuperación.
-- Uso:  psql -U postgres -d licitawatch_usuarios -f db/migracion_seguridad_fase3.sql   (se puede ejecutar más de una vez)
-- Nota: ms-usuarios también crea las columnas y la tabla al iniciar (ddl-auto: update), pero sin la FK con CASCADE; este script las deja igual que 01_usuarios.sql.
-- Todas las cuentas existentes quedan con la 2FA desactivada.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_activo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_secreto_cifrado TEXT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_activado_at TIMESTAMPTZ;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_bloqueado_hasta TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS usuario_codigo_recuperacion (   -- 1 usuario -> 8 códigos de recuperación de la 2FA (de un solo uso)
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  codigo_hash  VARCHAR(100) NOT NULL,                 -- BCrypt del código (el código en claro solo se muestra una vez)
  usado_at     TIMESTAMPTZ                            -- NULL = disponible
);
CREATE INDEX IF NOT EXISTS ix_codigo_rec_usuario ON usuario_codigo_recuperacion(usuario_id);

-- Si Hibernate ya creó la tabla, le falta la FK con CASCADE: se agrega (no hace nada si ya existe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'usuario_codigo_recuperacion'::regclass AND contype = 'f') THEN
    ALTER TABLE usuario_codigo_recuperacion ADD CONSTRAINT fk_codigo_rec_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE;
  END IF;
END $$;
