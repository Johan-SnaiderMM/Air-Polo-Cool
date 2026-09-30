"use client";

import { useState, useTransition } from "react";
import { Ban, Snowflake } from "lucide-react";

type Resultado = { ok: true } | { ok: false; error: string };

/**
 * Contenido de un panel para ANULAR con motivo obligatorio (nada se borra:
 * queda el registro con quién, cuándo y por qué). Va dentro de un <Drawer>.
 */
export function FormularioAnulacion({
  advertencia,
  etiquetaBoton = "Anular",
  onConfirmar,
  onListo,
}: {
  advertencia: string;
  etiquetaBoton?: string;
  onConfirmar: (motivo: string) => Promise<Resultado>;
  onListo: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function confirmar() {
    if (motivo.trim().length < 3) {
      setError("Escribe el motivo de la anulación.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await onConfirmar(motivo.trim());
      if (r.ok) onListo();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-ochre-50 px-4 py-3 text-sm text-ochre-800">{advertencia}</p>
      <div>
        <label htmlFor="motivo-anulacion" className="mb-1 block text-sm font-medium">
          Motivo
        </label>
        <textarea
          id="motivo-anulacion"
          rows={3}
          maxLength={300}
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: monto mal digitado"
          className="w-full rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-base outline-none focus:border-stone-400"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirmar}
        disabled={pendiente}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brick-700 text-base font-medium text-white active:bg-brick-800 disabled:opacity-60"
      >
        {pendiente ? <Snowflake className="size-5 animate-copo" aria-hidden /> : <Ban className="size-5" aria-hidden />}
        {etiquetaBoton}
      </button>
    </div>
  );
}
