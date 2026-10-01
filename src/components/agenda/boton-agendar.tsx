"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { FormularioCita } from "@/components/agenda/formulario-cita";

/** Botón de la cabecera de la agenda: abre el formulario para una cita nueva. */
export function BotonAgendar() {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-600 pr-5 pl-4 text-sm font-medium text-white transition-colors active:bg-accent-700"
      >
        <Plus className="size-[18px]" strokeWidth={2.25} aria-hidden />
        Agendar
      </button>
      {abierto && <FormularioCita onClose={cerrar} />}
    </>
  );
}
