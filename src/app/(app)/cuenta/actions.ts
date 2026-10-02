"use server";

import { validarContrasena } from "@/lib/equipo";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

export type AccionCuenta = { ok: true } | { ok: false; error: string };

/**
 * Cambia la contraseña de quien tiene la sesión abierta. Pide la actual (para que alguien con el teléfono
 * desbloqueado no pueda quedarse con la cuenta) y exige una nueva distinta, larga y con letras y números.
 */
export async function cambiarMiContrasena(datos: { actual: string; nueva: string }): Promise<AccionCuenta> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (!user.email) return { ok: false, error: "Tu usuario no tiene un correo asociado." };

  const actual = typeof datos?.actual === "string" ? datos.actual : "";
  if (!actual) return { ok: false, error: "Escribe tu contraseña actual." };
  const nueva = validarContrasena(datos?.nueva);
  if (!nueva.ok) return { ok: false, error: nueva.error };
  if (nueva.valor === actual) return { ok: false, error: "La contraseña nueva debe ser distinta de la actual." };

  const { error: errActual } = await supabase.auth.signInWithPassword({ email: user.email, password: actual });
  if (errActual) {
    if (errActual.status === 429) return { ok: false, error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." };
    return { ok: false, error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: nueva.valor });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "La contraseña nueva debe ser distinta de la actual." };
    if (error.code === "weak_password") return { ok: false, error: "Esa contraseña es demasiado débil. Prueba con una más larga." };
    return { ok: false, error: `No se pudo cambiar la contraseña: ${error.message}` };
  }
  return { ok: true };
}
