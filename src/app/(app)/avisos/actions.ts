"use server";

import { esUsuarioSoporte } from "@/lib/autor";
import { validar } from "@/lib/esquemas/comunes";
import { suscripcionSchema } from "@/lib/esquemas/aviso";
import { mensajeDeError } from "@/lib/errores";
import { clavesVapid, enviarAviso } from "@/lib/push/servidor";
import { createAdminClient } from "@/utils/supabase/admin";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Suscribir o quitar un teléfono de los avisos de la agenda. Las suscripciones las escribe SOLO el
 * servidor (clave de servicio): un mismo teléfono puede pasar de un usuario a otro, y ningún usuario
 * lee ni toca las de los demás. Siempre se opera sobre el usuario de la sesión.
 */
export type AccionAviso = { ok: true } | { ok: false; error: string };

const SIN_CONFIGURAR = { ok: false, error: "Los avisos aún no están configurados en el servidor." } as const;

/** Guarda (o actualiza) la suscripción de este teléfono para el usuario de la sesión. */
export async function guardarSuscripcion(datos: unknown, agente?: string): Promise<AccionAviso> {
  const { user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const s = validar(suscripcionSchema, datos);
  if (!s.ok) return { ok: false, error: s.error };

  const admin = createAdminClient();
  if (!admin || !clavesVapid()) return SIN_CONFIGURAR;

  const { error } = await admin.from("push_suscripciones").upsert(
    {
      user_id: user.id,
      endpoint: s.valor.endpoint,
      p256dh: s.valor.keys.p256dh,
      auth: s.valor.keys.auth,
      es_soporte: esUsuarioSoporte(user),
      user_agent: typeof agente === "string" ? agente.slice(0, 300) : null,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true };
}

/** Quita la suscripción de este teléfono (solo si es del usuario de la sesión). */
export async function quitarSuscripcion(datos: { endpoint: string }): Promise<AccionAviso> {
  const { user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (typeof datos?.endpoint !== "string" || datos.endpoint === "") return { ok: false, error: "Suscripción inválida." };

  const admin = createAdminClient();
  if (!admin) return SIN_CONFIGURAR;

  const { error } = await admin.from("push_suscripciones").delete().eq("endpoint", datos.endpoint).eq("user_id", user.id);
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true };
}

/**
 * Solo soporte: manda un aviso de prueba a SUS teléfonos suscritos (a nadie más), para comprobar que
 * llega sin que el taller se entere.
 */
export async function enviarAvisoDePrueba(): Promise<{ ok: true; enviados: number } | { ok: false; error: string }> {
  const { user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (!esUsuarioSoporte(user)) return { ok: false, error: "Esta acción es solo para el usuario de soporte." };

  const admin = createAdminClient();
  const claves = clavesVapid();
  if (!admin || !claves) return SIN_CONFIGURAR;

  const { data, error } = await admin.from("push_suscripciones").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Este teléfono no está suscrito: activa los avisos primero." };

  const r = await enviarAviso(admin, claves, data, {
    titulo: "Prueba de avisos",
    cuerpo: "Así llegará el resumen de la agenda. Solo lo recibes tú.",
    url: "/agenda",
    etiqueta: "prueba",
  });
  return r.enviados > 0 ? { ok: true, enviados: r.enviados } : { ok: false, error: "No se pudo entregar el aviso. Vuelve a activar los avisos en este teléfono." };
}
