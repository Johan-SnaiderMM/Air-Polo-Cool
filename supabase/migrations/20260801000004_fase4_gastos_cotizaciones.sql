-- =====================================================================
-- POLO AIR COOL · FASE 4 · Caja real, arqueo, gastos auditables,
--                          cotizaciones, pertenencias y mantenimiento
-- Ejecutar en: Supabase > SQL Editor, DESPUÉS de fase1, fase2 y fase3.
-- Idempotente (se puede volver a ejecutar sin efectos secundarios).
--
-- QUÉ AGREGA
--   1. Autoría simple ("Polo" / "Soporte técnico") en los registros nuevos.
--   2. Gastos: fecha editable, ligados opcionalmente a una orden, con historial
--      de ediciones y ANULACIÓN con motivo (ya no se borran).
--   3. Caja menor real: movimientos (fondo inicial, reposiciones, retiros),
--      saldo disponible y arqueo / cierre diario con diferencia.
--   4. Vistas: caja diaria, balance real (base cobrado), rentabilidad por orden.
--   5. Órdenes: checklist de pertenencias al ingreso y próximo mantenimiento.
--   6. Cotizaciones (con conversión atómica a orden de trabajo).
--
-- REGLA CONTABLE DE LA CAJA
--   Saldo de caja = fondo + reposiciones − retiros ± ajustes de arqueo
--                   + cobros EN EFECTIVO (netos de devoluciones)
--                   − gastos de caja menor (no anulados).
--   Las transferencias / tarjetas afectan el balance general pero NO la caja física.
-- =====================================================================


-- =====================================================================
-- 0. ENUMS
-- =====================================================================
do $$ begin
  create type public.tipo_mov_caja as enum
    ('fondo_inicial','reposicion','retiro','ajuste_sobrante','ajuste_faltante');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_cotizacion as enum
    ('borrador','enviada','aprobada','rechazada','convertida');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 1. AUTORÍA (texto simple, sin roles nuevos)
-- =====================================================================
alter table public.pagos_orden       add column if not exists autor text;
alter table public.ordenes_servicio  add column if not exists autor text;

alter table public.pagos_orden drop constraint if exists chk_pagos_autor;
alter table public.pagos_orden add  constraint chk_pagos_autor
  check (autor is null or autor in ('Polo', 'Soporte técnico'));
alter table public.ordenes_servicio drop constraint if exists chk_ordenes_autor;
alter table public.ordenes_servicio add  constraint chk_ordenes_autor
  check (autor is null or autor in ('Polo', 'Soporte técnico'));


-- =====================================================================
-- 2. GASTOS: orden asociada, autoría, historial y anulación
-- =====================================================================
alter table public.gastos_caja_menor
  add column if not exists orden_id       uuid references public.ordenes_servicio(id) on delete set null,
  add column if not exists autor          text,
  add column if not exists registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  add column if not exists updated_at     timestamptz,
  add column if not exists historial      jsonb not null default '[]'::jsonb,
  add column if not exists anulado        boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_por    uuid references auth.users(id) on delete set null,
  add column if not exists anulado_autor  text,
  add column if not exists anulado_at     timestamptz;

alter table public.gastos_caja_menor drop constraint if exists chk_gasto_autor;
alter table public.gastos_caja_menor add  constraint chk_gasto_autor
  check (autor is null or autor in ('Polo', 'Soporte técnico'));
alter table public.gastos_caja_menor drop constraint if exists chk_gasto_anulacion;
alter table public.gastos_caja_menor add  constraint chk_gasto_anulacion check (
  (anulado = false and anulado_motivo is null and anulado_at is null)
  or (anulado = true and length(btrim(coalesce(anulado_motivo, ''))) > 0 and anulado_at is not null)
);

create index if not exists idx_gastos_orden on public.gastos_caja_menor (orden_id) where orden_id is not null;
create index if not exists idx_gastos_vigentes on public.gastos_caja_menor (fecha desc) where not anulado;

-- Un gasto nuevo nunca nace anulado.
drop policy if exists gastos_staff_insert on public.gastos_caja_menor;
create policy gastos_staff_insert on public.gastos_caja_menor
  for insert to authenticated
  with check ((select public.es_staff()) and anulado = false);

