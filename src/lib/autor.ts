import type { Autor } from "@/types/database";

/** Dos operadores: cada uno entra con su propio usuario y el sello sale de la sesión. */
export const AUTORES: readonly Autor[] = ["Polo", "Soporte técnico"] as const;

export const AUTOR_POR_DEFECTO: Autor = "Polo";

export function esAutor(valor: unknown): valor is Autor {
  return typeof valor === "string" && (AUTORES as readonly string[]).includes(valor);
}

/** Normaliza un valor externo (formulario, cola offline) a un Autor válido o null. */
export function autorONull(valor: unknown): Autor | null {
  return esAutor(valor) ? valor : null;
}

/** ¿El usuario es el de soporte? La marca vive en app_metadata (no la edita el propio usuario). */
export function esUsuarioSoporte(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.soporte === true;
}

/** Sello de autoría que corresponde a la sesión: soporte firma como «Soporte técnico»; el resto, «Polo». */
export function autorDeUsuario(user: { app_metadata?: Record<string, unknown> } | null | undefined): Autor {
  return esUsuarioSoporte(user) ? "Soporte técnico" : AUTOR_POR_DEFECTO;
}

/** "Polo" -> "P", "Soporte técnico" -> "S" (para insignias compactas). */
export function inicialAutor(autor: Autor | null | undefined): string {
  return autor ? autor.charAt(0).toUpperCase() : "·";
}
