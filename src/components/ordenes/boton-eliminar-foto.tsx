"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { eliminarEvidencia } from "@/app/(app)/ordenes/actions";

export function BotonEliminarFoto({
  ordenId,
  evidenciaId,
}: {
  ordenId: string;
  evidenciaId: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar() {
    if (!window.confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarEvidencia({ ordenId, evidenciaId });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={borrar}
        disabled={pendiente}
        aria-label="Eliminar foto"
        className="absolute right-1 bottom-1 flex size-10 items-center justify-center rounded-full bg-black/60 text-white active:bg-brick-700 disabled:opacity-60"
      >
        {pendiente ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-5" aria-hidden />
        )}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute inset-x-1 top-1 rounded bg-brick-600 px-1 py-0.5 text-[10px] leading-tight text-white"
        >
          {error}
        </span>
      )}
    </>
  );
}
