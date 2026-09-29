"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { enviarWhatsAppOrden } from "@/app/(app)/ordenes/notificaciones-actions";
import type { PlantillaWhatsApp } from "@/lib/whatsapp";

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <g transform="translate(6.6 6.4) scale(0.5)">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}

export type BotonWhatsApp = {
  plantilla: PlantillaWhatsApp;
  label: string;
  /** Enlace wa.me con el mensaje ya redactado. */
  href: string;
  sugerido: boolean;
};

type Props = {
  ordenId: string;
  botones: BotonWhatsApp[];
  urlPublica: string;
  /** Hay proveedor (Evolution/WAHA) configurado en el servidor. */
  automaticoConfigurado: boolean;
};

export function NotificacionesWhatsApp({
  ordenId,
  botones,
  urlPublica,
  automaticoConfigurado,
}: Props) {
  const [pendiente, iniciar] = useTransition();
  const [enviando, setEnviando] = useState<PlantillaWhatsApp | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  function enviarAuto(plantilla: PlantillaWhatsApp) {
    setMensaje(null);
    setEnviando(plantilla);
    iniciar(async () => {
      const r = await enviarWhatsAppOrden({ ordenId, plantilla });
      setMensaje(
        r.ok ? { ok: true, texto: r.mensaje } : { ok: false, texto: r.error }
      );
      setEnviando(null);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {botones.map((b) => (
          <li key={b.plantilla} className="flex gap-2">
            <a
              href={b.href}
              target="_blank"
              rel="noreferrer"
              className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl px-4 text-base font-semibold text-white transition-colors ${
                b.sugerido
                  ? "bg-sage-700 active:bg-sage-800"
                  : "bg-stone-600 active:bg-stone-700"
              }`}
            >
              <IconoWhatsApp className="size-7 shrink-0" />
              {b.label}
            </a>

            {automaticoConfigurado && (
              <button
                type="button"
                onClick={() => enviarAuto(b.plantilla)}
                disabled={pendiente}
                aria-label={`Enviar automáticamente: ${b.label}`}
                title="Enviar automáticamente desde el WhatsApp del taller"
                className="flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-stone-300/70 bg-white text-stone-700 active:bg-stone-100 disabled:opacity-50"
              >
                {enviando === b.plantilla ? (
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-6" aria-hidden />
                )}
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-stone-500">
        {automaticoConfigurado
          ? "El botón verde abre WhatsApp con el mensaje listo; el ícono de avión lo envía solo desde el WhatsApp del taller."
          : "El botón abre WhatsApp con el mensaje listo para enviar. El envío automático no está configurado."}
      </p>

      <a
        href={urlPublica}
        target="_blank"
        rel="noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-sm font-semibold text-ink active:bg-stone-100"
      >
        <ExternalLink className="size-4" aria-hidden />
        Ver portal del cliente
      </a>

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
