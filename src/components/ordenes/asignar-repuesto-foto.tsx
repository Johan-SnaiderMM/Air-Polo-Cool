"use client";

import { useState, useTransition } from "react";
import { asignarFotoARepuesto } from "@/app/(app)/ordenes/actions";

/** Select compacto para ligar una foto de repuesto (retirado / instalado) a su repuesto. */
export function AsignarRepuestoFoto({
  ordenId,
  evidenciaId,
  repuestos,
}: {
  ordenId: string;
  evidenciaId: string;
  repuestos: { id: string; nombre: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="mt-1">
      <select
        aria-label="Asignar esta foto a un repuesto"
        defaultValue=""
        disabled={pendiente}
        onChange={(e) => {
          const valor = e.target.value;
          if (!valor) return;
          setError(null);
          iniciar(async () => {
            const r = await asignarFotoARepuesto({ ordenId, evidenciaId, ordenRepuestoId: valor });
            if (!r.ok) setError(r.error);
          });
        }}
        className="h-9 w-full rounded-lg border border-stone-300/70 bg-white px-1.5 text-[12px] outline-none focus:border-stone-400 disabled:opacity-50"
      >
        <option value="">Asignar a…</option>
        {repuestos.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-brick-700">
          {error}
        </p>
      )}
    </div>
  );
}