-- Editar (con historial de valores anteriores)
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
  antes public.gastos_caja_menor;
  v     public.gastos_caja_menor;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = 'check_violation';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

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
                         'autor', p_autor,
                         'antes', jsonb_build_object(
                           'fecha', antes.fecha, 'categoria', antes.categoria, 'monto', antes.monto,
                           'descripcion', antes.descripcion, 'orden_id', antes.orden_id)))
   where id = p_id
   returning * into v;
  return v;
end $$;

-- Anular (motivo obligatorio; deja quién, cuándo y por qué)
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
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  update public.gastos_caja_menor
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(),
         anulado_autor = p_autor, anulado_at = now()
   where id = p_id and anulado = false
   returning * into v;
  if not found then
    raise exception 'El gasto no existe o ya está anulado' using errcode = 'no_data_found';
  end if;
  return v;
end $$;

revoke all on function public.editar_gasto(uuid, date, public.categoria_gasto, numeric, text, uuid, text) from public, anon;
revoke all on function public.anular_gasto(uuid, text, text) from public, anon;
grant execute on function public.editar_gasto(uuid, date, public.categoria_gasto, numeric, text, uuid, text) to authenticated;
grant execute on function public.anular_gasto(uuid, text, text) to authenticated;


-- =====================================================================
-- 3. CAJA MENOR REAL: cierres (arqueo) y movimientos
-- =====================================================================
create table if not exists public.cierres_caja (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  saldo_sistema   numeric(12,2) not null,                       -- lo calcula el servidor
  conteo_fisico   numeric(12,2) not null check (conteo_fisico >= 0),
  diferencia      numeric(12,2) generated always as (conteo_fisico - saldo_sistema) stored,
  resultado       text generated always as (
                    case when conteo_fisico = saldo_sistema then 'cuadrado'
                         when conteo_fisico <  saldo_sistema then 'faltante'
                         else 'sobrante' end) stored,
  desglose        jsonb not null default '{}'::jsonb,           -- {"50000": 3, "20000": 2, …}
  notas           text,
  autor           text check (autor is null or autor in ('Polo', 'Soporte técnico')),
  registrado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  anulado         boolean not null default false,
  anulado_motivo  text,
  anulado_por     uuid references auth.users(id) on delete set null,
  anulado_at      timestamptz,
  constraint chk_cierre_anulacion check (
    (anulado = false and anulado_motivo is null and anulado_at is null)
    or (anulado = true and length(btrim(coalesce(anulado_motivo, ''))) > 0 and anulado_at is not null)
  )
);
-- Un solo cierre vigente por día.
create unique index if not exists ux_cierre_fecha on public.cierres_caja (fecha) where not anulado;

create table if not exists public.caja_movimientos (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default ((now() at time zone 'America/Bogota')::date),
  tipo            public.tipo_mov_caja not null,
  monto           numeric(12,2) not null check (monto > 0),
  notas           text,
  autor           text check (autor is null or autor in ('Polo', 'Soporte técnico')),
  registrado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  cierre_id       uuid references public.cierres_caja(id) on delete restrict,  -- ajustes generados por un arqueo
  created_at      timestamptz not null default now(),
  anulado         boolean not null default false,
  anulado_motivo  text,
  anulado_por     uuid references auth.users(id) on delete set null,
  anulado_at      timestamptz,
  constraint chk_mov_anulacion check (
    (anulado = false and anulado_motivo is null and anulado_at is null)
    or (anulado = true and length(btrim(coalesce(anulado_motivo, ''))) > 0 and anulado_at is not null)
  )
);
create index if not exists idx_caja_mov_fecha on public.caja_movimientos (fecha desc) where not anulado;

-- Saldo de caja al cierre del día p_hasta (por defecto, hoy en Bogotá).
create or replace function public.fn_saldo_caja(p_hasta date default null)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  with h as (select coalesce(p_hasta, (now() at time zone 'America/Bogota')::date) as hasta)
  select
    coalesce((select sum(case when m.tipo in ('fondo_inicial','reposicion','ajuste_sobrante')
                              then m.monto else -m.monto end)
                from public.caja_movimientos m, h
               where not m.anulado and m.fecha <= h.hasta), 0)
  + coalesce((select sum(case when p.es_devolucion then -p.monto else p.monto end)
                from public.pagos_orden p, h
               where p.medio = 'efectivo' and not p.anulado and p.fecha <= h.hasta), 0)
  - coalesce((select sum(g.monto)
                from public.gastos_caja_menor g, h
               where not g.anulado and g.fecha <= h.hasta), 0);
$$;

