-- =====================================================================
-- POLO AIR COOL · FASE 3 · Pagos y abonos de clientes
-- Ejecutar en: Supabase > SQL Editor, DESPUÉS de fase1 y fase2.
-- Idempotente (se puede volver a ejecutar sin efectos secundarios).
--
-- QUÉ AGREGA
--   1. Enum  medio_pago
--   2. Tabla pagos_orden      abonos / pagos / devoluciones por orden
--                             (nunca se borran ni editan: se ANULAN con motivo)
--   3. RPC   anular_pago()    única vía para anular (deja huella de quién y por qué)
--   4. Vistas
--        v_saldo_ordenes      total cobrado vs. pagado por orden + estado de pago
--        v_cartera            cuentas por cobrar (saldo pendiente > 0)
--        v_recaudo_mensual    dinero realmente recibido por mes y por medio de pago
--   5. RLS y permisos
--   6. obtener_orden_publica() ahora incluye 'pagado' y 'saldo' (aditivo: el portal
--      actual sigue funcionando sin cambios)
--
-- MODELO
--   Ingresos "devengados" (v_balance_mensual, ya existente) = total de órdenes entregadas.
--   Recaudo "de caja" (v_recaudo_mensual, nuevo)           = pagos realmente recibidos.
--   Saldo por cobrar = total_cobrado − (pagos − devoluciones), sin contar anulados.
-- =====================================================================


-- =====================================================================
-- 1. ENUM
-- =====================================================================
do $$ begin
  create type public.medio_pago as enum ('efectivo','transferencia','tarjeta','otro');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 2. TABLA pagos_orden
-- =====================================================================
create table if not exists public.pagos_orden (
  id               uuid primary key default gen_random_uuid(),
  -- RESTRICT: un registro de dinero no debe desaparecer al borrar una orden.
  orden_id         uuid not null references public.ordenes_servicio(id) on delete restrict,
  fecha            date not null default ((now() at time zone 'America/Bogota')::date),
  monto            numeric(12,2) not null check (monto > 0),
  medio            public.medio_pago not null default 'efectivo',
  -- true = el taller devuelve dinero al cliente (resta del pagado).
  es_devolucion    boolean not null default false,
  referencia       text,   -- nº de transferencia / voucher
  notas            text,
  comprobante_url  text,   -- ruta dentro del bucket 'facturas-gastos' (prefijo pagos/)
  registrado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Anulación (en vez de borrar): queda el rastro completo.
  anulado          boolean not null default false,
  anulado_motivo   text,
  anulado_por      uuid references auth.users(id) on delete set null,
  anulado_at       timestamptz,
  constraint chk_anulacion_completa check (
    (anulado = false and anulado_motivo is null and anulado_at is null)
    or (anulado = true and length(btrim(coalesce(anulado_motivo, ''))) > 0 and anulado_at is not null)
  )
);
comment on table  public.pagos_orden is 'Abonos, pagos y devoluciones por orden. Inmutable: se anula, no se edita ni se borra.';
comment on column public.pagos_orden.es_devolucion is 'true = dinero devuelto al cliente; resta del total pagado.';

create index if not exists idx_pagos_orden          on public.pagos_orden (orden_id) where not anulado;
create index if not exists idx_pagos_fecha          on public.pagos_orden (fecha desc) where not anulado;
create index if not exists idx_pagos_registrado_por on public.pagos_orden (registrado_por);


-- =====================================================================
-- 3. RPC: anular un pago (única vía; bypass controlado del RLS)
-- =====================================================================
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns public.pagos_orden
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.pagos_orden;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio'
      using errcode = 'check_violation';
  end if;

  update public.pagos_orden
     set anulado        = true,
         anulado_motivo = btrim(p_motivo),
         anulado_por    = auth.uid(),
         anulado_at     = now()
   where id = p_pago_id
     and anulado = false
   returning * into v;

  if not found then
    raise exception 'El pago no existe o ya está anulado'
      using errcode = 'no_data_found';
  end if;

  return v;
end $$;

revoke all on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;


