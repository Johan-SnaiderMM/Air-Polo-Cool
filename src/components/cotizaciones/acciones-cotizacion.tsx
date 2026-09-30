"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Snowflake, Pencil, Printer, Send, X } from "lucide-react";
import { cambiarEstadoCotizacion, convertirCotizacion } from "@/app/(app)/cotizaciones/actions";
import { useAutor } from "@/components/sync/autor-provider";
import type { EstadoCotizacion } from "@/types/database";

type Props = {
  id: string;
  estado: EstadoCotizacion;
  ordenId: string | null;
  /** Enlace wa.me con el resumen ya redactado (null si el cliente no tiene teléfono). */
  whatsappHref: string | null;
};

/** Flujo de la cotización: enviar → aprobar/rechazar → convertir en orden de trabajo. */
export function AccionesCotizacion({ id, estado, ordenId, whatsappHref }: Props) {
  const router = useRouter();
  const { autor } = useAutor();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiar(nuevo: EstadoCotizacion) {
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoCotizacion({ id, estado: nuevo });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function convertir() {
    if (!window.confirm("Se creará una orden de trabajo con la mano de obra y el total de esta cotización. ¿Continuar?")) {
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await convertirCotizacion({ id, autor });
      if (r.ok && r.ordenId) router.push(`/ordenes/${r.ordenId}`);
      else if (!r.ok) setError(r.error);
    });
  }

  const boton =
    "flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100 disabled:opacity-50";
  const cerrada = estado === "convertida";

  return (
    <div className="space-y-3">
      {cerrada && ordenId && (
        <Link
          href={`/ordenes/${ordenId}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white active:bg-ink-soft"
        >
          <ClipboardCheck className="size-4" aria-hidden /> Ver la orden creada
        </Link>
      )}

      {!cerrada && estado !== "rechazada" && (
        <button
          type="button"
          onClick={convertir}
          disabled={pendiente}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white active:bg-accent-700 disabled:opacity-60"
        >
          {pendiente ? <Snowflake className="size-5 animate-copo" aria-hidden /> : <ClipboardCheck className="size-5" aria-hidden />}
          Convertir en orden de trabajo
        </button>
      )}

      {!cerrada && (
        <div className="grid grid-cols-2 gap-2">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => estado === "borrador" && cambiar("enviada")}
              className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-sage-700 text-sm font-medium text-white active:bg-sage-800"
            >
              <Send className="size-4" aria-hidden /> Enviar por WhatsApp
            </a>
          )}
          {estado !== "aprobada" && (
            <button type="button" className={boton} disabled={pendiente} onClick={() => cambiar("aprobada")}>
              <Check className="size-4" aria-hidden /> Marcar aprobada
            </button>
          )}
          {estado !== "rechazada" && (
            <button type="button" className={boton} disabled={pendiente} onClick={() => cambiar("rechazada")}>
              <X className="size-4" aria-hidden /> Marcar rechazada
            </button>
          )}
          {estado === "rechazada" && (
            <button type="button" className={boton} disabled={pendiente} onClick={() => cambiar("borrador")}>
              Reabrir como borrador
            </button>
          )}
          {estado === "borrador" && (
            <button type="button" className={boton} disabled={pendiente} onClick={() => cambiar("enviada")}>
              Marcar enviada
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!cerrada && (
          <Link href={`/cotizaciones/${id}/editar`} className={boton}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        )}
        <Link href={`/cotizaciones/${id}/imprimir`} className={`${boton} ${cerrada ? "col-span-2" : ""}`}>
          <Printer className="size-4" aria-hidden /> PDF
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}
    </div>
  );
}
