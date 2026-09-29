"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { recalcularTotal } from "@/app/(app)/ordenes/repuestos-actions";
import { redondearDinero } from "@/lib/inventario";
import { formatearMoneda } from "@/lib/ordenes";

import { Dinero } from "@/components/ui/dinero";
type Props = {
  ordenId: string;
  manoObra: number;
  /** Suma de cantidad × precio_unitario de las líneas. */
  repuestosPrecio: number;
  /** Suma de cantidad × costo_unitario (costo real de compra). */
  repuestosCosto: number;
  totalCobrado: number;
};

function Fila({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${fuerte ? "text-lg font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-stone-600"}>{etiqueta}</dt>
      <dd className={`font-mono tracking-tight tabular-nums ${fuerte ? "" : "font-medium"}`}>{valor}</dd>
    </div>
  );
}

export function ResumenFinanciero({
  ordenId,
  manoObra,
  repuestosPrecio,
  repuestosCosto,
  totalCobrado,
}: Props) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const totalSugerido = redondearDinero(manoObra + repuestosPrecio);
  const sincronizado = redondearDinero(totalCobrado) === totalSugerido;
  const margen = redondearDinero(totalCobrado - repuestosCosto);

  function actualizar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await recalcularTotal(ordenId);
      setMensaje(
        r.ok
          ? { ok: true, texto: r.mensaje ?? "Total actualizado." }
          : { ok: false, texto: r.error }
      );
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4">
      <dl className="space-y-2">
        <Fila etiqueta="Mano de obra" valor={formatearMoneda(manoObra)} />
        <Fila etiqueta="+ Repuestos e insumos" valor={formatearMoneda(repuestosPrecio)} />
        <div className="border-t border-stone-200/70 pt-2">
          <Fila etiqueta="= Total de la orden" valor={formatearMoneda(totalSugerido)} fuerte />
        </div>
      </dl>

      <dl className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
        <Fila etiqueta="Total cobrado (registrado)" valor={formatearMoneda(totalCobrado)} />
        <Fila etiqueta="Costo real de repuestos" valor={formatearMoneda(repuestosCosto)} />
        <Fila etiqueta="Margen bruto" valor={formatearMoneda(margen)} />
      </dl>

      {!sincronizado && (
        <div className="space-y-2">
          <p className="rounded-lg bg-ochre-50 px-3 py-2 text-sm text-ochre-800">
            El total cobrado registrado ({formatearMoneda(totalCobrado)}) no coincide con la
            suma de la orden ({formatearMoneda(totalSugerido)}).
          </p>
          <button
            type="button"
            onClick={actualizar}
            disabled={pendiente}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-semibold text-white active:bg-accent-700 disabled:opacity-60"
          >
            {pendiente ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-5" aria-hidden />
            )}
            Actualizar total cobrado a <Dinero valor={totalSugerido} />
          </button>
        </div>
      )}

      {mensaje && (
        <p
          role={mensaje.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.ok ? "bg-sage-50 text-sage-800" : "bg-brick-50 text-brick-700"
          }`}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
