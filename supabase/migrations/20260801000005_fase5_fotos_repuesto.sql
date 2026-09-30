-- =====================================================================
-- POLO AIR COOL · FASE 5 · Cada foto de repuesto queda ligada a SU repuesto
-- Ejecutar en: Supabase > SQL Editor, DESPUÉS de fase1 a fase4.
-- Idempotente (se puede volver a ejecutar sin efectos secundarios).
--
-- QUÉ HACE
--   1. evidencias_fotograficas.orden_repuesto_id -> la línea de repuesto de la orden
--      (orden_repuestos) a la que pertenece una foto de "repuesto retirado" o
--      "repuesto instalado". Si se quita el repuesto de la orden, la foto se conserva
--      (queda sin asignar).
--   2. Un trigger garantiza que la línea sea de LA MISMA orden y que solo las fotos de
--      repuesto (viejo / nuevo) puedan llevar ese vínculo.
--   3. El portal público (obtener_orden_publica) ahora entrega el id de cada repuesto y a qué
--      repuesto pertenece cada foto, para mostrar "retirado vs. instalado" pieza por pieza.
--   Las fotos ya subidas siguen funcionando: quedan "sin asignar" y se pueden asignar a mano.
-- =====================================================================

alter table public.evidencias_fotograficas
  add column if not exists orden_repuesto_id uuid
  references public.orden_repuestos(id) on delete set null;

create index if not exists idx_evidencias_repuesto
  on public.evidencias_fotograficas (orden_repuesto_id)
  where orden_repuesto_id is not null;

create or replace function public.fn_evidencia_repuesto_coherente()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.orden_repuesto_id is null then
    return new;
  end if;
  if new.tipo not in ('repuesto_viejo', 'repuesto_nuevo') then
    raise exception 'Solo las fotos de repuesto retirado o instalado se ligan a un repuesto.';
  end if;
  if not exists (
    select 1 from public.orden_repuestos r
    where r.id = new.orden_repuesto_id and r.orden_id = new.orden_id
  ) then
    raise exception 'El repuesto elegido no pertenece a esta orden.';
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_evidencia_repuesto_coherente on public.evidencias_fotograficas;
create trigger trg_evidencia_repuesto_coherente
  before insert or update of orden_repuesto_id, tipo, orden_id on public.evidencias_fotograficas
  for each row execute function public.fn_evidencia_repuesto_coherente();

revoke all on function public.fn_evidencia_repuesto_coherente() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC PÚBLICA: portal del cliente  ->  /orden/[token]
-- Devuelve solo lo que el cliente puede ver. NO expone: costos de compra,
-- notas internas, facturas de proveedores, teléfono ni documento.
-- Las rutas de imágenes (url_imagen) se firman en el servidor (Next.js) con
-- el service role: createSignedUrls() sobre el bucket 'evidencias-ordenes'.
-- Retorna NULL si el token no existe o la orden está cancelada.
-- ---------------------------------------------------------------------
-- Incluye 'pagado' y 'saldo' (no expone medio, referencia ni quién registró el pago) y, desde la
-- fase 5, el id de cada repuesto y a qué repuesto pertenece cada foto.
-- ---------------------------------------------------------------------
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