-- =====================================================================
-- 4. VISTAS (security_invoker: respetan el RLS de quien consulta)
-- =====================================================================

-- Total cobrado vs. pagado por orden.
--   estado_pago: sin_total (aún no hay total ni pagos) | sin_pago | parcial | pagado | sobrepago
create or replace view public.v_saldo_ordenes
with (security_invoker = true) as
select
  o.id                                            as orden_id,
  v.placa,
  c.nombre                                        as cliente,
  c.telefono,
  o.estado,
  o.fecha_entrega,
  o.total_cobrado,
  coalesce(p.pagado, 0)                           as pagado,
  o.total_cobrado - coalesce(p.pagado, 0)         as saldo,
  case
    when o.total_cobrado <= 0 and coalesce(p.pagado, 0) <= 0 then 'sin_total'
    when coalesce(p.pagado, 0) <= 0                          then 'sin_pago'
    when coalesce(p.pagado, 0) <  o.total_cobrado            then 'parcial'
    when coalesce(p.pagado, 0) =  o.total_cobrado            then 'pagado'
    else 'sobrepago'
  end                                             as estado_pago,
  p.ultimo_pago
from public.ordenes_servicio o
join public.vehiculos v on v.id = o.vehiculo_id
join public.clientes  c on c.id = v.cliente_id
left join (
  select orden_id,
         sum(case when es_devolucion then -monto else monto end) as pagado,
         max(fecha) filter (where not es_devolucion)             as ultimo_pago
  from public.pagos_orden
  where not anulado
  group by orden_id
) p on p.orden_id = o.id;

-- Cuentas por cobrar: órdenes no canceladas con saldo pendiente.
create or replace view public.v_cartera
with (security_invoker = true) as
select
  s.orden_id,
  s.placa,
  s.cliente,
  s.telefono,
  s.estado,
  s.fecha_entrega,
  s.total_cobrado,
  s.pagado,
  s.saldo,
  s.estado_pago,
  s.ultimo_pago,
  -- Antigüedad de la deuda (solo si ya se entregó).
  case
    when s.fecha_entrega is null then null
    else (now() at time zone 'America/Bogota')::date
         - (s.fecha_entrega at time zone 'America/Bogota')::date
  end                                             as dias_desde_entrega
from public.v_saldo_ordenes s
where s.estado <> 'cancelado'
  and s.total_cobrado > 0
  and s.saldo > 0;

-- Dinero realmente recibido por mes (base de caja), neto de devoluciones.
create or replace view public.v_recaudo_mensual
with (security_invoker = true) as
select
  date_trunc('month', fecha)::date                                                        as mes,
  sum(case when es_devolucion then 0 else monto end)                                      as recaudado,
  sum(case when es_devolucion then monto else 0 end)                                      as devoluciones,
  sum(case when es_devolucion then -monto else monto end)                                 as neto,
  sum(case when es_devolucion then -monto else monto end) filter (where medio = 'efectivo')      as neto_efectivo,
  sum(case when es_devolucion then -monto else monto end) filter (where medio = 'transferencia') as neto_transferencia,
  sum(case when es_devolucion then -monto else monto end) filter (where medio = 'tarjeta')       as neto_tarjeta,
  sum(case when es_devolucion then -monto else monto end) filter (where medio = 'otro')          as neto_otro
from public.pagos_orden
where not anulado
group by 1;


-- =====================================================================
-- 5. RLS
-- =====================================================================
alter table public.pagos_orden enable row level security;

drop policy if exists pagos_staff_select on public.pagos_orden;
drop policy if exists pagos_staff_insert on public.pagos_orden;

-- Staff (admin/operario) lee y registra. NO hay políticas de update ni delete:
-- los pagos son inmutables; la anulación pasa por public.anular_pago().
create policy pagos_staff_select on public.pagos_orden
  for select to authenticated using ((select public.es_staff()));

create policy pagos_staff_insert on public.pagos_orden
  for insert to authenticated
  with check (
    (select public.es_staff())
    and registrado_por is not distinct from (select auth.uid())
    and anulado = false
  );

