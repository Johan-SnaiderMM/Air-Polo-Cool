"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { filtrarEvento } from "@/lib/analitica";

/**
 * Uso de las pantallas y velocidad real de carga (Vercel Web Analytics y Speed Insights): sin cookies y
 * sin datos personales. Cada evento pasa antes por `filtrarEvento`, que descarta el portal del cliente y
 * borra identificadores y parámetros de la dirección. Solo envía algo en producción y una vez activado en
 * Vercel (proyecto → Analytics / Speed Insights).
 */
export function Analitica() {
  return (
    <>
      <Analytics beforeSend={filtrarEvento} />
      <SpeedInsights beforeSend={(evento) => filtrarEvento(evento)} />
    </>
  );
}
