"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Acordeón sobrio para datos secundarios: cabecera con título + resumen de una línea y chevron.
 * Colapsado por defecto. El contenido sigue montado (los campos de un formulario conservan su
 * valor) y se anima con grid-template-rows; cerrado, queda inerte (sin foco ni lectura).
 */
export function Colapsable({
  titulo,
  resumen,
  defaultAbierto = false,
  children,
}: {
  titulo: string;
  resumen?: string;
  defaultAbierto?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const id = useId();

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((a) => !a)}
          className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left transition-colors active:bg-stone-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{titulo}</span>
            {resumen && <span className="block truncate text-[13px] text-stone-500">{resumen}</span>}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-stone-400 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={id}
        inert={!abierto}
        className={`grid transition-all duration-200 ease-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-stone-200/70 px-5 pt-4 pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
