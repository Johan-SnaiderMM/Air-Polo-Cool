-- =====================================================================
-- POLO AIR COOL · FASE 12 · REPUESTO FUERA DE INVENTARIO + TOTAL QUE SE ACTUALIZA SOLO
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere las fases 1 a 11.
--
-- PROBLEMA QUE RESUELVE
--   Un repuesto comprado para un trabajo (que no está en el inventario) solo quedaba como un egreso: bajaba el
--   margen, pero nadie se lo COBRABA al cliente, y el total a cobrar tampoco seguía a los repuestos cargados.
--   Resultado: el taller «regalaba» la pieza y el margen salía en pérdida.
--
-- QUÉ HACE
--   1. Una línea de repuesto de una orden puede ser un repuesto SIN inventario: lleva su `nombre`, su costo de
--      compra y su precio al cliente. No mueve stock. Su costo entra al balance como cualquier repuesto, y su
--      precio entra al total de la orden.
--   2. El total cobrado SIGUE a los repuestos: al agregar, cambiar o quitar una línea, el total de la orden pasa
--      a ser «mano de obra + repuestos a precio de venta» SI antes estaba al día con ese cálculo. Si alguien lo
--      puso a mano distinto (un descuento, un total pactado o una cotización convertida), no se toca.
--   3. El portal del cliente muestra también esos repuestos (con su precio de venta; nunca el costo).
-- =====================================================================


-- =====================================================================
-- 1. orden_repuestos: inventario_id opcional + nombre
-- =====================================================================
alter table public.orden_repuestos alter column inventario_id drop not null;
alter table public.orden_repuestos add column if not exists nombre text;

alter table public.orden_repuestos drop constraint if exists chk_repuesto_origen;
alter table public.orden_repuestos add constraint chk_repuesto_origen
  check (inventario_id is not null or char_length(btrim(coalesce(nombre, ''))) between 1 and 80);


-- =====================================================================
-- 2. Stock: solo se mueve si la línea es de inventario
-- =====================================================================
create or replace function public.fn_orden_repuestos_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado public.estado_orden;
  v_inv    public.inventario;
begin
  if tg_op = 'DELETE' then
    if old.inventario_id is not null then
      perform public.fn_mover_stock(old.inventario_id, old.cantidad_usada);
    end if;
    return old;
  end if;

  select estado into v_estado from public.ordenes_servicio where id = new.orden_id;
  if v_estado in ('entregado', 'cancelado') then
    raise exception 'La orden está % y no admite cambios de repuestos', v_estado
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    if new.inventario_id is not null then
      v_inv := public.fn_mover_stock(new.inventario_id, -new.cantidad_usada);
      new.costo_unitario  := coalesce(new.costo_unitario,  v_inv.costo_compra);
      new.precio_unitario := coalesce(new.precio_unitario, v_inv.precio_venta);
    end if;

  else -- UPDATE
    if new.orden_id <> old.orden_id then
      raise exception 'No se puede mover un repuesto a otra orden; elimínalo y créalo de nuevo'
        using errcode = 'check_violation';
    end if;

    if new.inventario_id is not distinct from old.inventario_id then
      if new.inventario_id is not null and new.cantidad_usada <> old.cantidad_usada then
        perform public.fn_mover_stock(new.inventario_id, old.cantidad_usada - new.cantidad_usada);
      end if;
    else
      if old.inventario_id is not null then
        perform public.fn_mover_stock(old.inventario_id, old.cantidad_usada);
      end if;
      if new.inventario_id is not null then
        v_inv := public.fn_mover_stock(new.inventario_id, -new.cantidad_usada);
        new.costo_unitario  := coalesce(new.costo_unitario,  v_inv.costo_compra);
        new.precio_unitario := coalesce(new.precio_unitario, v_inv.precio_venta);
      end if;
    end if;
  end if;

  return new;
end $$;

revoke all on function public.fn_orden_repuestos_stock() from public, anon, authenticated;


-- =====================================================================
-- 3. El total cobrado sigue a los repuestos (si estaba al día)
-- =====================================================================
create or replace function public.fn_orden_repuestos_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_orden  uuid := coalesce(new.orden_id, old.orden_id);
  o        public.ordenes_servicio;
  v_nuevo  numeric;
  v_delta  numeric := 0;
  v_antes  numeric;
begin
  -- La orden pudo borrarse (los repuestos caen en cascada): no hay nada que ajustar.
  select * into o from public.ordenes_servicio where id = v_orden for update;
  if not found then
    return null;
  end if;

  select coalesce(sum(cantidad_usada * precio_unitario), 0) into v_nuevo
    from public.orden_repuestos where orden_id = v_orden;

  if tg_op in ('INSERT', 'UPDATE') then
    v_delta := v_delta + new.cantidad_usada * new.precio_unitario;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_delta := v_delta - old.cantidad_usada * old.precio_unitario;
  end if;
  v_antes := v_nuevo - v_delta;

  -- Solo se sigue a los repuestos si el total estaba al día con «mano de obra + repuestos» ANTES de este cambio.
  if round(o.total_cobrado, 2) = round(o.mano_obra + v_antes, 2)
     and round(o.total_cobrado, 2) <> round(o.mano_obra + v_nuevo, 2) then
    update public.ordenes_servicio
       set total_cobrado = round(o.mano_obra + v_nuevo, 2)
     where id = v_orden;
  end if;

  return null;
end $$;

drop trigger if exists trg_orden_repuestos_total on public.orden_repuestos;
create trigger trg_orden_repuestos_total
  after insert or update or delete on public.orden_repuestos
  for each row execute function public.fn_orden_repuestos_total();

revoke all on function public.fn_orden_repuestos_total() from public, anon, authenticated;


-- =====================================================================
-- 4. Portal público: también los repuestos sin inventario (precio de venta, nunca el costo)
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
               'id',              r.id,
               'nombre',          coalesce(i.nombre, r.nombre),
               'cantidad',        r.cantidad_usada,
               'unidad',          coalesce(i.tipo_unidad::text, 'unidad'),
               'precio_unitario', r.precio_unitario
             ) order by r.created_at)
      from public.orden_repuestos r
      left join public.inventario i on i.id = r.inventario_id
      where r.orden_id = o.id
    ), '[]'::jsonb),
    'evidencias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo',       e.tipo,
               'url_imagen', e.url_imagen,
               'notas',      e.notas,
               'orden_repuesto_id', e.orden_repuesto_id
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
-- FIN · Fase 12
-- =====================================================================
