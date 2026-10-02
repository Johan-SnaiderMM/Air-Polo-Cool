import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DIAS_ATRASADAS, instanteBogota, sumarDias } from "@/lib/agenda";
import { hoyBogota } from "@/lib/caja";
import { armarAviso } from "@/lib/push/resumen";
import { clavesVapid, enviarAviso, type ResultadoEnvio } from "@/lib/push/servidor";
import type { Database, FranjaAviso } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type ResultadoDiario =
  | { estado: "sin_configurar" }
  | { estado: "nada_que_avisar" }
  | { estado: "ya_enviado" }
  | { estado: "sin_suscripciones" }
  | ({ estado: "enviado"; cuerpo: string } & ResultadoEnvio);

/**
 * Resumen de la agenda a todos los teléfonos suscritos (lo llama el proceso programado).
 *
 *  - Cuenta SOLO citas reales: el cliente de servicio salta el RLS, así que las de prueba de soporte
 *    (es_prueba) se excluyen aquí de forma explícita y nunca generan un aviso.
 *  - Es idempotente: reserva (fecha, franja) antes de enviar; si el proceso corre dos veces el mismo
 *    día, la segunda no manda nada. Si el envío falla por completo, libera la reserva para reintentar.
 */
export async function enviarResumenDiario(admin: Admin, franja: FranjaAviso, hoy = hoyBogota()): Promise<ResultadoDiario> {
  const claves = clavesVapid();
  if (!claves) return { estado: "sin_configurar" };

  const dia = franja === "dia" ? hoy : sumarDias(hoy, 1);
  const desde = instanteBogota(dia, "00:00");
  const hasta = instanteBogota(sumarDias(dia, 1), "00:00");

  const [delDia, atrasadas] = await Promise.all([
    admin
      .from("citas")
      .select("id, recordatorio_enviado_at")
      .eq("es_prueba", false)
      .eq("estado", "pendiente")
      .gte("fecha_hora", desde)
      .lt("fecha_hora", hasta)
      .limit(1000),
    franja === "dia"
      ? admin
          .from("citas")
          .select("id", { count: "exact", head: true })
          .eq("es_prueba", false)
          .eq("estado", "pendiente")
          .gte("fecha_hora", instanteBogota(sumarDias(hoy, -DIAS_ATRASADAS), "00:00"))
          .lt("fecha_hora", desde)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (delDia.error) throw new Error(delDia.error.message);
  if (atrasadas.error) throw new Error(atrasadas.error.message);

  const filas = delDia.data ?? [];
  const aviso = armarAviso({
    franja,
    total: filas.length,
    sinRecordar: filas.filter((c) => !c.recordatorio_enviado_at).length,
    atrasadas: atrasadas.count ?? 0,
  });
  if (!aviso) return { estado: "nada_que_avisar" };

  const { data: suscripciones, error: errorSuscripciones } = await admin
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth")
    .limit(1000);
  if (errorSuscripciones) throw new Error(errorSuscripciones.message);
  if (!suscripciones || suscripciones.length === 0) return { estado: "sin_suscripciones" };

  // Reserva del día y franja: un segundo intento (reintento del programador) no repite el aviso.
  const { error: yaReservado } = await admin.from("push_envios").insert({ fecha: hoy, franja });
  if (yaReservado) {
    if (yaReservado.code === "23505") return { estado: "ya_enviado" };
    throw new Error(yaReservado.message);
  }

  try {
    const envio = await enviarAviso(admin, claves, suscripciones, aviso);
    await admin.from("push_envios").update({ enviados: envio.enviados }).eq("fecha", hoy).eq("franja", franja);
    return { estado: "enviado", cuerpo: aviso.cuerpo, ...envio };
  } catch (e) {
    await admin.from("push_envios").delete().eq("fecha", hoy).eq("franja", franja);
    throw e;
  }
}
