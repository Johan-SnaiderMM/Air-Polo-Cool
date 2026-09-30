"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Snowflake, Send } from "lucide-react";
import { enviarWhatsAppOrden } from "@/app/(app)/ordenes/notificaciones-actions";
import type { PlantillaWhatsApp } from "@/lib/whatsapp";

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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
      <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
        {botones.map((b) => (
          <li key={b.plantilla} className="flex items-stretch">
            <a
              href={b.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3.5 px-5 py-2 transition-colors active:bg-stone-50"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  b.sugerido ? "bg-sage-100 text-sage-700" : "bg-stone-100 text-stone-500"
                }`}
              >
                <IconoWhatsApp className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{b.label}</span>
              {b.sugerido && (
                <span className="shrink-0 rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-medium text-sage-800">
                  Sugerido
                </span>
              )}
            </a>

            {automaticoConfigurado && (
              <button
                type="button"
                onClick={() => enviarAuto(b.plantilla)}
                disabled={pendiente}
                aria-label={`Enviar automáticamente: ${b.label}`}
                title="Enviar automáticamente desde el WhatsApp del taller"
                className="flex w-14 shrink-0 items-center justify-center border-l border-stone-200/70 text-stone-500 transition-colors active:bg-stone-50 disabled:opacity-50"
              >
                {enviando === b.plantilla ? (
                  <Snowflake className="size-5 animate-copo" aria-hidden />
                ) : (
                  <Send className="size-5" strokeWidth={1.5} aria-hidden />
                )}
              </button>
            )}
          </li>
        ))}

        <li>
          <a
            href={urlPublica}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center gap-3.5 px-5 py-2 transition-colors active:bg-stone-50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <ExternalLink className="size-[18px]" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="flex-1 text-[15px] font-medium">Ver portal del cliente</span>
          </a>
        </li>
      </ul>

      <p className="px-1 text-[12px] text-stone-500">
        {automaticoConfigurado
          ? "Toca el mensaje para abrir WhatsApp con el texto listo; el avión lo envía solo desde el WhatsApp del taller."
          : "Toca el mensaje para abrir WhatsApp con el texto listo para enviar."}
      </p>

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