-- Cierre de caja: el saldo del sistema lo calcula el SERVIDOR (no se puede falsear).
-- Si hay diferencia, registra un ajuste para que el saldo quede igual al conteo físico.
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
  hoy    date := (now() at time zone 'America/Bogota')::date;
  saldo  numeric;
  v      public.cierres_caja;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;
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
          nullif(btrim(coalesce(p_notas, '')), ''), p_autor)
  returning * into v;

  if v.diferencia <> 0 then
    insert into public.caja_movimientos (fecha, tipo, monto, notas, autor, cierre_id)
    values (p_fecha,
            case when v.diferencia > 0 then 'ajuste_sobrante'::public.tipo_mov_caja
                 else 'ajuste_faltante'::public.tipo_mov_caja end,
            abs(v.diferencia),
            'Ajuste por arqueo del ' || p_fecha,
            p_autor,
            v.id);
  end if;

  return v;
end $$;

create or replace function public.anular_cierre(p_id uuid, p_motivo text)
returns public.cierres_caja
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.cierres_caja;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;

  update public.cierres_caja
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and anulado = false
   returning * into v;
  if not found then
    raise exception 'El cierre no existe o ya está anulado' using errcode = 'no_data_found';
  end if;

  -- El ajuste generado por ese arqueo también deja de contar.
  update public.caja_movimientos
     set anulado = true, anulado_motivo = 'Cierre anulado: ' || btrim(p_motivo),
         anulado_por = auth.uid(), anulado_at = now()
   where cierre_id = p_id and not anulado;

  return v;
end $$;

create or replace function public.anular_movimiento_caja(p_id uuid, p_motivo text)
returns public.caja_movimientos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.caja_movimientos;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.caja_movimientos where id = p_id and cierre_id is not null) then
    raise exception 'Este ajuste pertenece a un arqueo: anula el cierre en su lugar'
      using errcode = 'check_violation';
  end if;

  update public.caja_movimientos
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and not anulado
   returning * into v;
  if not found then
    raise exception 'El movimiento no existe o ya está anulado' using errcode = 'no_data_found';
  end if;
  return v;
end $$;

revoke all on function public.cerrar_caja(date, numeric, jsonb, text, text) from public, anon;
revoke all on function public.anular_cierre(uuid, text) from public, anon;
revoke all on function public.anular_movimiento_caja(uuid, text) from public, anon;
grant execute on function public.cerrar_caja(date, numeric, jsonb, text, text) to authenticated;
grant execute on function public.anular_cierre(uuid, text) to authenticated;
grant execute on function public.anular_movimiento_caja(uuid, text) to authenticated;
revoke all on function public.fn_saldo_caja(date) from public, anon;
grant execute on function public.fn_saldo_caja(date) to authenticated;

alter table public.cierres_caja     enable row level security;
alter table public.caja_movimientos enable row level security;

drop policy if exists cierres_staff_select on public.cierres_caja;
create policy cierres_staff_select on public.cierres_caja
  for select to authenticated using ((select public.es_staff()));
-- Los cierres se crean SOLO con cerrar_caja() (no hay política de insert/update/delete).

drop policy if exists movs_staff_select on public.caja_movimientos;
drop policy if exists movs_staff_insert on public.caja_movimientos;
create policy movs_staff_select on public.caja_movimientos
  for select to authenticated using ((select public.es_staff()));
-- Directo solo los 3 tipos manuales; los ajustes los crea cerrar_caja().
create policy movs_staff_insert on public.caja_movimientos
  for insert to authenticated
  with check (
    (select public.es_staff())
    and tipo in ('fondo_inicial','reposicion','retiro')
    and anulado = false
    and cierre_id is null
  );

revoke all on public.cierres_caja, public.caja_movimientos from anon;
revoke update, delete on public.cierres_caja, public.caja_movimientos from authenticated;


-- =====================================================================
-- 4. ÓRDENES: pertenencias al ingreso y próximo mantenimiento
-- =====================================================================
alter table public.ordenes_servicio
  add column if not exists pertenencias           jsonb,
  add column if not exists mantenimiento_meses    smallint,
  add column if not exists proximo_mantenimiento  date;

alter table public.ordenes_servicio drop constraint if exists chk_mantenimiento_meses;
alter table public.ordenes_servicio add  constraint chk_mantenimiento_meses
  check (mantenimiento_meses is null or mantenimiento_meses in (3, 6, 12));

