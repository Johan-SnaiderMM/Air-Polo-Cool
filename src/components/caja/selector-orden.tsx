"use client";

import { useMemo, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import { useSync } from "@/components/sync/sync-provider";
import { buscarOrdenesLocal, type OrdenLocal } from "@/lib/offline/snapshot";
import { ESTADO_LABEL } from "@/lib/ordenes";

/**
 * Asocia (opcionalmente) un gasto o pago a una orden. Busca en el snapshot local
 * (placa o cliente), así funciona igual sin conexión.
 */
export function SelectorOrden({
  value,
  onChange,
  etiqueta = "Asociar a una orden (opcional)",
}: {
  value: OrdenLocal | null;
  onChange: (orden: OrdenLocal | null) => void;
  etiqueta?: string;
}) {
  const { snapshot } = useSync();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");

  const resultados = useMemo(() => buscarOrdenesLocal(snapshot, consulta), [snapshot, consulta]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stone-200/80 bg-stone-50 px-3 py-2">
        <Link2 className="size-4 shrink-0 text-stone-500" strokeWidth={1.5} aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[14px]">
          <span className="font-mono font-semibold tracking-wider">{value.placa}</span>
          <span className="text-stone-500"> · {value.cliente}</span>
        </p>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Quitar orden asociada"
          className="flex size-8 items-center justify-center rounded-full text-stone-500 active:bg-stone-200/70"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 text-[13px] text-stone-500 active:text-ink"
      >
        <Link2 className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="underline underline-offset-2">{etiqueta}</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          autoFocus
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Placa o cliente"
          aria-label="Buscar orden por placa o cliente"
          className="h-11 w-full rounded-xl border border-stone-200/80 bg-white pr-3 pl-9 text-[15px] outline-none focus:border-stone-400 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      {!snapshot ? (
        <p className="text-[13px] text-stone-500">
          Aún no hay datos descargados. Conéctate una vez para poder asociar órdenes sin red.
        </p>
      ) : resultados.length === 0 ? (
        <p className="text-[13px] text-stone-500">Sin coincidencias.</p>
      ) : (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-stone-200/70 bg-white">
          {resultados.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(o);
                  setAbierto(false);
                  setConsulta("");
                }}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-stone-50"
              >
                <span className="font-mono text-[14px] font-semibold tracking-wider">{o.placa}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-stone-500">
                  {o.cliente} · {ESTADO_LABEL[o.estado]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setAbierto(false)} className="text-[13px] text-stone-500 underline underline-offset-2">
        Cancelar
      </button>
    </div>
  );
}
