"use client";

import { useState, useTransition } from "react";
import { Receipt, Trash2 } from "lucide-react";
import { eliminarGasto } from "@/app/(app)/caja-menor/actions";
import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { CATEGORIA_LABEL, etiquetaDia } from "@/lib/caja";
import { formatearMoneda } from "@/lib/ordenes";
import type { CategoriaGasto } from "@/types/database";

import { Dinero } from "@/components/ui/dinero";
export type GastoVista = {
  id: string;
  fecha: string; // YYYY-MM-DD
  categoria: CategoriaGasto;
  descripcion: string | null;
  monto: number;
  /** URL firmada temporal del comprobante (null si no hay o no se pudo firmar). */
  comprobanteUrl: string | null;
};

type Props = {
  gastos: GastoVista[];
  /** Solo el rol admin puede borrar (política RLS gastos_admin_delete). */
  puedeEliminar: boolean;
};

export function ListaGastos({ gastos, puedeEliminar }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (gastos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
        No hay gastos registrados en este mes.
      </p>
    );
  }

  // Agrupa por día (la lista ya viene ordenada de más reciente a más antigua).
  const dias: { fecha: string; gastos: GastoVista[]; total: number }[] = [];
  for (const g of gastos) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === g.fecha) {
      ultimo.gastos.push(g);
      ultimo.total += g.monto;
    } else {
      dias.push({ fecha: g.fecha, gastos: [g], total: g.monto });
    }
  }

  function borrar(g: GastoVista) {
    const detalle = g.descripcion ? ` (${g.descripcion})` : "";
    if (!window.confirm(`¿Eliminar el gasto de ${formatearMoneda(g.monto)}${detalle}?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarGasto(g.id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}

      {dias.map((dia) => (
        <section key={dia.fecha}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-[13px] font-medium text-stone-500 capitalize">
              {etiquetaDia(dia.fecha)}
            </h3>
            <span className="text-sm font-semibold text-stone-600">
              <Dinero valor={dia.total} />
            </span>
          </div>

          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {dia.gastos.map((g) => {
              const Icono = CATEGORIA_ICONO[g.categoria];
              return (
                <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                    <Icono className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{CATEGORIA_LABEL[g.categoria]}</p>
                    {g.descripcion && (
                      <p className="truncate text-sm text-stone-600">{g.descripcion}</p>
                    )}
                  </div>
                  <p className="shrink-0 font-semibold"><Dinero valor={g.monto} /></p>
                  {g.comprobanteUrl && (
                    <a
                      href={g.comprobanteUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Ver comprobante"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-stone-100"
                    >
                      <Receipt className="size-5" aria-hidden />
                    </a>
                  )}
                  {puedeEliminar && (
                    <button
                      type="button"
                      onClick={() => borrar(g)}
                      disabled={pendiente}
                      aria-label="Eliminar gasto"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-brick-700 active:bg-brick-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
