import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Aviso } from "@/lib/push/resumen";

type Admin = SupabaseClient<Database>;

/** Cuánto tiempo guarda el servicio de avisos uno que no pudo entregar (teléfono apagado o sin red). */
const TTL_SEGUNDOS = 6 * 60 * 60;

export type ClavesVapid = { publica: string; privada: string; asunto: string };

/** Claves de los avisos (ver .env.example); null si faltan: sin ellas no se puede enviar nada. */
export function clavesVapid(): ClavesVapid | null {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const asunto = process.env.VAPID_SUBJECT;
  return publica && privada && asunto ? { publica, privada, asunto } : null;
}

export type SuscripcionGuardada = { id: string; endpoint: string; p256dh: string; auth: string };

export type ResultadoEnvio = {
  enviados: number;
  /** Suscripciones que el servicio de avisos ya no reconoce (se desinstaló o revocó el permiso): se borran. */
  retiradas: number;
  fallidas: number;
};

/** Manda un aviso a esas suscripciones y borra las que ya no existen (404/410). */
export async function enviarAviso(admin: Admin, claves: ClavesVapid, suscripciones: SuscripcionGuardada[], aviso: Aviso): Promise<ResultadoEnvio> {
  webpush.setVapidDetails(claves.asunto, claves.publica, claves.privada);
  const carga = JSON.stringify(aviso);

  const resultados = await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, {
          TTL: TTL_SEGUNDOS,
          urgency: "normal",
        });
        return "enviado" as const;
      } catch (e) {
        const estado = (e as { statusCode?: number }).statusCode;
        return estado === 404 || estado === 410 ? ("retirada" as const) : ("fallida" as const);
      }
    })
  );

  const retirar = suscripciones.filter((_, i) => resultados[i] === "retirada").map((s) => s.id);
  if (retirar.length > 0) await admin.from("push_suscripciones").delete().in("id", retirar);

  return {
    enviados: resultados.filter((r) => r === "enviado").length,
    retiradas: retirar.length,
    fallidas: resultados.filter((r) => r === "fallida").length,
  };
}
