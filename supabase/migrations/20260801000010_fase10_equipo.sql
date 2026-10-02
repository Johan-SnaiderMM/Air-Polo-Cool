-- =====================================================================
-- POLO AIR COOL · FASE 10 · EQUIPO: UN PERFIL POR PERSONA
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere las fases 1 a 9.
--
-- Hasta ahora el «autor» de cada registro era uno de dos nombres fijos («Polo» o «Soporte técnico») y lo
-- mandaba el teléfono. Con ayudantes que tienen su propio usuario hace falta saber QUIÉN registró cada
-- cosa, y que no se pueda falsear.
--
--   perfiles : una fila por usuario con su nombre visible, rol, si está activo y si es soporte. Solo la
--              crea y cambia el servidor (service role); la app únicamente la lee.
--   autor    : ahora es el NOMBRE del perfil de quien inició sesión. Lo estampa la base al insertar (un
--              trigger por tabla): lo que mande el teléfono se ignora si la persona tiene perfil.
--   activo   : desactivar a alguien corta su acceso a los datos de inmediato (es_staff() / es_admin()
--              lo comprueban), sin borrar nada de su historial.
--
-- Lo ya registrado conserva «Polo» o «Soporte técnico». Esta migración crea el perfil de los usuarios
-- que ya existen: el de soporte como «Soporte técnico» y el otro como «Polo».
-- =====================================================================


-- =====================================================================
-- 1. PERFILES
-- =====================================================================
create table if not exists public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null check (char_length(btrim(nombre)) between 2 and 40),
  correo          text,
  rol             text not null check (rol in ('admin', 'operario')),
  es_soporte      boolean not null default false,
  activo          boolean not null default true,
  creado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  desactivado_at  timestamptz,
  -- «Soporte técnico» es el sello de la cuenta de soporte: nadie más puede llamarse así.
  constraint chk_perfiles_nombre_soporte check (es_soporte or lower(btrim(nombre)) <> 'soporte técnico')
);
comment on table public.perfiles is 'Una fila por persona con acceso: nombre visible (sello de autoría), rol y estado. Solo el servidor la escribe.';

-- Dos personas no pueden llamarse igual (ni «polo» y «Polo»): el sello debe identificar a una sola.
create unique index if not exists ux_perfiles_nombre on public.perfiles (lower(btrim(nombre)));

alter table public.perfiles enable row level security;


-- =====================================================================
-- 2. ROLES: un usuario desactivado deja de ser staff
-- =====================================================================
-- Pasan a SECURITY DEFINER para poder leer `perfiles` sin que la política de esa tabla (que usa
-- es_staff) se llame a sí misma. Sin perfil, el acceso depende solo del rol del JWT, como antes: solo
-- una desactivación EXPLÍCITA lo corta.
create or replace function public.es_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') in ('admin', 'operario'), false)
     and not exists (select 1 from public.perfiles where id = auth.uid() and not activo);
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin', false)
     and not exists (select 1 from public.perfiles where id = auth.uid() and not activo);
$$;

