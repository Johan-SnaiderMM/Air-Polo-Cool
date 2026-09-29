"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, PackagePlus, Pencil, Plus } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { ItemForm } from "@/components/inventario/item-form";
import { AjusteForm } from "@/components/inventario/ajuste-form";
import { EditarItemForm } from "@/components/inventario/editar-item-form";
import { formatearCantidad, nivelStock } from "@/lib/inventario";
import type { Tables } from "@/types/database";

import { Dinero } from "@/components/ui/dinero";
type Panel =
  | { tipo: "nuevo" }
  | { tipo: "ajuste"; item: Tables<"inventario"> }
  | { tipo: "editar"; item: Tables<"inventario"> }
  | null;

const ESTILO_NIVEL = {
  agotado: {
    borde: "border-brick-400",
    fondo: "bg-brick-50",
    chip: "bg-brick-600 text-white",
    texto: "Agotado",
  },
  critico: {
    borde: "border-ochre-300",
    fondo: "bg-ochre-50",
    chip: "bg-ochre-500 text-white",
    texto: "Por agotarse",
  },
  ok: {
    borde: "border-stone-200/70",
    fondo: "bg-white",
    chip: "",
    texto: "",
  },
} as const;

export function ListaInventario({ items }: { items: Tables<"inventario">[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const cerrar = useCallback(() => setPanel(null), []);

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          No hay ítems que coincidan.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const nivel = nivelStock(item.stock_actual, item.stock_minimo);
            const e = ESTILO_NIVEL[nivel];
            return (
              <li
                key={item.id}
                className={`rounded-2xl border p-4 shadow-soft ${e.borde} ${e.fondo}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{item.nombre}</p>
                    <p className="font-mono text-sm text-stone-500">{item.codigo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-xl font-semibold ${
                        nivel === "agotado"
                          ? "text-brick-700"
                          : nivel === "critico"
                            ? "text-ochre-700"
                            : ""
                      }`}
                    >
                      {formatearCantidad(item.stock_actual, item.tipo_unidad)}
                    </p>
                    <p className="text-xs text-stone-500">
                      mín. {formatearCantidad(item.stock_minimo, item.tipo_unidad)}
                    </p>
                  </div>
                </div>

                {nivel !== "ok" && (
                  <p
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${e.chip}`}
                  >
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {e.texto}
                  </p>
                )}

                <div className="mt-3 flex items-end justify-between gap-3">
                  <dl className="grid grid-cols-2 gap-x-6 text-sm">
                    <div>
                      <dt className="text-xs text-stone-500">Venta</dt>
                      <dd className="font-semibold"><Dinero valor={item.precio_venta} /></dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone-500">Costo</dt>
                      <dd className="font-semibold"><Dinero valor={item.costo_compra} /></dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel({ tipo: "editar", item })}
                    aria-label={`Editar ${item.nombre}`}
                    className="flex size-12 items-center justify-center rounded-xl border border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
                  >
                    <Pencil className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel({ tipo: "ajuste", item })}
                    className="flex h-12 items-center gap-2 rounded-xl bg-sage-700 px-4 text-sm font-semibold text-white active:bg-sage-800"
                  >
                    <PackagePlus className="size-5" aria-hidden />
                    Reponer
                  </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setPanel({ tipo: "nuevo" })}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-accent-600 px-6 text-[15px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(31,30,29,0.45)] active:bg-accent-700"
      >
        <Plus className="size-6" aria-hidden />
        Nuevo ítem
      </button>

      {panel?.tipo === "nuevo" && (
        <Drawer titulo="Nuevo repuesto o insumo" onClose={cerrar}>
          <ItemForm onListo={cerrar} />
        </Drawer>
      )}
      {panel?.tipo === "editar" && (
        <Drawer titulo="Editar ítem" onClose={cerrar}>
          <EditarItemForm item={panel.item} onListo={cerrar} />
        </Drawer>
      )}
      {panel?.tipo === "ajuste" && (
        <Drawer titulo="Reponer existencias" onClose={cerrar}>
          <AjusteForm item={panel.item} onListo={cerrar} />
        </Drawer>
      )}
    </>
  );
}
