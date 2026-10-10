-- =====================================================================
-- POLO AIR COOL · FASE 13 · EL TOTAL DE LA ORDEN NO SE QUEDA EN $0 CON MANO DE OBRA
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere las fases 1 a 12.
--
-- PROBLEMA
--   Una orden con solo mano de obra (sin repuestos) quedaba con «total a cobrar» $0 si no se escribía el total
--   a mano: el cliente no debía nada y el taller no cobraba su trabajo.
--
-- QUÉ HACE (un trigger en ordenes_servicio)
--   1. Si el total queda en 0 y hay mano de obra, el total pasa a ser «mano de obra + repuestos a precio de venta».
--   2. Si el total estaba al día con «mano de obra + repuestos» y se cambia SOLO la mano de obra, el total la sigue.
--      Un total escrito a mano distinto (descuento, total pactado) o cambiado a propósito en la misma edición
--      no se toca.
--   3. Arregla las órdenes ABIERTAS que ya estaban en $0 con mano de obra. Las entregadas y canceladas no se
--      tocan (su cuenta ya está cerrada).
-- =====================================================================

create or replace function public.fn_orden_total_por_defecto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_repuestos numeric;
begin
  select coalesce(sum(cantidad_usada * precio_unitario), 0) into v_repuestos
    from public.orden_repuestos where orden_id = new.id;

  -- 1. Total en 0 con mano de obra: se cobra el trabajo.
  if coalesce(new.total_cobrado, 0) = 0 and coalesce(new.mano_obra, 0) > 0 then
    new.total_cobrado := round(new.mano_obra + v_repuestos, 2);
    return new;
  end if;

  -- 2. Solo cambió la mano de obra y el total estaba al día: lo sigue.
  if tg_op = 'UPDATE'
     and new.mano_obra is distinct from old.mano_obra
     and new.total_cobrado is not distinct from old.total_cobrado
     and round(old.total_cobrado, 2) = round(old.mano_obra + v_repuestos, 2) then
    new.total_cobrado := round(new.mano_obra + v_repuestos, 2);
  end if;

  return new;
end $$;

revoke all on function public.fn_orden_total_por_defecto() from public, anon, authenticated;

-- «trg_20»: corre después de la guardia de soporte («trg_00») y de fn_orden_before_write (orden alfabético).
drop trigger if exists trg_20_orden_total_por_defecto on public.ordenes_servicio;
create trigger trg_20_orden_total_por_defecto
  before insert or update of total_cobrado, mano_obra on public.ordenes_servicio
  for each row execute function public.fn_orden_total_por_defecto();

-- 3. Órdenes abiertas que ya estaban en $0 con mano de obra.
update public.ordenes_servicio
   set total_cobrado = total_cobrado
 where total_cobrado = 0
   and mano_obra > 0
   and estado not in ('entregado', 'cancelado');

-- =====================================================================
-- FIN · Fase 13
-- =====================================================================