-- Mi propio perfil, aunque esté desactivado (la app lo necesita para decir «tu acceso fue desactivado»).
create or replace function public.mi_perfil()
returns table (nombre text, rol text, activo boolean, es_soporte boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.nombre, p.rol, p.activo, p.es_soporte from public.perfiles p where p.id = auth.uid();
$$;

drop policy if exists perfiles_staff_select on public.perfiles;
create policy perfiles_staff_select on public.perfiles
  for select to authenticated using ((select public.es_staff()));

-- Sin políticas de escritura: solo el servidor (service role) crea, cambia y desactiva perfiles.
revoke all on public.perfiles from anon;
revoke insert, update, delete, truncate on public.perfiles from authenticated;

revoke all on function public.es_staff()   from public, anon;
revoke all on function public.es_admin()   from public, anon;
revoke all on function public.mi_perfil()  from public, anon;
grant execute on function public.es_staff()  to authenticated, service_role;
grant execute on function public.es_admin()  to authenticated, service_role;
grant execute on function public.mi_perfil() to authenticated, service_role;


-- =====================================================================
-- 3. AUTOR: el nombre del perfil, estampado por la base
-- =====================================================================
-- ¿Tiene forma de nombre? (el límite de largo es el mismo que el de perfiles.nombre)
create or replace function public.autor_valido(p_autor text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_autor is null or char_length(btrim(p_autor)) between 1 and 40;
$$;

-- El autor que de verdad corresponde a esta sesión:
--   · con perfil → su nombre (lo que mande el teléfono se ignora);
--   · usuario sin perfil → solo se aceptan los dos sellos de siempre; cualquier otro nombre se descarta;
--   · sin sesión de usuario (service role, SQL Editor) → el dado, si tiene forma de nombre.
create or replace function public.autor_efectivo(p_autor text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre text;
begin
  if auth.uid() is not null then
    select nombre into v_nombre from public.perfiles where id = auth.uid();
    if v_nombre is not null then
      return v_nombre;
    end if;
    return case when p_autor in ('Polo', 'Soporte técnico') then p_autor end;
  end if;
  return case when char_length(btrim(coalesce(p_autor, ''))) between 1 and 40 then btrim(p_autor) end;
end $$;

-- Solo las usan funciones y triggers SECURITY DEFINER: la app no necesita ejecutarlas.
revoke all on function public.autor_valido(text)    from public, anon, authenticated;
revoke all on function public.autor_efectivo(text)  from public, anon, authenticated;

-- Trigger: estampa el autor al insertar. SECURITY DEFINER para poder llamar a autor_efectivo (que la app
-- no puede ejecutar). «trg_10» corre después de la guardia de soporte («trg_00»).
create or replace function public.fn_sellar_autor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.autor := public.autor_efectivo(new.autor);
  return new;
end $$;

revoke all on function public.fn_sellar_autor() from public, anon, authenticated;

-- El autor deja de limitarse a dos valores: basta con que sea un nombre razonable.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('pagos_orden',       'chk_pagos_autor'),
      ('ordenes_servicio',  'chk_ordenes_autor'),
      ('gastos_caja_menor', 'chk_gasto_autor'),
      ('cierres_caja',      'cierres_caja_autor_check'),
      ('caja_movimientos',  'caja_movimientos_autor_check'),
      ('cotizaciones',      'cotizaciones_autor_check'),
      ('citas',             'citas_autor_check')
    ) as v(tabla, restriccion)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tabla, r.restriccion);
    execute format('alter table public.%I add constraint %I check (autor is null or char_length(btrim(autor)) between 1 and 40)',
                   r.tabla, r.restriccion);
    execute format('drop trigger if exists trg_10_sellar_autor on public.%I', r.tabla);
    execute format('create trigger trg_10_sellar_autor before insert on public.%I for each row execute function public.fn_sellar_autor()', r.tabla);
  end loop;
end $$;


-- =====================================================================
-- 4. FUNCIONES QUE RECIBEN EL AUTOR (misma lógica de la fase 4; solo cambia cómo se valida y se resuelve)
-- =====================================================================
create or replace function public.editar_gasto(
  p_id uuid,
  p_fecha date,
  p_categoria public.categoria_gasto,
  p_monto numeric,
  p_descripcion text,
  p_orden_id uuid,
  p_autor text
)
returns public.gastos_caja_menor
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  antes   public.gastos_caja_menor;
  v       public.gastos_caja_menor;
  v_autor text;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = 'check_violation';
  end if;
  if not public.autor_valido(p_autor) then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;
  v_autor := public.autor_efectivo(p_autor);

  select * into antes from public.gastos_caja_menor where id = p_id for update;
  if not found then
    raise exception 'El gasto no existe' using errcode = 'no_data_found';
  end if;
  if antes.anulado then
    raise exception 'El gasto está anulado y no se puede editar' using errcode = 'check_violation';
  end if;

  update public.gastos_caja_menor
     set fecha       = p_fecha,
         categoria   = p_categoria,
         monto       = p_monto,
         descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
         orden_id    = p_orden_id,
         updated_at  = now(),
         historial   = historial || jsonb_build_array(jsonb_build_object(
                         'at',    now(),
                         'por',   auth.uid(),
                         'autor', v_autor,
                         'antes', jsonb_build_object(
                           'fecha', antes.fecha, 'categoria', antes.categoria, 'monto', antes.monto,
                           'descripcion', antes.descripcion, 'orden_id', antes.orden_id)))
   where id = p_id
   returning * into v;
  return v;
end $$;

create or replace function public.anular_gasto(p_id uuid, p_motivo text, p_autor text)
returns public.gastos_caja_menor
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.gastos_caja_menor;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;
  if not public.autor_valido(p_autor) then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  update public.gastos_caja_menor
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(),
         anulado_autor = public.autor_efectivo(p_autor), anulado_at = now()
   where id = p_id and anulado = false
   returning * into v;
  if not found then
    raise exception 'El gasto no existe o ya está anulado' using errcode = 'no_data_found';
  end if;
  return v;
end $$;

create or replace function public.cerrar_caja(
  p_fecha date,
  p_conteo numeric,
  p_desglose jsonb,
  p_notas text,
  p_autor text
)
returns public.cierres_caja
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoy     date := (now() at time zone 'America/Bogota')::date;
  saldo   numeric;
  v       public.cierres_caja;
  v_autor text;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if not public.autor_valido(p_autor) then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;
  v_autor := public.autor_efectivo(p_autor);
  if p_conteo is null or p_conteo < 0 then
    raise exception 'El conteo físico no puede ser negativo' using errcode = 'check_violation';
  end if;
  if p_fecha is null or p_fecha > hoy then
    raise exception 'No se puede cerrar la caja de una fecha futura' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.cierres_caja where fecha = p_fecha and not anulado) then
    raise exception 'Ya existe un cierre vigente para %. Anúlalo primero si necesitas rehacerlo.', p_fecha
      using errcode = 'unique_violation';
  end if;

  saldo := public.fn_saldo_caja(p_fecha);

  insert into public.cierres_caja (fecha, saldo_sistema, conteo_fisico, desglose, notas, autor)
  values (p_fecha, saldo, p_conteo, coalesce(p_desglose, '{}'::jsonb),
          nullif(btrim(coalesce(p_notas, '')), ''), v_autor)
  returning * into v;

  if v.diferencia <> 0 then
    insert into public.caja_movimientos (fecha, tipo, monto, notas, autor, cierre_id)
    values (p_fecha,
            case when v.diferencia > 0 then 'ajuste_sobrante'::public.tipo_mov_caja
                 else 'ajuste_faltante'::public.tipo_mov_caja end,
            abs(v.diferencia),
            'Ajuste por arqueo del ' || p_fecha,
            v_autor,
            v.id);
  end if;

  return v;
