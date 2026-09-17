-- ============================================================
-- MIGRACIÓN DE SEGURIDAD — Sistema Mantenimiento
-- Proyecto Supabase: vbbrhzclzrpwzlbqmsvk
--
-- El auto-modo de Claude Code bloqueó la aplicación automática de este
-- script por tratarse de un cambio de seguridad/autenticación en
-- producción ("Production Deploy"). Cópialo y ejecútalo tú mismo en:
-- Supabase Dashboard > SQL Editor > New query > pega todo > Run.
--
-- Es seguro ejecutarlo completo de una sola vez. No borra datos.
-- Después de ejecutarlo, avísame para actualizar Login.jsx y así
-- el login use la función segura en vez de leer la contraseña
-- directamente (ver notas al final del archivo).
--
-- Nota: en Supabase, pgcrypto (crypt/gen_salt) vive en el esquema
-- "extensions", no en "public". Las funciones de abajo ya incluyen
-- "extensions" en su search_path por eso. Si esto falló antes con el
-- error "function crypt(...) does not exist", ya está corregido: como
-- Supabase corre todo el script como una sola transacción, ese error
-- anterior revirtió todo (no quedó nada a medias) — puedes volver a
-- pegar el archivo completo sin problema.
-- ============================================================

-- PARTE 1: Dejar de guardar contraseñas en texto plano
-- --------------------------------------------------------------
create extension if not exists pgcrypto;

-- Hashea cualquier contraseña que hoy esté en texto plano (idempotente:
-- si ya está hasheada con bcrypt, no la vuelve a tocar).
update usuarios
set password = crypt(password, gen_salt('bf'))
where password is not null and password !~ '^\$2[aby]\$';

-- A partir de ahora, cualquier alta/edición de usuario (ej: cuando
-- Gerencia crea un usuario o resetea una contraseña) se hashea sola,
-- sin necesidad de tocar el código del frontend.
create or replace function hash_password_trigger() returns trigger as $$
begin
  if new.password is not null and new.password !~ '^\$2[aby]\$' then
    new.password := crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists trg_hash_password on usuarios;
create trigger trg_hash_password
before insert or update of password on usuarios
for each row execute function hash_password_trigger();

-- Función de login: compara el hash DENTRO del servidor y jamás
-- devuelve la contraseña (ni el hash) al navegador.
create or replace function login_usuario(p_nombre text, p_password text)
returns table (
  id integer,
  nombre varchar,
  rol varchar,
  estaciones varchar,
  permiso_dashboard boolean,
  permiso_soluciones boolean,
  permiso_inventario boolean,
  permiso_config boolean,
  permiso_editar_reportes boolean,
  permiso_grifos boolean,
  permiso_unidades boolean
)
language sql
security definer
set search_path = public, extensions
as $$
  select u.id, u.nombre, u.rol, u.estaciones, u.permiso_dashboard, u.permiso_soluciones,
         u.permiso_inventario, u.permiso_config, u.permiso_editar_reportes, u.permiso_grifos, u.permiso_unidades
  from usuarios u
  where u.nombre = p_nombre
    and u.password = crypt(p_password, u.password)
  limit 1;
$$;

revoke all on function login_usuario(text, text) from public;
grant execute on function login_usuario(text, text) to anon, authenticated;


-- PARTE 2: Activar Row Level Security en las 9 tablas
-- --------------------------------------------------------------
-- IMPORTANTE (léelo): esto cierra la alerta CRÍTICA de Supabase
-- ("RLS Disabled in Public"), pero como el sistema usa su propio login
-- (no Supabase Auth), Postgres no puede hoy distinguir si quien pregunta
-- es un Operario o Gerencia: ambos usan la misma llave pública (anon).
-- Por eso estas políticas son "permisivas" — replican EXACTAMENTE el
-- acceso que ya existe hoy, para no romper nada en producción.
--
-- Lo que SÍ mejora de verdad con esta migración: ya nadie puede leer
-- contraseñas en texto plano (quedan hasheadas con bcrypt y fuera del
-- alcance normal de la app).
--
-- Para que "solo Gerencia pueda editar usuarios/permisos" se cumpla
-- también a nivel de base de datos (no solo en el código del frontend),
-- se necesita migrar a autenticación real de Supabase (sesiones con
-- JWT), para que las políticas puedan leer el rol desde el token. Es un
-- proyecto aparte — puedo ayudarte a planearlo cuando quieras.

alter table usuarios enable row level security;
alter table estaciones enable row level security;
alter table islas_lados enable row level security;
alter table inventario enable row level security;
alter table mantenimiento_tipos enable row level security;
alter table reportes enable row level security;
alter table inventario_movimientos enable row level security;
alter table unidades_tractos enable row level security;
alter table unidades_carretas enable row level security;

drop policy if exists "acceso_actual_usuarios" on usuarios;
create policy "acceso_actual_usuarios" on usuarios for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_estaciones" on estaciones;
create policy "acceso_actual_estaciones" on estaciones for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_islas_lados" on islas_lados;
create policy "acceso_actual_islas_lados" on islas_lados for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_inventario" on inventario;
create policy "acceso_actual_inventario" on inventario for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_mantenimiento_tipos" on mantenimiento_tipos;
create policy "acceso_actual_mantenimiento_tipos" on mantenimiento_tipos for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_reportes" on reportes;
create policy "acceso_actual_reportes" on reportes for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_inventario_movimientos" on inventario_movimientos;
create policy "acceso_actual_inventario_movimientos" on inventario_movimientos for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_unidades_tractos" on unidades_tractos;
create policy "acceso_actual_unidades_tractos" on unidades_tractos for all to anon, authenticated using (true) with check (true);

drop policy if exists "acceso_actual_unidades_carretas" on unidades_carretas;
create policy "acceso_actual_unidades_carretas" on unidades_carretas for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- DESPUÉS DE EJECUTAR ESTO:
-- Avísame ("ya corrí el SQL") y actualizo Login.jsx para que en vez de:
--    supabase.from('usuarios').select('*').eq('nombre', ...)
-- use:
--    supabase.rpc('login_usuario', { p_nombre: ..., p_password: ... })
-- y hago un nuevo build. Sin ese cambio de código, el login actual
-- (que compara la contraseña en el navegador) dejará de funcionar
-- en cuanto las contraseñas queden hasheadas, así que hazlo todo en
-- la misma sesión de trabajo, no lo dejes a medias.
-- ============================================================
