"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ajustarStock, type InventarioFormState } from "@/app/(app)/inventario/actions";
import { admiteDecimales, formatearCantidad } from "@/lib/inventario";
import type { Tables } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

export function AjusteForm({
  item,
  onListo,
}: {
  item: Tables<"inventario">;
  onListo: () => void;
}) {
  const [state, action, pending] = useActionState<InventarioFormState, FormData>(
    ajustarStock,
    {}
  );
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");

  useEffect(() => {
    if (state.ok) onListo();
  }, [state.ok, onListo]);

  const suma = Number(cantidad);
  const previsto =
    cantidad !== "" && Number.isFinite(suma) && suma > 0
      ? formatearCantidad(item.stock_actual + suma, item.tipo_unidad)
      : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="inventario_id" value={item.id} />

      <div className="rounded-xl bg-stone-100 px-4 py-3">
        <p className="font-semibold">{item.nombre}</p>
        <p className="text-sm text-stone-600">
          {item.codigo} · Stock actual:{" "}
          <strong>{formatearCantidad(item.stock_actual, item.tipo_unidad)}</strong>
        </p>
      </div>

      <div>
        <label htmlFor="cantidad" className={LABEL}>
          Cantidad que ingresa
        </label>
        <input
          id="cantidad"
          name="cantidad"
          type="number"
          inputMode="decimal"
          min={0}
          step={admiteDecimales(item.tipo_unidad) ? "any" : 1}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          autoFocus
          required
          className={INPUT}
        />
        {previsto && (
          <p className="mt-1 text-sm text-stone-600">
            Quedará en <strong>{previsto}</strong>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="costo_compra" className={LABEL}>
          Nuevo costo de compra ($){" "}
          <span className="font-normal text-stone-500">
            (opcional, actual: {item.costo_compra})
          </span>
        </label>
        <input
          id="costo_compra"
          name="costo_compra"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-stone-500">
          Solo afecta a futuras ventas; las órdenes anteriores conservan su costo.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-sage-700 text-base font-semibold text-white active:bg-sage-800 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {pending ? "Guardando…" : "Sumar al inventario"}
      </button>
    </form>
  );
}