revoke all on public.pagos_orden from anon;
revoke update, delete on public.pagos_orden from authenticated;


-- =====================================================================
-- 6. PORTAL PÚBLICO: agrega 'pagado' y 'saldo' al objeto 'orden'
--    (mismo contrato que la Fase 1 + 2 claves nuevas; no expone medio,
--     referencia ni quién registró el pago)
-- =====================================================================
create or replace function public.obtener_orden_publica(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'orden', jsonb_build_object(
      'estado',             o.estado,
      'fecha_ingreso',      o.fecha_ingreso,
      'fecha_entrega',      o.fecha_entrega,
      'dias_garantia',      o.dias_garantia,
      'fecha_fin_garantia', o.fecha_fin_garantia,
      'garantia_semaforo',  case
                              when o.fecha_fin_garantia is null then null
                              when o.fecha_fin_garantia < (now() at time zone 'America/Bogota')::date then 'rojo'
                              when o.fecha_fin_garantia - (now() at time zone 'America/Bogota')::date <= 7 then 'amarillo'
                              else 'verde'
                            end,
      'mano_obra',          o.mano_obra,
      'total_cobrado',      o.total_cobrado,
      'pagado',             pg.pagado,
      'saldo',              o.total_cobrado - pg.pagado
    ),
    'cliente',  jsonb_build_object('nombre', c.nombre),
    'vehiculo', jsonb_build_object(
      'placa', v.placa, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio
    ),
    'repuestos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre',          i.nombre,
               'cantidad',        r.cantidad_usada,
               'unidad',          i.tipo_unidad,
               'precio_unitario', r.precio_unitario
             ) order by r.created_at)
      from public.orden_repuestos r
      join public.inventario i on i.id = r.inventario_id
      where r.orden_id = o.id
    ), '[]'::jsonb),
    'evidencias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo',       e.tipo,
               'url_imagen', e.url_imagen,
               'notas',      e.notas
             ) order by e.created_at)
      from public.evidencias_fotograficas e
      where e.orden_id = o.id
        and e.tipo <> 'factura_compra'      -- las facturas de proveedor son internas
    ), '[]'::jsonb)
  )
  from public.ordenes_servicio o
  join public.vehiculos v on v.id = o.vehiculo_id
  join public.clientes  c on c.id = v.cliente_id
  cross join lateral (
    select coalesce(sum(case when p.es_devolucion then -p.monto else p.monto end), 0) as pagado
    from public.pagos_orden p
    where p.orden_id = o.id and not p.anulado
  ) pg
  where o.token_publico = p_token
    and o.estado <> 'cancelado'
  limit 1;
$$;

revoke all on function public.obtener_orden_publica(text) from public, anon, authenticated;
grant execute on function public.obtener_orden_publica(text) to anon, authenticated, service_role;


-- =====================================================================
-- 7. OPCIONAL · Migración de órdenes ya entregadas (EJECUTAR A CONSCIENCIA)
--
--    Las órdenes entregadas ANTES de existir esta tabla no tienen pagos, así que
--    aparecerían como 100 % por cobrar. Si en el taller esas órdenes se cobraron
--    completas al entregar, descomenta y ejecuta este bloque: crea un pago por el
--    total de cada orden entregada sin pagos (medio 'otro', con nota de migración).
--    Es idempotente. NO lo ejecutes si alguna de esas órdenes quedó debiendo dinero.
-- =====================================================================
-- insert into public.pagos_orden (orden_id, fecha, monto, medio, notas, registrado_por)
-- select o.id,
--        (coalesce(o.fecha_entrega, o.created_at) at time zone 'America/Bogota')::date,
--        o.total_cobrado,
--        'otro',
--        'Migración: cobrada al entregar (anterior al módulo de pagos)',
--        null
-- from public.ordenes_servicio o
-- where o.estado = 'entregado'
--   and o.total_cobrado > 0
--   and not exists (select 1 from public.pagos_orden p where p.orden_id = o.id);

-- =====================================================================
-- FIN · Fase 3
-- =====================================================================
