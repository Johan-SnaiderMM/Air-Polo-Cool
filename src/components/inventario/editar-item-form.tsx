"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { editarItem, type InventarioFormState } from "@/app/(app)/inventario/actions";
import { UNIDAD_LABEL, admiteDecimales, formatearCantidad } from "@/lib/inventario";
import type { Tables } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

export function EditarItemForm({
  item,
  onListo,
}: {
  item: Tables<"inventario">;
  onListo: () => void;
}) {
  const [state, action, pending] = useActionState<InventarioFormState, FormData>(editarItem, {});
  const [v, setV] = useState({
    codigo: item.codigo,
    nombre: item.nombre,
    descripcion: item.descripcion ?? "",
    stock_minimo: String(item.stock_minimo),
    costo_compra: String(item.costo_compra),
    precio_venta: String(item.precio_venta),
  });

  useEffect(() => {
    if (state.ok) onListo();
  }, [state.ok, onListo]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="inventario_id" value={item.id} />

      <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
        Stock actual: <strong>{formatearCantidad(item.stock_actual, item.tipo_unidad)}</strong> ·
        Unidad: {UNIDAD_LABEL[item.tipo_unidad]}. El stock solo cambia con “Reponer” o al usar el
        ítem en una orden.
      </p>

      <div>
        <label htmlFor="ei_codigo" className={LABEL}>Código</label>
        <input id="ei_codigo" name="codigo" value={v.codigo} onChange={(e) => setV({ ...v, codigo: e.target.value })} required className={INPUT} />
      </div>
      <div>
        <label htmlFor="ei_nombre" className={LABEL}>Nombre</label>
        <input id="ei_nombre" name="nombre" value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} required className={INPUT} />
      </div>
      <div>
        <label htmlFor="ei_desc" className={LABEL}>Descripción <span className="font-normal text-stone-500">(opcional)</span></label>
        <input id="ei_desc" name="descripcion" value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} className={INPUT} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="ei_min" className={LABEL}>Mínimo</label>
          <input id="ei_min" name="stock_minimo" type="number" inputMode="decimal" min={0} step={admiteDecimales(item.tipo_unidad) ? "any" : 1} value={v.stock_minimo} onChange={(e) => setV({ ...v, stock_minimo: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="ei_costo" className={LABEL}>Costo ($)</label>
          <input id="ei_costo" name="costo_compra" type="number" inputMode="decimal" min={0} step="any" value={v.costo_compra} onChange={(e) => setV({ ...v, costo_compra: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="ei_precio" className={LABEL}>Venta ($)</label>
          <input id="ei_precio" name="precio_venta" type="number" inputMode="decimal" min={0} step="any" value={v.precio_venta} onChange={(e) => setV({ ...v, precio_venta: e.target.value })} className={INPUT} />
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Los cambios de precio solo afectan a futuras ventas; las órdenes anteriores conservan el suyo.
      </p>

      {state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white active:bg-ink-soft disabled:opacity-60"
      >
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
