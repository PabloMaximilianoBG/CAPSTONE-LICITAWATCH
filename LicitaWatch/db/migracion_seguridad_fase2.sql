-- Migración · Configuración > Seguridad, fase 2: sesiones de los usuarios (listar, cerrar una, cerrar las demás).
-- Uso:  psql -U postgres -d licitawatch_usuarios -f db/migracion_seguridad_fase2.sql   (se puede ejecutar más de una vez)
-- Nota: ms-usuarios también crea la tabla al iniciar (ddl-auto: update), pero sin la FK con CASCADE; este script la deja igual que 01_usuarios.sql.
-- Las sesiones abiertas antes de esta migración (tokens sin identificador) siguen válidas hasta que vencen (12 h) y no aparecen en la lista.

CREATE TABLE IF NOT EXISTS sesion_usuario (         -- 1 usuario -> N sesiones (una por inicio de sesión)
  id             BIGSERIAL PRIMARY KEY,
  usuario_id     BIGINT  NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  token_id       VARCHAR(64) NOT NULL,                -- identificador (jti) del JWT de la sesión; el token no se guarda
  dispositivo    VARCHAR(80),                         -- derivado del User-Agent, p. ej. «Windows · Computador»
  navegador      VARCHAR(80),                         -- derivado del User-Agent, p. ej. «Chrome»
  ip             VARCHAR(45),                         -- IP de origen al iniciar sesión (IPv4 o IPv6)
  creada_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- se actualiza como mucho cada 5 minutos
  expira_at      TIMESTAMPTZ NOT NULL,                -- vencimiento del JWT (para limpiar las sesiones vencidas)
  revocada_at    TIMESTAMPTZ,                         -- NULL = vigente; con fecha = cerrada (logout, «Cerrar» o cambio de contraseña)
  CONSTRAINT uq_sesion_token UNIQUE (token_id)
);
CREATE INDEX IF NOT EXISTS ix_sesion_usuario ON sesion_usuario(usuario_id);

-- Si Hibernate ya creó la tabla, le falta la FK con CASCADE: se agrega (no hace nada si ya existe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sesion_usuario'::regclass AND contype = 'f') THEN
    ALTER TABLE sesion_usuario ADD CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE;
  END IF;
END $$;
