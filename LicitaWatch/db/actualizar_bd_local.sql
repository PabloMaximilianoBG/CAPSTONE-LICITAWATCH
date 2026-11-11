-- LicitaWatch · pone al día unas bases YA creadas con todas las migraciones, en orden, de una sola vez.
-- Uso (desde la raíz del repo o desde la carpeta de los scripts):
--   psql -U postgres -f db/actualizar_bd_local.sql
-- Se conecta solo a cada base (\c) y ejecuta sus migraciones. Todas se pueden correr más de una vez sin duplicar ni perder datos.
-- Si las bases no existen todavía, no uses este archivo: ejecuta 00 a 05 (ver README.md).

\set ON_ERROR_STOP on

\echo '== licitawatch_usuarios'
\c licitawatch_usuarios
\ir migracion_rut_persona.sql
\ir migracion_ciudades_rm.sql
\ir migracion_foto_perfil.sql
\ir migracion_email_verificado.sql
\ir migracion_ultimo_login.sql
\ir migracion_terminos_legales.sql
\ir migracion_seguridad_fase1.sql

\echo '== licitawatch_licitaciones'
\c licitawatch_licitaciones
\ir migracion_postulacion_archivada.sql
\ir migracion_documentos_licitacion.sql
\ir migracion_duracion_licitacion.sql
\ir migracion_documentos_postulacion.sql

\echo '== licitawatch_ventas'
\c licitawatch_ventas
\ir migracion_precio_planes.sql

\echo '== licitawatch_chat'
\c licitawatch_chat
\ir migracion_chat_eliminar.sql

\echo '== licitawatch_notificaciones'
\c licitawatch_notificaciones
\ir migracion_tipo_licitacion_rubro.sql

\echo 'Listo: las 5 bases quedaron al día.'