comment on column public.ordenes_servicio.pertenencias is
  'Checklist al ingreso: {carroceria, llanta_repuesto, herramientas, documentos, objetos_valor, notas}.';

-- Mismo trigger de la Fase 1 + cálculo del próximo mantenimiento.
create or replace function public.fn_orden_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base date;
begin
  if new.token_publico is null then
    new.token_publico := public.fn_generar_token_publico();
  end if;

  -- Al marcar 'entregado' sin fecha explícita, se sella la fecha de entrega.
  if new.estado = 'entregado' and new.fecha_entrega is null then
    new.fecha_entrega := now();
  end if;

  if new.fecha_entrega is not null and coalesce(new.dias_garantia, 0) > 0 then
    new.fecha_fin_garantia :=
      (new.fecha_entrega at time zone 'America/Bogota')::date + new.dias_garantia;
  else
    new.fecha_fin_garantia := null;
  end if;

  -- Próximo mantenimiento preventivo (solo si el vehículo está listo/entregado).
  if new.mantenimiento_meses is null or new.estado not in ('listo', 'entregado') then
    new.proximo_mantenimiento := null;
  else
    if new.fecha_entrega is not null then
      base := (new.fecha_entrega at time zone 'America/Bogota')::date;
    elsif tg_op = 'UPDATE'
          and old.proximo_mantenimiento is not null
          and old.mantenimiento_meses is not distinct from new.mantenimiento_meses then
      base := null;                                  -- se conserva la fecha ya calculada
      new.proximo_mantenimiento := old.proximo_mantenimiento;
    else
      base := (now() at time zone 'America/Bogota')::date;
    end if;
    if base is not null then
      new.proximo_mantenimiento := (base + make_interval(months => new.mantenimiento_meses))::date;
    end if;
  end if;

  return new;
end $$;


-- =====================================================================
-- 5. COTIZACIONES
-- =====================================================================
create table if not exists public.cotizaciones (
  id             uuid primary key default gen_random_uuid(),
  vehiculo_id    uuid not null references public.vehiculos(id) on delete restrict,
  estado         public.estado_cotizacion not null default 'borrador',
  fecha          date not null default ((now() at time zone 'America/Bogota')::date),
  vigencia_dias  integer not null default 15 check (vigencia_dias between 1 and 365),
  mano_obra      numeric(12,2) not null default 0 check (mano_obra >= 0),
  notas          text,
  orden_id       uuid references public.ordenes_servicio(id) on delete set null,  -- al convertir
  autor          text check (autor is null or autor in ('Polo', 'Soporte técnico')),
  registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_cotizaciones_vehiculo on public.cotizaciones (vehiculo_id, fecha desc);
create index if not exists idx_cotizaciones_estado   on public.cotizaciones (estado, fecha desc);

create table if not exists public.cotizacion_items (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  inventario_id   uuid references public.inventario(id) on delete set null,
  descripcion     text not null check (length(btrim(descripcion)) > 0),
  cantidad        numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario  numeric(12,2) not null default 0 check (costo_unitario >= 0),  -- estimado (margen)
  created_at      timestamptz not null default now()
);
create index if not exists idx_cot_items on public.cotizacion_items (cotizacion_id);

drop trigger if exists trg_cotizaciones_updated_at on public.cotizaciones;
create trigger trg_cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.fn_set_updated_at();

-- Una cotización convertida es un documento cerrado.
create or replace function public.fn_cotizacion_items_bloqueo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_estado public.estado_cotizacion;
begin
  select estado into v_estado from public.cotizaciones
   where id = coalesce(new.cotizacion_id, old.cotizacion_id);
  if v_estado = 'convertida' then
    raise exception 'La cotización ya fue convertida en orden y no admite cambios'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_cot_items_bloqueo on public.cotizacion_items;
create trigger trg_cot_items_bloqueo before insert or update or delete on public.cotizacion_items
  for each row execute function public.fn_cotizacion_items_bloqueo();

create or replace view public.v_cotizacion_totales
with (security_invoker = true) as
select
  c.id                                                    as cotizacion_id,
  coalesce(i.total_repuestos, 0)                          as total_repuestos,
  c.mano_obra,
  c.mano_obra + coalesce(i.total_repuestos, 0)            as total,
  coalesce(i.costo_estimado, 0)                           as costo_estimado,
  c.mano_obra + coalesce(i.total_repuestos, 0) - coalesce(i.costo_estimado, 0) as margen_estimado,
  coalesce(i.items, 0)                                    as items
from public.cotizaciones c
left join (
  select cotizacion_id,
         sum(cantidad * precio_unitario) as total_repuestos,
         sum(cantidad * costo_unitario)  as costo_estimado,
         count(*)::int                   as items
  from public.cotizacion_items
  group by cotizacion_id
) i on i.cotizacion_id = c.id;

-- Conversión atómica: crea la orden en 'recibido' con la mano de obra y el total cotizados.
-- Los repuestos NO descuentan stock aquí: son estimados y se consumen al usarlos en la orden.
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
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
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
     'Origen: cotización del ' || c.fecha || coalesce(E'\n' || c.notas, ''), p_autor)
  returning id into v_orden;

  update public.cotizaciones
     set estado = 'convertida', orden_id = v_orden
   where id = c.id;

  return v_orden;
