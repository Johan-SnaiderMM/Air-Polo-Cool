import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/**
 * Comprobación de sesión única para Server Actions y rutas. getUser() valida el token contra
 * Supabase Auth (nunca confiar en getSession()). Elige la variante según cómo debe reaccionar
 * quien llama cuando NO hay sesión:
 *
 *  - obtenerSesion(): devuelve el cliente y `user` (null si no hay sesión); quien llama decide
 *    (devolver SESION_EXPIRADA, una lista vacía, un 401…).
 *  - exigirSesion(): para acciones de formulario; sin sesión redirige a /login.
 */
export type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

export const ERROR_SESION = "Tu sesión expiró. Vuelve a ingresar.";

/** Resultado estándar de una acción sin sesión (compatible con los tipos { ok: false; error }). */
export const SESION_EXPIRADA = { ok: false, error: ERROR_SESION } as const;

/**
 * Memoizada por petición: el layout y la página piden la sesión en la misma carga y así solo se
 * valida una vez contra Supabase Auth.
 */
export const obtenerSesion = cache(async (): Promise<{ supabase: ClienteServidor; user: User | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

export async function exigirSesion(): Promise<{ supabase: ClienteServidor; user: User }> {
  const { supabase, user } = await obtenerSesion();
  if (!user) redirect("/login");
  return { supabase, user };
}
