"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Snowflake, Trash2 } from "lucide-react";
import { eliminarOrden } from "@/app/(app)/ordenes/actions";

/**
 * Elimina una orden que sigue en «Recibido» (ingreso creado por error). Pide confirmación y, al
 * terminar, vuelve a la lista. La página solo lo muestra si la orden cumple las condiciones.
 */
export function BotonEliminarOrden({ ordenId, placa }: { ordenId: string; placa: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar() {
    if (
      !window.confirm(
        `¿Eliminar la orden de ${placa}? Se borran también sus fotos y los repuestos asignados (el stock vuelve al inventario). No se puede deshacer.`
      )
    ) {
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await eliminarOrden({ ordenId });
      if (r.ok) router.replace("/ordenes");
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2 border-t border-stone-200/70 pt-4">
      <button
        type="button"
        onClick={borrar}
        disabled={pendiente}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brick-300 text-[15px] font-semibold text-brick-700 active:bg-brick-50 disabled:opacity-60"
      >
        {pendiente ? <Snowflake className="size-4 animate-copo" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        Eliminar esta orden
      </button>
      <p className="text-center text-[12px] text-stone-500">Solo mientras está en Recibido y sin pagos.</p>
      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}
    </div>
  );
}
