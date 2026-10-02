"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ipDeCliente,
  MENSAJE_CREDENCIALES,
  MENSAJE_LIMITE_PROVEEDOR,
  mensajeBloqueo,
  normalizarCorreo,
} from "@/lib/login-limite";
import { bloqueoVigente, clavesLogin, limpiarAcierto, registrarFallo } from "@/lib/servidor/login-limite";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type LoginState = { error?: string };

const ROLES_VALIDOS = ["admin", "operario"];

/** Solo rutas internas: evita open-redirect vía ?next=. */
function destinoSeguro(next: FormDataEntryValue | null): string {
  if (typeof next === "string" && /^\/(?!\/)[^\\]*$/.test(next)) return next;
  return "/";
}

export async function iniciarSesion(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  // Límite de intentos (fase 9): se consulta ANTES de preguntarle a Supabase, para que quien está bloqueado
  // no pueda seguir probando contraseñas. Sin la clave de servicio no hay límite adicional (el de Supabase sigue).
  const admin = createAdminClient();
  const claves = admin
    ? clavesLogin({ correo: normalizarCorreo(email), ip: ipDeCliente(await headers()) }, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    : [];
  if (admin) {
    const bloqueo = await bloqueoVigente(admin, claves);
    if (bloqueo) return { error: mensajeBloqueo(bloqueo) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // El límite propio de Supabase (429) no es una contraseña mala: se avisa distinto y no suma al contador.
    if (error?.status === 429) return { error: MENSAJE_LIMITE_PROVEEDOR };
    const bloqueo = admin ? await registrarFallo(admin, claves) : null;
    // Mismo mensaje exista o no el correo: no se revela quién tiene cuenta.
    return { error: bloqueo ? mensajeBloqueo(bloqueo) : MENSAJE_CREDENCIALES };
  }

  const rol = data.user.app_metadata?.rol;
  if (typeof rol !== "string" || !ROLES_VALIDOS.includes(rol)) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu usuario no tiene un rol asignado (admin u operario). Contacta al administrador.",
    };
  }

  if (admin) await limpiarAcierto(admin, claves);
  redirect(destinoSeguro(formData.get("next")));
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
