-- =====================================================================
-- POLO AIR COOL · FASE 14 · OTROS CARGOS DE LA ORDEN (gasolina, flete, parqueadero…)
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere las fases 1 a 13.
--
-- Hay gastos que se hacen POR el trabajo y que se le cobran al cliente, pero que no son repuestos ni mano de
-- obra (echarle gasolina al carro, un flete, el parqueadero, un peaje…). Una línea de la orden ahora puede ser
-- de tipo «cargo»:
--   · sin inventario: lleva su nombre («Gasolina»), lo que costó (opcional) y lo que se le cobra al cliente;
--   · su precio se suma al total de la orden y al saldo por cobrar (igual que un repuesto: lo hace la fase 12);
--   · su costo baja el margen y el balance;
--   · el portal del cliente lo muestra aparte, en «Otros cargos», con su valor (nunca el costo).
-- =====================================================================

alter table public.orden_repuestos add column if not exists tipo text not null default 'repuesto';

alter table public.orden_repuestos drop constraint if exists chk_orden_repuestos_tipo;
alter table public.orden_repuestos add constraint chk_orden_repuestos_tipo
  check (tipo in ('repuesto', 'cargo'));

-- Un cargo nunca viene del inventario (no tiene stock que mover).
alter table public.orden_repuestos drop constraint if exists chk_cargo_sin_inventario;
alter table public.orden_repuestos add constraint chk_cargo_sin_inventario
  check (tipo <> 'cargo' or inventario_id is null);

-- Portal público: cada línea indica si es repuesto o cargo.
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
               'tipo',            r.tipo,
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
-- FIN · Fase 14
-- =====================================================================
