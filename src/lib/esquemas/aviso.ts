/**
 * Esquema de la suscripción a los avisos: lo que entrega `PushSubscription.toJSON()` del navegador.
 * El servidor valida todo antes de guardarla (nunca confía en lo que llega).
 */
import { z } from "zod";
import { campo } from "@/lib/esquemas/comunes";

export const MSG_SUSCRIPCION = "La suscripción a los avisos no es válida.";

const BASE64URL = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

/** Dirección que da el navegador para enviarle avisos: siempre https y de tamaño razonable. */
const esEndpoint = (v: unknown): v is string => {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

const clave = () => campo((v) => (typeof v === "string" && BASE64URL.test(v) ? v : undefined), MSG_SUSCRIPCION);

export const suscripcionSchema = z.object({
  endpoint: campo((v) => (esEndpoint(v) ? v : undefined), MSG_SUSCRIPCION),
  keys: z.unknown().pipe(z.object({ p256dh: clave(), auth: clave() })),
});

export type SuscripcionPush = z.output<typeof suscripcionSchema>;