end $$;

revoke all on function public.convertir_cotizacion(uuid, text) from public, anon;
grant execute on function public.convertir_cotizacion(uuid, text) to authenticated;

alter table public.cotizaciones     enable row level security;
alter table public.cotizacion_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cotizaciones', 'cotizacion_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.es_staff()))', t || '_staff_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.es_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.es_staff()))', t || '_staff_delete', t);
  end loop;
end $$;

revoke all on public.cotizaciones, public.cotizacion_items from anon;


-- =====================================================================
-- 6. VISTAS
-- =====================================================================

-- Balance mensual: Utilidad Real = (Ingresos - Costo repuestos) - Caja menor.
-- Ingresos = órdenes 'entregado', mes según fecha_entrega (hora Colombia).
-- Ignora los gastos anulados. (Única definición de esta vista.)
create or replace view public.v_balance_mensual
with (security_invoker = true) as
with ing as (
  select date_trunc('month', fecha_entrega at time zone 'America/Bogota')::date as mes,
         sum(total_cobrado)   as ingresos,
         sum(costo_repuestos) as costo_repuestos
  from public.v_finanzas_orden
  where estado = 'entregado' and fecha_entrega is not null
  group by 1
),
gas as (
  select date_trunc('month', fecha)::date as mes,
         sum(monto) as gastos_caja_menor
  from public.gastos_caja_menor
  where not anulado
  group by 1
)
select
  coalesce(ing.mes, gas.mes)                          as mes,
  coalesce(ing.ingresos, 0)                           as ingresos,
  coalesce(ing.costo_repuestos, 0)                    as costo_repuestos,
  coalesce(gas.gastos_caja_menor, 0)                  as gastos_caja_menor,
  (coalesce(ing.ingresos, 0) - coalesce(ing.costo_repuestos, 0))
    - coalesce(gas.gastos_caja_menor, 0)              as utilidad_real
from ing
full join gas on gas.mes = ing.mes;

-- Como en la fase 1, el rol anónimo no lee esta vista (la vista se creó después del revoke general).
revoke all on public.v_balance_mensual from anon;

-- Balance REAL (base cobrado): no asume que lo facturado está pagado.
--   utilidad_real = cobrado neto del mes − costo de repuestos (órdenes entregadas del mes) − gastos del mes
create or replace view public.v_balance_real
with (security_invoker = true) as
with fact as (
  select date_trunc('month', fecha_entrega at time zone 'America/Bogota')::date as mes,
         sum(total_cobrado)   as facturado,
         sum(costo_repuestos) as costo_repuestos
  from public.v_finanzas_orden
  where estado = 'entregado' and fecha_entrega is not null
  group by 1
),
cob as (select mes, neto as cobrado from public.v_recaudo_mensual),
gas as (
  select date_trunc('month', fecha)::date as mes, sum(monto) as gastos
  from public.gastos_caja_menor where not anulado group by 1
),
meses as (select mes from fact union select mes from cob union select mes from gas)
select
  m.mes,
  coalesce(f.facturado, 0)        as facturado,
  coalesce(c.cobrado, 0)          as cobrado,
  coalesce(f.costo_repuestos, 0)  as costo_repuestos,
  coalesce(g.gastos, 0)           as gastos,
  coalesce(c.cobrado, 0) - coalesce(f.costo_repuestos, 0) - coalesce(g.gastos, 0) as utilidad_real
from meses m
left join fact f on f.mes = m.mes
left join cob  c on c.mes = m.mes
left join gas  g on g.mes = m.mes;

