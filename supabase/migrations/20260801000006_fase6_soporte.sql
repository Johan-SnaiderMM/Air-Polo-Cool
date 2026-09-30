-- =====================================================================
-- POLO AIR COOL · FASE 6 · USUARIO DE SOPORTE: MODO PRUEBA Y MANTENIMIENTO
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable).
--
-- QUÉ AÑADE
--   1. Identidad de soporte: app_metadata.soporte = true (no la puede editar el propio usuario).
--      Soporte tiene los mismos permisos que un admin (rol 'admin'), más estos dos poderes.
--   2. MODO PRUEBA: cada fila de las tablas operativas lleva `es_prueba`. Un usuario solo ve y
--      toca filas de SU modo: Polo siempre ve lo real; soporte ve lo real o lo de prueba según
--      el interruptor. Lo de prueba nunca aparece para Polo ni suma en cobros, balance,
--      garantías ni inventario reales (las vistas heredan el RLS).
--   3. MANTENIMIENTO: interruptor global. Mientras está activo, solo soporte puede escribir;
--      Polo queda en solo lectura (lo impide la base, también dentro de las funciones RPC).
--
-- Las dos protecciones se aplican con un trigger por tabla (fn_guardia_soporte) y una política
-- RESTRICTIVA por tabla: no se redefine ninguna función ni política existente.
--
-- Asignar el usuario de soporte (lo hace esta migración si ya creaste el usuario en
-- Authentication; si lo creas después, vuelve a ejecutarla). Cierra sesión y vuelve a entrar
-- para que el token lleve la marca nueva.
-- =====================================================================


-- =====================================================================
-- 1. ESTADO: modo de cada usuario de soporte y mantenimiento global
-- =====================================================================
create table if not exists public.soporte_modo (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  prueba      boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Una sola fila (id siempre true).
create table if not exists public.mantenimiento (
  id          boolean primary key default true check (id),
  activo      boolean not null default false,
  motivo      text,
  desde       timestamptz,
  actualizado_por uuid
);
insert into public.mantenimiento (id) values (true) on conflict (id) do nothing;

alter table public.soporte_modo  enable row level security;
alter table public.mantenimiento enable row level security;

drop policy if exists soporte_modo_propio on public.soporte_modo;
create policy soporte_modo_propio on public.soporte_modo
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists mantenimiento_lectura on public.mantenimiento;
create policy mantenimiento_lectura on public.mantenimiento
  for select to authenticated using (true);

-- Solo se cambian con las RPC de abajo (no hay políticas de escritura).
revoke all on public.soporte_modo, public.mantenimiento from anon;
revoke insert, update, delete, truncate on public.soporte_modo, public.mantenimiento from authenticated;


-- =====================================================================
-- 2. FUNCIONES
-- =====================================================================
create or replace function public.es_soporte()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'soporte') = 'true', false);
$$;

-- ¿Este usuario trabaja en modo prueba? Solo soporte puede (y solo si lo activó).
create or replace function public.en_modo_prueba()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.es_soporte()
     and coalesce((select prueba from public.soporte_modo where user_id = auth.uid()), false);
$$;

create or replace function public.en_mantenimiento()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select activo from public.mantenimiento where id), false);
$$;

