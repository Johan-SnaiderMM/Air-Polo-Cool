import type { Autor } from "@/types/database";

/** Sello de la cuenta de soporte: nadie más puede llamarse así (lo impide la base). */
export const AUTOR_SOPORTE: Autor = "Soporte técnico";

/** Sello de lo que se registró antes de que cada persona tuviera su perfil, y de un usuario sin perfil. */
export const AUTOR_POR_DEFECTO: Autor = "Polo";

export const AUTOR_MAX = 40;

/**
 * Normaliza un valor externo (formulario, cola offline) a un sello válido o null. Solo comprueba la FORMA
 * (texto de 1 a 40 caracteres): quién es de verdad lo decide la base según la sesión, no el teléfono.
 */
export function autorONull(valor: unknown): Autor | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length >= 1 && limpio.length <= AUTOR_MAX ? limpio : null;
}

/** ¿El usuario es el de soporte? La marca vive en app_metadata (no la edita el propio usuario). */
export function esUsuarioSoporte(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.soporte === true;
}

/**
 * Sello de autoría que corresponde a la sesión: el nombre de su perfil; sin perfil (aún no se ejecutó la
 * migración o el usuario es anterior), soporte firma como «Soporte técnico» y el resto como «Polo».
 */
export function autorDeUsuario(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
  perfil?: { nombre: string } | null
): Autor {
  if (perfil?.nombre) return perfil.nombre;
  return esUsuarioSoporte(user) ? AUTOR_SOPORTE : AUTOR_POR_DEFECTO;
}

/** "Polo" -> "P", "Soporte técnico" -> "S" (para insignias compactas). */
export function inicialAutor(autor: Autor | null | undefined): string {
  return autor ? autor.charAt(0).toUpperCase() : "·";
}
