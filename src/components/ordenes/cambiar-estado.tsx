"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CloudOff, Snowflake } from "lucide-react";
import { cambiarEstadoOrden } from "@/app/(app)/ordenes/actions";
import { SelectorMantenimiento, type MesesMantenimiento } from "@/components/ordenes/selector-mantenimiento";
import { useSync } from "@/components/sync/sync-provider";
import { Dinero } from "@/components/ui/dinero";
import { ESTADOS_FLUJO, ESTADO_DOT, ESTADO_LABEL, ESTADO_SUPERFICIE } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

type Props = {
  ordenId: string;
  estado: EstadoOrden;
  placa: string;
  vehiculo: string;
  /** Saldo por cobrar (si se conoce): se avisa al marcar como entregado. */
  saldo?: number;
  mantenimientoMeses?: MesesMantenimiento;
};

/**
 * Badge de estado que es a la vez botón: al tocarlo abre un diálogo centrado para cambiar el
 * estado con un toque, dejar una observación y, si pasa a Listo/Entregado, elegir el próximo
 * mantenimiento. Nada cambia hasta pulsar «Guardar cambio».
 */
export function CambiarEstado(props: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Estado: ${ESTADO_LABEL[props.estado]}. Toca para cambiarlo`}
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-transform before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] active:scale-95 ${ESTADO_SUPERFICIE[props.estado]}`}
      >
        <span className={`size-1.5 rounded-full ${ESTADO_DOT[props.estado]}`} aria-hidden />
        {ESTADO_LABEL[props.estado]}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </button>
      {abierto && <ModalEstado {...props} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function ModalEstado({
  ordenId,
  estado,
  placa,
  vehiculo,
  saldo = 0,
  mantenimientoMeses = null,
  onCerrar,
}: Props & { onCerrar: () => void }) {
  const router = useRouter();
  const { online } = useSync();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [destino, setDestino] = useState<EstadoOrden>(estado);
  const [nota, setNota] = useState("");
  const [meses, setMeses] = useState<MesesMantenimiento>(mantenimientoMeses);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Se monta solo al abrir: así el formulario siempre arranca limpio.
  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  const cambia = destino !== estado;
  const pideMantenimiento = destino === "listo" || destino === "entregado";
  const esCancelacion = destino === "cancelado";
  const faltaMotivo = esCancelacion && nota.trim().length < 3;
  const puedeGuardar = cambia && online && !faltaMotivo && !pendiente;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoOrden({
        ordenId,
        estado: destino,
        nota,
        mantenimientoMeses: pideMantenimiento ? meses : null,
      });
      if (!r.ok) return setError(r.error);
      router.refresh();
      if (r.aviso) setAviso(r.aviso);
      else dialogo.current?.close();
    });
  }

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      onClick={(e) => {
        // Clic en el fondo (fuera de la tarjeta) cierra, salvo mientras guarda.
        if (e.target === dialogo.current && !pendiente) dialogo.current?.close();
      }}
      aria-labelledby="titulo-cambiar-estado"
      className="dialogo-centrado m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-stone-200/70 bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgb(11_22_51/0.45)] backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="space-y-5 p-5">
        <header>
          <h2 id="titulo-cambiar-estado" className="font-serif text-[22px] leading-tight font-medium tracking-tight">
            {aviso ? "Estado actualizado" : "Cambiar estado"}
          </h2>
          <p className="mt-1 text-[13px] text-stone-500">
            <span className="font-mono font-semibold tracking-wider text-ink">{placa}</span> · {vehiculo}
          </p>
        </header>

        {aviso ? (
          <>
            <p role="status" className="flex items-start gap-2 rounded-xl bg-sage-50 px-3.5 py-3 text-sm text-sage-800">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Ahora está en <strong>{ESTADO_LABEL[destino]}</strong>. {aviso}
              </span>
            </p>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="h-12 w-full rounded-xl bg-ink text-sm font-semibold text-white active:bg-ink-soft"
            >
              Listo
            </button>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="Nuevo estado" className="grid grid-cols-2 gap-2">
              {ESTADOS_FLUJO.map((e) => {
                const elegido = e === destino;
                return (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => setDestino(e)}
                    className={`relative flex h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 text-left text-[14px] font-medium transition-all duration-150 ${ESTADO_SUPERFICIE[e]} ${
                      elegido ? "ring-2 ring-ink" : "opacity-75 active:opacity-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${ESTADO_DOT[e]}`} aria-hidden />
                      {ESTADO_LABEL[e]}
                    </span>
                    {e === estado && <span className="pl-4 text-[11px] font-normal opacity-70">Actual</span>}
                    {elegido && <Check className="absolute top-2 right-2 size-3.5" strokeWidth={2.5} aria-hidden />}
                  </button>
                );
              })}
            </div>

            {cambia && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="nota-estado" className="mb-1.5 block text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
                    {esCancelacion ? "Motivo (obligatorio)" : "Observación (opcional)"}
                  </label>
                  <textarea
                    id="nota-estado"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={2}
                    maxLength={200}
                    placeholder={
                      esCancelacion
                        ? "Ej: el cliente desistió de la reparación"
                        : "Ej: llegó el compresor, pruebas de presión OK"
                    }
                    className="w-full resize-none rounded-xl border border-stone-300/70 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
                  />
                </div>

                {pideMantenimiento && <SelectorMantenimiento value={meses} onChange={setMeses} destacar />}

                {destino === "entregado" && saldo > 0 && (
                  <p className="flex items-center justify-between gap-3 rounded-xl bg-ochre-50 px-3.5 py-2.5 text-[13px] text-ochre-800">
                    <span>Aún queda un saldo por cobrar</span>
                    <Dinero valor={saldo} className="font-medium" />
                  </p>
                )}
              </div>
            )}

            {!online && (
              <p className="flex items-start gap-2 rounded-xl bg-ochre-50 px-3.5 py-2.5 text-[13px] text-ochre-800">
                <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                Cambiar el estado requiere conexión.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-brick-50 px-3.5 py-2.5 text-[13px] text-brick-700">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                disabled={pendiente}
                className="h-12 rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={!puedeGuardar}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white transition-colors active:bg-ink-soft disabled:bg-stone-200 disabled:text-stone-400"
              >
                {pendiente && <Snowflake className="size-4 animate-copo" aria-hidden />}
                {pendiente ? "Guardando…" : "Guardar cambio"}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