create or replace function public.cambiar_modo_prueba(p_activo boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.es_soporte() then
    raise exception 'Solo el usuario de soporte puede cambiar de modo.' using errcode = '42501';
  end if;
  insert into public.soporte_modo (user_id, prueba)
  values (auth.uid(), coalesce(p_activo, false))
  on conflict (user_id) do update set prueba = excluded.prueba, updated_at = now();
  return coalesce(p_activo, false);
end $$;

create or replace function public.cambiar_mantenimiento(p_activo boolean, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.es_soporte() then
    raise exception 'Solo el usuario de soporte puede cambiar el mantenimiento.' using errcode = '42501';
  end if;
  update public.mantenimiento
     set activo = coalesce(p_activo, false),
         motivo = case when coalesce(p_activo, false) then nullif(left(btrim(coalesce(p_motivo, '')), 200), '') end,
         desde = case when coalesce(p_activo, false) then now() end,
         actualizado_por = auth.uid()
   where id;
  return coalesce(p_activo, false);
end $$;

revoke all on function public.es_soporte()                        from public, anon;
revoke all on function public.en_modo_prueba()                    from public, anon;
revoke all on function public.en_mantenimiento()                  from public, anon;
revoke all on function public.cambiar_modo_prueba(boolean)        from public, anon;
revoke all on function public.cambiar_mantenimiento(boolean, text) from public, anon;
grant execute on function public.es_soporte()                        to authenticated, service_role;
grant execute on function public.en_modo_prueba()                    to authenticated, service_role;
grant execute on function public.en_mantenimiento()                  to authenticated, service_role;
grant execute on function public.cambiar_modo_prueba(boolean)        to authenticated;
grant execute on function public.cambiar_mantenimiento(boolean, text) to authenticated;


-- =====================================================================
-- 3. COLUMNA es_prueba EN LAS TABLAS OPERATIVAS
-- =====================================================================
-- El valor por defecto es el modo de quien inserta: nada en la app necesita enviarlo.
-- (Las filas que ya existen quedan como reales.)
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','vehiculos','ordenes_servicio','evidencias_fotograficas','inventario',
    'orden_repuestos','gastos_caja_menor','pagos_orden','cotizaciones','cotizacion_items'
  ] loop
    execute format('alter table public.%I add column if not exists es_prueba boolean not null default public.en_modo_prueba()', t);
  end loop;
end $$;

-- Lo único (placa, código de inventario, documento) es único POR MODO: soporte puede probar con
-- una placa real sin chocar con la del taller ni enterarse de que existe.
alter table public.vehiculos drop constraint if exists vehiculos_placa_key;
create unique index if not exists ux_vehiculos_placa_modo on public.vehiculos (placa, es_prueba);

alter table public.inventario drop constraint if exists inventario_codigo_key;
create unique index if not exists ux_inventario_codigo_modo on public.inventario (codigo, es_prueba);

drop index if exists public.ux_clientes_documento;
create unique index if not exists ux_clientes_documento_modo
  on public.clientes (documento, es_prueba) where documento is not null;


-- =====================================================================
-- 4. PROTECCIONES (una política y un trigger por tabla)
-- =====================================================================
-- Política RESTRICTIVA: se suma (AND) a las políticas de staff ya existentes. Cada usuario ve
-- y escribe solo filas de su modo; una inserción con el modo equivocado se rechaza.
--
-- Trigger: rechaza escrituras de Polo durante el mantenimiento y cualquier cambio a una fila de
-- otro modo. Los triggers también se disparan dentro de las funciones SECURITY DEFINER (anular
-- pago, convertir cotización…), que se saltan el RLS. Sin sesión de usuario (service role, SQL
-- Editor, migraciones) no restringe nada.
create or replace function public.fn_guardia_soporte()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if public.en_mantenimiento() and not public.es_soporte() then
      raise exception 'La app está en mantenimiento y solo permite consultar. Inténtalo de nuevo en unos minutos.'
        using errcode = 'PC001';
    end if;
    if tg_op <> 'INSERT' then
      if old.es_prueba is distinct from public.en_modo_prueba() then
        raise exception 'Ese registro no existe en el modo actual.' using errcode = 'PC002';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

revoke all on function public.fn_guardia_soporte() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','vehiculos','ordenes_servicio','evidencias_fotograficas','inventario',
    'orden_repuestos','gastos_caja_menor','pagos_orden','cotizaciones','cotizacion_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_modo', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using (es_prueba = (select public.en_modo_prueba())) '
      'with check (es_prueba = (select public.en_modo_prueba()))',
      t || '_modo', t);

    -- "trg_00" corre antes que los demás triggers de la tabla (orden alfabético).
    execute format('drop trigger if exists trg_00_guardia_soporte on public.%I', t);
    execute format(
      'create trigger trg_00_guardia_soporte before insert or update or delete on public.%I '
      'for each row execute function public.fn_guardia_soporte()', t);
  end loop;
end $$;


-- =====================================================================
-- 5. ASIGNAR EL USUARIO DE SOPORTE
-- =====================================================================
-- Mismos permisos que admin + marca de soporte. No cambia un rol que ya tenga.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('soporte', true, 'rol', coalesce(raw_app_meta_data ->> 'rol', 'admin'))
 where email = 'soporte@aircool.com';

-- =====================================================================
-- FIN · Fase 6
-- =====================================================================
