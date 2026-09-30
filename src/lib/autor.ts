import type { Autor } from "@/types/database";

/** Solo dos operadores: sin cuentas ni roles nuevos, solo un sello de autoría. */
export const AUTORES: readonly Autor[] = ["Polo", "Soporte técnico"] as const;

export const AUTOR_POR_DEFECTO: Autor = "Polo";

export function esAutor(valor: unknown): valor is Autor {
  return typeof valor === "string" && (AUTORES as readonly string[]).includes(valor);
}

/** Normaliza un valor externo (formulario, cola offline) a un Autor válido o null. */
export function autorONull(valor: unknown): Autor | null {
  return esAutor(valor) ? valor : null;
}

/** "Polo" -> "P", "Soporte técnico" -> "S" (para insignias compactas). */
export function inicialAutor(autor: Autor | null | undefined): string {
  return autor ? autor.charAt(0).toUpperCase() : "·";
}
