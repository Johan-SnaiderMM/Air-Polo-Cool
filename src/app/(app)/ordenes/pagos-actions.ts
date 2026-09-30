"use server";

import { revalidatePath } from "next/cache";
import { mensajeDeError } from "@/lib/errores";
import { esUuid } from "@/lib/ordenes";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

export type AccionPago = { ok: true; mensaje?: string } | { ok: false; error: string };

/** Anula un pago (nunca se borra): queda quién, cuándo y por qué. Requiere conexión. */
export async function anularPago(datos: {
  pagoId: string;
  ordenId: string;
  motivo: string;
}): Promise<AccionPago> {
  if (!esUuid(datos.pagoId) || !esUuid(datos.ordenId)) return { ok: false, error: "Datos inválidos." };
  if (datos.motivo.trim().length < 3) return { ok: false, error: "Escribe el motivo de la anulación." };

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { error } = await supabase.rpc("anular_pago", {
    p_pago_id: datos.pagoId,
    p_motivo: datos.motivo.trim().slice(0, 300),
  });
  if (error) return { ok: false, error: mensajeDeError(error) };

  revalidatePath(`/ordenes/${datos.ordenId}`);
  revalidatePath("/cartera");
  revalidatePath("/caja-menor");
  revalidatePath("/");
  return { ok: true, mensaje: "Pago anulado." };
}
