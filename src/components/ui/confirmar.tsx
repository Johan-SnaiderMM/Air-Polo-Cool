"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleHelp, Trash2 } from "lucide-react";

/**
 * Confirmación con el estilo de la app, en lugar del cuadro gris del navegador (`window.confirm`).
 *
 *   const confirmar = useConfirmar();
 *   if (!(await confirmar({ titulo: "¿Eliminar la foto?", mensaje: "No se puede deshacer.", tono: "peligro" }))) return;
 *
 * Devuelve una promesa que se resuelve en `true` al confirmar y en `false` al cancelar, tocar fuera o pulsar Esc.
 * Va sobre <dialog> nativo (foco atrapado, Esc, fondo) y usa la misma tarjeta que «Cambiar estado».
 */
export type OpcionesConfirmar = {
  titulo: string;
  mensaje?: string;
  /** Texto del botón principal (por defecto, «Continuar»). */
  confirmar?: string;
  /** «peligro» pinta el botón principal en ladrillo (borrar, descartar, desactivar). */
  tono?: "normal" | "peligro";
};

type Confirmar = (opciones: OpcionesConfirmar) => Promise<boolean>;

const ContextoConfirmar = createContext<Confirmar | null>(null);

type Pendiente = { opciones: OpcionesConfirmar; resolver: (valor: boolean) => void };

export function ConfirmarProvider({ children }: { children: React.ReactNode }) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  // El resultado se fija ANTES de cerrar el diálogo: onClose lo lee para resolver la promesa una sola vez.
  const resultado = useRef(false);

  const confirmar = useCallback<Confirmar>(
    (opciones) =>
      new Promise<boolean>((resolver) => {
        resultado.current = false;
        setPendiente({ opciones, resolver });
      }),
    []
  );

  useEffect(() => {
    const d = dialogo.current;
    if (pendiente && d && !d.open) d.showModal();
  }, [pendiente]);

  function alCerrar() {
    if (!pendiente) return;
    const { resolver } = pendiente;
    setPendiente(null);
    resolver(resultado.current);
  }

  function terminar(valor: boolean) {
    resultado.current = valor;
    dialogo.current?.close();
  }

  const peligro = pendiente?.opciones.tono === "peligro";
  const Icono = peligro ? Trash2 : CircleHelp;

  return (
    <ContextoConfirmar.Provider value={confirmar}>
      {children}
      {pendiente && (
        <dialog
          ref={dialogo}
          onClose={alCerrar}
          onClick={(e) => {
            // Clic en el fondo (fuera de la tarjeta) = cancelar.
            if (e.target === dialogo.current) terminar(false);
          }}
          aria-labelledby="titulo-confirmar"
          className="dialogo-centrado m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-stone-200/70 bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgb(11_22_51/0.45)] backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
        >
          <div className="space-y-5 p-5">
            <header className="flex items-start gap-3">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                  peligro ? "bg-brick-50 text-brick-700" : "bg-stone-100 text-stone-600"
                }`}
              >
                <Icono className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 id="titulo-confirmar" className="font-serif text-[22px] leading-tight font-medium tracking-tight">
                  {pendiente.opciones.titulo}
                </h2>
                {pendiente.opciones.mensaje && (
                  <p className="mt-1.5 text-[14px] leading-snug text-stone-600">{pendiente.opciones.mensaje}</p>
                )}
              </div>
            </header>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => terminar(false)}
                autoFocus
                className="h-12 rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => terminar(true)}
                className={`h-12 rounded-xl text-sm font-semibold text-white ${
                  peligro ? "bg-brick-600 active:bg-brick-700" : "bg-ink active:bg-ink-soft"
                }`}
              >
                {pendiente.opciones.confirmar ?? "Continuar"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </ContextoConfirmar.Provider>
  );
}

export function useConfirmar(): Confirmar {
  const ctx = useContext(ContextoConfirmar);
  if (!ctx) throw new Error("useConfirmar debe usarse dentro de <ConfirmarProvider>");
  return ctx;
}
