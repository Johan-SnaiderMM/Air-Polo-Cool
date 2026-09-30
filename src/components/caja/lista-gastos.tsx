"use client";

import { useCallback, useState } from "react";
import { ChevronRight, Paperclip } from "lucide-react";
import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { GastoDrawer } from "@/components/caja/gasto-drawer";
import { Dinero } from "@/components/ui/dinero";
import { inicialAutor } from "@/lib/autor";
import { CATEGORIA_LABEL, etiquetaDia } from "@/lib/caja";
import type { Autor, CategoriaGasto } from "@/types/database";

export type EdicionHistorial = {
  at: string;
  por?: string | null;
  autor?: Autor | null;
  antes?: Record<string, unknown>;
};

export type GastoVista = {
  id: string;
  fecha: string; // YYYY-MM-DD
  categoria: CategoriaGasto;
  descripcion: string | null;
  monto: number;
  /** URL firmada temporal del comprobante (null si no hay o no se pudo firmar). */
  comprobanteUrl: string | null;
  autor: Autor | null;
  ordenId: string | null;
  placa: string | null;
  anulado: boolean;
  anuladoMotivo: string | null;
  anuladoAutor: Autor | null;
  historial: EdicionHistorial[];
};

/**
 * Historial de gastos agrupado por día. Cada fila abre un panel con el detalle,
 * la auditoría (autor, ediciones, anulación) y las acciones. Ya no hay papelera:
 * corregir = editar (queda historial) y borrar = ANULAR con motivo.
 */
export function ListaGastos({ gastos }: { gastos: GastoVista[] }) {
  const [abierto, setAbierto] = useState<GastoVista | null>(null);
  const cerrar = useCallback(() => setAbierto(null), []);

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
    const suma = g.anulado ? 0 : g.monto;
    if (ultimo && ultimo.fecha === g.fecha) {
      ultimo.gastos.push(g);
      ultimo.total += suma;
    } else {
      dias.push({ fecha: g.fecha, gastos: [g], total: suma });
    }
  }

  return (
    <div className="space-y-5">
      {dias.map((dia) => (
        <section key={dia.fecha}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-[13px] font-medium text-stone-500 capitalize">{etiquetaDia(dia.fecha)}</h3>
            <span className="text-sm text-stone-600">
              <Dinero valor={dia.total} />
            </span>
          </div>

          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {dia.gastos.map((g) => {
              const Icono = CATEGORIA_ICONO[g.categoria];
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setAbierto(g)}
                    className="flex w-full items-center gap-3 py-3 pr-3 pl-4 text-left transition-colors active:bg-stone-50"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 ${
                        g.anulado ? "opacity-50" : ""
                      }`}
                    >
                      <Icono className="size-[18px]" strokeWidth={1.5} aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className={`flex items-center gap-2 text-[15px] font-medium ${g.anulado ? "text-stone-400" : ""}`}>
                        <span className="truncate">{CATEGORIA_LABEL[g.categoria]}</span>
                        {g.placa && (
                          <span className="shrink-0 rounded border border-stone-300/70 bg-stone-100 px-1.5 font-mono text-[11px] tracking-wider text-stone-600">
                            {g.placa}
                          </span>
                        )}
                        {g.anulado && (
                          <span className="shrink-0 rounded-full bg-brick-50 px-2 py-0.5 text-[11px] font-medium text-brick-700">
                            Anulado
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-[13px] text-stone-500">
                        {g.descripcion && <span className="truncate">{g.descripcion}</span>}
                        {g.comprobanteUrl && <Paperclip className="size-3 shrink-0" aria-label="Con recibo" />}
                        <span className="shrink-0 rounded-full bg-stone-100 px-1.5 text-[10px] font-medium text-stone-600" title={g.autor ?? ""}>
                          {inicialAutor(g.autor)}
                        </span>
                        {g.historial.length > 0 && <span className="shrink-0 text-[11px]">· editado</span>}
                      </p>
                    </div>

                    <p className={`shrink-0 text-[15px] ${g.anulado ? "text-stone-400 line-through" : ""}`}>
                      <Dinero valor={g.monto} />
                    </p>
                    <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {abierto && <GastoDrawer gasto={abierto} onClose={cerrar} />}
    </div>
  );
}