-- Movimiento diario de caja física.
create or replace view public.v_caja_diaria
with (security_invoker = true) as
with mov as (
  select fecha,
         sum(case when tipo in ('fondo_inicial','reposicion','ajuste_sobrante') then monto else 0 end) as entradas,
         sum(case when tipo in ('retiro','ajuste_faltante') then monto else 0 end)                     as salidas
  from public.caja_movimientos where not anulado group by fecha
),
cob as (
  select fecha, sum(case when es_devolucion then -monto else monto end) as cobros_efectivo
  from public.pagos_orden where medio = 'efectivo' and not anulado group by fecha
),
gas as (
  select fecha, sum(monto) as gastos from public.gastos_caja_menor where not anulado group by fecha
),
dias as (select fecha from mov union select fecha from cob union select fecha from gas)
select
  d.fecha,
  coalesce(m.entradas, 0)         as entradas,
  coalesce(m.salidas, 0)          as salidas,
  coalesce(c.cobros_efectivo, 0)  as cobros_efectivo,
  coalesce(g.gastos, 0)           as gastos,
  coalesce(m.entradas, 0) - coalesce(m.salidas, 0) + coalesce(c.cobros_efectivo, 0) - coalesce(g.gastos, 0) as neto_dia
from dias d
left join mov m on m.fecha = d.fecha
left join cob c on c.fecha = d.fecha
left join gas g on g.fecha = d.fecha;

-- Rentabilidad neta real por orden:
--   utilidad_real      = cobrado − costo de repuestos − gastos directos asignados
--   utilidad_facturada = total cobrado a cliente − costo de repuestos − gastos directos
create or replace view public.v_rentabilidad_orden
with (security_invoker = true) as
select
  o.id                                            as orden_id,
  o.vehiculo_id,
  v.placa,
  c.nombre                                        as cliente,
  o.estado,
  o.fecha_entrega,
  o.total_cobrado,
  coalesce(pg.pagado, 0)                          as pagado,
  coalesce(r.costo, 0)                            as costo_repuestos,
  coalesce(g.gastos, 0)                           as gastos_directos,
  coalesce(pg.pagado, 0) - coalesce(r.costo, 0) - coalesce(g.gastos, 0)   as utilidad_real,
  o.total_cobrado        - coalesce(r.costo, 0) - coalesce(g.gastos, 0)   as utilidad_facturada
from public.ordenes_servicio o
join public.vehiculos v on v.id = o.vehiculo_id
join public.clientes  c on c.id = v.cliente_id
left join (select orden_id, sum(cantidad_usada * costo_unitario) as costo
             from public.orden_repuestos group by orden_id) r on r.orden_id = o.id
left join (select orden_id, sum(case when es_devolucion then -monto else monto end) as pagado
             from public.pagos_orden where not anulado group by orden_id) pg on pg.orden_id = o.id
left join (select orden_id, sum(monto) as gastos
             from public.gastos_caja_menor where orden_id is not null and not anulado
            group by orden_id) g on g.orden_id = o.id
where o.estado <> 'cancelado';

-- Próximo mantenimiento por vehículo (solo la última orden lista/entregada de cada uno).
create or replace view public.v_mantenimientos
with (security_invoker = true) as
select
  x.orden_id, x.vehiculo_id, x.placa, x.marca, x.modelo, x.anio,
  x.cliente, x.telefono, x.mantenimiento_meses, x.proximo_mantenimiento,
  (x.proximo_mantenimiento - (now() at time zone 'America/Bogota')::date) as dias_restantes,
  case
    when x.proximo_mantenimiento <  (now() at time zone 'America/Bogota')::date      then 'vencido'
    when x.proximo_mantenimiento - (now() at time zone 'America/Bogota')::date <= 15 then 'proximo'
    else 'lejano'
  end as estado_mantenimiento
from (
  select distinct on (o.vehiculo_id)
         o.id as orden_id, o.vehiculo_id, v.placa, v.marca, v.modelo, v.anio,
         c.nombre as cliente, c.telefono, o.mantenimiento_meses, o.proximo_mantenimiento
    from public.ordenes_servicio o
    join public.vehiculos v on v.id = o.vehiculo_id
    join public.clientes  c on c.id = v.cliente_id
   where o.estado in ('listo', 'entregado')
   order by o.vehiculo_id, coalesce(o.fecha_entrega, o.created_at) desc
) x
where x.proximo_mantenimiento is not null;

-- =====================================================================
-- FIN · Fase 4
-- =====================================================================
