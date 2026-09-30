"use client";

import { useActionState, useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import { crearItem, type InventarioFormState } from "@/app/(app)/inventario/actions";
import { TIPOS_UNIDAD, UNIDAD_LABEL, admiteDecimales } from "@/lib/inventario";
import type { TipoUnidad } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

type Valores = {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo_unidad: TipoUnidad;
  stock_actual: string;
  stock_minimo: string;
  costo_compra: string;
  precio_venta: string;
};

const VACIO: Valores = {
  codigo: "",
  nombre: "",
  descripcion: "",
  tipo_unidad: "unidad",
  stock_actual: "",
  stock_minimo: "",
  costo_compra: "",
  precio_venta: "",
};

export function ItemForm({ onListo }: { onListo: () => void }) {
  const [state, action, pending] = useActionState<InventarioFormState, FormData>(
    crearItem,
    {}
  );
  const [v, setV] = useState<Valores>(VACIO);

  useEffect(() => {
    if (state.ok) onListo();
  }, [state.ok, onListo]);

  function set<K extends keyof Valores>(k: K, valor: Valores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }));
  }

  const paso = admiteDecimales(v.tipo_unidad) ? "any" : 1;

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="codigo" className={LABEL}>
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            value={v.codigo}
            onChange={(e) => set("codigo", e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="tipo_unidad" className={LABEL}>
            Unidad de medida
          </label>
          <select
            id="tipo_unidad"
            name="tipo_unidad"
            value={v.tipo_unidad}
            onChange={(e) => set("tipo_unidad", e.target.value as TipoUnidad)}
            className={INPUT}
          >
            {TIPOS_UNIDAD.map((u) => (
              <option key={u} value={u}>
                {UNIDAD_LABEL[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="nombre" className={LABEL}>
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          value={v.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder="Compresor 7SEU17C, Refrigerante R134a…"
          autoComplete="off"
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="descripcion" className={LABEL}>
          Descripción <span className="font-normal text-stone-500">(opcional)</span>
        </label>
        <input
          id="descripcion"
          name="descripcion"
          value={v.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          autoComplete="off"
          className={INPUT}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="stock_actual" className={LABEL}>
            Stock inicial
          </label>
          <input
            id="stock_actual"
            name="stock_actual"
            type="number"
            inputMode="decimal"
            min={0}
            step={paso}
            placeholder="0"
            value={v.stock_actual}
            onChange={(e) => set("stock_actual", e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="stock_minimo" className={LABEL}>
            Stock mínimo
          </label>
          <input
            id="stock_minimo"
            name="stock_minimo"
            type="number"
            inputMode="decimal"
            min={0}
            step={paso}
            placeholder="0"
            value={v.stock_minimo}
            onChange={(e) => set("stock_minimo", e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="costo_compra" className={LABEL}>
            Costo compra ($)
          </label>
          <input
            id="costo_compra"
            name="costo_compra"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            value={v.costo_compra}
            onChange={(e) => set("costo_compra", e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="precio_venta" className={LABEL}>
            Precio venta ($)
          </label>
          <input
            id="precio_venta"
            name="precio_venta"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            value={v.precio_venta}
            onChange={(e) => set("precio_venta", e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

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
        {pending && <Snowflake className="size-5 animate-copo" aria-hidden />}
        {pending ? "Guardando…" : "Registrar ítem"}
      </button>
    </form>
  );
}