end $$;

create or replace function public.convertir_cotizacion(p_id uuid, p_autor text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c          public.cotizaciones;
  v_total    numeric;
  v_trabajos text;
  v_orden    uuid;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if not public.autor_valido(p_autor) then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  select * into c from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe' using errcode = 'no_data_found';
  end if;
  if c.estado = 'convertida' then
    raise exception 'La cotización ya fue convertida en una orden' using errcode = 'check_violation';
  end if;
  if c.estado = 'rechazada' then
    raise exception 'La cotización fue rechazada; no se puede convertir' using errcode = 'check_violation';
  end if;

  select c.mano_obra + coalesce(sum(cantidad * precio_unitario), 0),
         string_agg(trim_scale(cantidad)::text || ' × ' || descripcion, E'\n' order by created_at)
    into v_total, v_trabajos
    from public.cotizacion_items where cotizacion_id = c.id;
  v_total := coalesce(v_total, c.mano_obra);

  insert into public.ordenes_servicio
    (vehiculo_id, estado, mano_obra, total_cobrado, trabajos_a_realizar, notas, autor)
  values
    (c.vehiculo_id, 'recibido', c.mano_obra, v_total, v_trabajos,
     'Origen: cotización del ' || c.fecha || coalesce(E'\n' || c.notas, ''), public.autor_efectivo(p_autor))
  returning id into v_orden;

  update public.cotizaciones
     set estado = 'convertida', orden_id = v_orden
   where id = c.id;

  return v_orden;
end $$;


-- =====================================================================
-- 5. PERFILES DE LOS USUARIOS QUE YA EXISTEN
-- =====================================================================
-- El de soporte se llama «Soporte técnico»; el primero de los demás (un admin antes que un operario), «Polo»;
-- si hubiera más, llevan la parte inicial de su correo. Un nombre repetido se omite en vez de romper la migración: esa persona seguiría con
-- los sellos de siempre hasta que se le cree el perfil desde la pantalla Equipo.
insert into public.perfiles (id, nombre, correo, rol, es_soporte)
select u.id,
       case
         when coalesce((u.raw_app_meta_data ->> 'soporte') = 'true', false) then 'Soporte técnico'
         when row_number() over (
                partition by coalesce((u.raw_app_meta_data ->> 'soporte') = 'true', false)
                order by (u.raw_app_meta_data ->> 'rol') = 'admin' desc, u.email, u.id) = 1 then 'Polo'
         else initcap(split_part(coalesce(u.email, 'usuario'), '@', 1))
       end,
       u.email,
       u.raw_app_meta_data ->> 'rol',
       coalesce((u.raw_app_meta_data ->> 'soporte') = 'true', false)
  from auth.users u
 where (u.raw_app_meta_data ->> 'rol') in ('admin', 'operario')
on conflict do nothing;

-- =====================================================================
-- FIN · Fase 10
--
-- IMPORTANTE: el dueño del taller debe tener rol 'admin' para gestionar el equipo (el ayudante es 'operario'
-- y no puede borrar). Si hoy su usuario es 'operario', en el SQL Editor (cambia el correo):
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol":"admin"}'
--    where email = 'correo-del-dueno@ejemplo.com';
--   update public.perfiles set rol = 'admin' where correo = 'correo-del-dueno@ejemplo.com';
-- (cierra sesión y vuelve a entrar para que el token lleve el rol nuevo).
-- =====================================================================
