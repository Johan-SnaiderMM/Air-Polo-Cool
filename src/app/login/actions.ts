"use server";

import { redirect } from "next/navigation";
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const rol = data.user.app_metadata?.rol;
  if (typeof rol !== "string" || !ROLES_VALIDOS.includes(rol)) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu usuario no tiene un rol asignado (admin u operario). Contacta al administrador.",
    };
  }

  redirect(destinoSeguro(formData.get("next")));
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
