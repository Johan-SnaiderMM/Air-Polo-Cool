"use server";

import { cargarContextoOrden, enviarWhatsApp } from "@/lib/notificaciones";
import { esUuid } from "@/lib/ordenes";
import type { PlantillaWhatsApp } from "@/lib/whatsapp";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

export type EnvioAccionResultado = { ok: true; mensaje: string } | { ok: false; error: string };

const PLANTILLAS: PlantillaWhatsApp[] = ["recepcion", "listo", "entregado"];

/**
 * Despacho automático manual (botón "Enviar automáticamente") vía
 * Evolution API / WAHA. Complementa al enlace wa.me de la interfaz.
 */
export async function enviarWhatsAppOrden(datos: {
  ordenId: string;
  plantilla: PlantillaWhatsApp;
}): Promise<EnvioAccionResultado> {
  const { ordenId, plantilla } = datos;
  if (!esUuid(ordenId) || !PLANTILLAS.includes(plantilla)) {
    return { ok: false, error: "Datos inválidos." };
  }

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const contexto = await cargarContextoOrden(supabase, ordenId);
  if (!contexto) return { ok: false, error: "No se encontró la orden o el cliente." };

  const r = await enviarWhatsApp(contexto.telefono, contexto.mensajes[plantilla]);
  return r.ok
    ? { ok: true, mensaje: "Mensaje enviado por WhatsApp." }
    : { ok: false, error: r.error };
}
