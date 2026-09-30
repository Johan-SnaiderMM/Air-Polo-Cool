"use client";

import { BellRing } from "lucide-react";

export type MesesMantenimiento = 3 | 6 | 12 | null;

const OPCIONES: { valor: MesesMantenimiento; label: string }[] = [
  { valor: null, label: "Sin aviso" },
  { valor: 3, label: "3 meses" },
  { valor: 6, label: "6 meses" },
  { valor: 12, label: "12 meses" },
];

/**
 * "¿Próximo mantenimiento preventivo?" — se ofrece al marcar el vehículo como
 * Listo/Entregado. El sistema calcula la fecha y luego la lista en las alertas.
 */
export function SelectorMantenimiento({
  value,
  onChange,
  destacar,
}: {
  value: MesesMantenimiento;
  onChange: (meses: MesesMantenimiento) => void;
  /** true cuando el vehículo está Listo/Entregado y aún no se eligió: resalta la pregunta. */
  destacar: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destacar && value === null ? "border-ochre-300 bg-ochre-50" : "border-stone-200/70 bg-white"
      }`}
    >
      <p className="mb-2 flex items-center gap-2 text-[14px] font-medium">
        <BellRing className="size-4 text-stone-500" strokeWidth={1.5} aria-hidden />
        ¿Próximo mantenimiento preventivo?
      </p>
      <div role="radiogroup" aria-label="Próximo mantenimiento" className="grid grid-cols-4 gap-2">
        {OPCIONES.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={value === o.valor}
            onClick={() => onChange(o.valor)}
            className={`h-11 rounded-xl border-[1.5px] text-[12px] transition-colors ${
              value === o.valor
                ? "border-ink bg-stone-100 font-medium text-ink"
                : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-stone-500">
        Se cuenta desde la entrega y aparece en las alertas del inicio con un botón para avisarle al cliente por WhatsApp.
      </p>
    </div>
  );
}
