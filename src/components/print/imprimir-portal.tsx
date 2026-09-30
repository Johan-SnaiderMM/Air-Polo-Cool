"use client";

import { Printer } from "lucide-react";

/** Botón del portal público: abre el diálogo de impresión ("Guardar como PDF"). */
export function ImprimirPortal() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100 print:hidden"
    >
      <Printer className="size-4" aria-hidden /> Guardar o imprimir como PDF
    </button>
  );
}
