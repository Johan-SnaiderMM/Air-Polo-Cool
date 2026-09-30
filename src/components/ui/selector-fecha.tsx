"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { etiquetaDia, hoyBogota } from "@/lib/caja";

/**
 * Fecha del registro: por defecto HOY, mostrada como un control secundario discreto
 * ("Hoy · cambiar"). Al pulsarlo aparece el selector nativo (no admite fechas futuras).
 */
export function SelectorFecha({
  value,
  onChange,
  etiqueta = "Fecha",
}: {
  value: string;
  onChange: (fecha: string) => void;
  etiqueta?: string;
}) {
  const hoy = hoyBogota();
  const [abierto, setAbierto] = useState(false);
  const esHoy = value === hoy;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 text-[13px] text-stone-500 active:text-ink"
      >
        <CalendarDays className="size-4" strokeWidth={1.5} aria-hidden />
        <span>
          {esHoy ? "Hoy" : etiquetaDia(value)} · <span className="underline underline-offset-2">cambiar fecha</span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="selector-fecha" className="text-[13px] text-stone-500">
        {etiqueta}
      </label>
      <input
        id="selector-fecha"
        type="date"
        max={hoy}
        value={value}
        onChange={(e) => onChange(e.target.value && e.target.value <= hoy ? e.target.value : hoy)}
        className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-[14px] outline-none focus:border-stone-400"
      />
      {!esHoy && (
        <button
          type="button"
          onClick={() => {
            onChange(hoy);
            setAbierto(false);
          }}
          className="text-[13px] text-stone-500 underline underline-offset-2"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
