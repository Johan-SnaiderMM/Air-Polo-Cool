"use server";

import { revalidatePath } from "next/cache";
import { esUsuarioSoporte } from "@/lib/autor";
import { mensajeDeError } from "@/lib/errores";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Acciones exclusivas del usuario de soporte: cambiar entre datos reales y de prueba, y activar
 * el mantenimiento. La regla real vive en la base (las funciones rechazan a cualquier otro
 * usuario); la comprobación de aquí solo da un mensaje claro sin viaje a la base.
 */
export type AccionSoporte = { ok: true } | { ok: false; error: string };

const SOLO_SOPORTE: AccionSoporte = { ok: false, error: "Esta acción es solo para el usuario de soporte." };

function refrescar() {
  revalidatePath("/", "layout");
}

export async function cambiarModoPrueba(activo: boolean): Promise<AccionSoporte> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (!esUsuarioSoporte(user)) return SOLO_SOPORTE;

  const { error } = await supabase.rpc("cambiar_modo_prueba", { p_activo: activo === true });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true };
}

export async function cambiarMantenimiento(activo: boolean, motivo: string): Promise<AccionSoporte> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (!esUsuarioSoporte(user)) return SOLO_SOPORTE;

  const { error } = await supabase.rpc("cambiar_mantenimiento", {
    p_activo: activo === true,
    p_motivo: typeof motivo === "string" ? motivo : null,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true };
}
