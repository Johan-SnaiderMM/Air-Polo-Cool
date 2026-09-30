"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * Barra superior de las vistas imprimibles (no sale en el papel).
 * "Imprimir / guardar PDF" abre el diálogo del navegador: en el celular, elige
 * "Guardar como PDF" para compartir el archivo por WhatsApp o correo.
 */
export function BarraImpresion({ volver, titulo = "Imprimir / guardar PDF" }: { volver: string; titulo?: string }) {
  return (
    <div className="no-imprimir mb-4 flex items-center justify-between gap-3 print:hidden">
      <Link
        href={volver}
        className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-stone-600 active:bg-stone-200/70"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-white active:bg-ink-soft"
      >
        <Printer className="size-4" aria-hidden /> {titulo}
      </button>
    </div>
  );
}
