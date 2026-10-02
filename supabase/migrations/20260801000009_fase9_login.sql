-- =====================================================================
-- POLO AIR COOL · FASE 9 · LÍMITE DE INTENTOS DE INGRESO (LOGIN)
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable).
--
-- Cuenta los intentos fallidos de ingreso y bloquea un rato a quien insiste, para frenar que alguien
-- pruebe contraseñas una tras otra. Supabase Auth ya limita las peticiones por dirección IP; esto añade un
-- límite por correo y por correo + IP, y la pantalla de ingreso lo aplica ANTES de preguntarle a Supabase.
--
--   login_intentos : un contador por «clave». La clave es una HUELLA (HMAC) del correo y/o de la IP: nunca
--                    se guarda el correo ni la IP en claro.
--
-- Solo el servidor, con la clave de servicio, toca la tabla y las funciones (RLS activado sin políticas y
-- ejecución revocada a los usuarios). Si esta migración no está ejecutada, el ingreso funciona igual,
-- sin este límite adicional.
-- =====================================================================

create table if not exists public.login_intentos (
  clave            text primary key,
  fallos           integer not null default 0,
  -- Inicio de la ventana de conteo actual.
  desde            timestamptz not null default now(),
  bloqueado_hasta  timestamptz
);
comment on table public.login_intentos is 'Intentos fallidos de ingreso por huella de correo / IP (solo el servidor, con service role).';

alter table public.login_intentos enable row level security;
revoke all on public.login_intentos from anon, authenticated;

-- Anota un intento fallido. Si dentro de la ventana se llega a p_max, bloquea hasta ahora + p_bloqueo_seg.
-- Es atómica (un solo upsert): dos intentos simultáneos no se «pisan» el conteo. Devuelve el bloqueo vigente
-- (o null). Una ventana ya vencida (y sin bloqueo vigente) empieza de nuevo en 1.
create or replace function public.registrar_fallo_login(
  p_clave text,
  p_max integer,
  p_ventana_seg integer,
  p_bloqueo_seg integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.login_intentos;
begin
  -- Limpieza oportunista de contadores viejos (la tabla es pequeña).
  delete from public.login_intentos
   where desde < now() - interval '1 day'
     and (bloqueado_hasta is null or bloqueado_hasta < now());

  insert into public.login_intentos as t (clave, fallos, desde)
  values (p_clave, 1, now())
  on conflict (clave) do update
     set fallos = case
           when t.desde < now() - make_interval(secs => p_ventana_seg)
                and (t.bloqueado_hasta is null or t.bloqueado_hasta <= now())
             then 1 else t.fallos + 1 end,
         desde = case
           when t.desde < now() - make_interval(secs => p_ventana_seg)
                and (t.bloqueado_hasta is null or t.bloqueado_hasta <= now())
             then now() else t.desde end
  returning * into v;

  if v.fallos >= p_max and (v.bloqueado_hasta is null or v.bloqueado_hasta <= now()) then
    update public.login_intentos
       set bloqueado_hasta = now() + make_interval(secs => p_bloqueo_seg)
     where clave = p_clave
     returning bloqueado_hasta into v.bloqueado_hasta;
  end if;

  return case when v.bloqueado_hasta > now() then v.bloqueado_hasta end;
end $$;

-- ¿Alguna de estas claves está bloqueada ahora? Devuelve el bloqueo que dura más (o null).
create or replace function public.login_bloqueado(p_claves text[])
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select max(bloqueado_hasta)
    from public.login_intentos
   where clave = any(p_claves)
     and bloqueado_hasta > now();
$$;

-- Un ingreso correcto borra el contador de esa clave.
create or replace function public.limpiar_login(p_clave text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.login_intentos where clave = p_clave;
$$;

revoke all on function public.registrar_fallo_login(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.login_bloqueado(text[])                               from public, anon, authenticated;
revoke all on function public.limpiar_login(text)                                    from public, anon, authenticated;
grant execute on function public.registrar_fallo_login(text, integer, integer, integer) to service_role;
grant execute on function public.login_bloqueado(text[])                               to service_role;
grant execute on function public.limpiar_login(text)                                    to service_role;

-- =====================================================================
-- FIN · Fase 9
--
-- Si alguna vez un usuario legítimo queda bloqueado y no quiere esperar, en el SQL Editor:
--   delete from public.login_intentos;
-- =====================================================================
