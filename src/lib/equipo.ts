/**
 * Reglas del equipo (módulo puro, sin red): cómo debe ser el nombre visible de una persona, su correo y la
 * contraseña. Las usa la pantalla Equipo (servidor) y se prueban aparte.
 */
import { AUTOR_MAX, AUTOR_POR_DEFECTO, AUTOR_SOPORTE } from "@/lib/autor";

export const NOMBRE_MIN = 2;
export const CONTRASENA_MIN = 12;
/** bcrypt (lo que usa Supabase Auth) ignora lo que pase de 72 bytes: se rechaza en vez de truncar en silencio. */
export const CONTRASENA_MAX = 72;

/** Minúsculas, sin tildes y con espacios simples: para comparar nombres sin que «Polo», «polo » o «PÓLO» difieran. */
export function nombreClave(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Nombres que nadie puede tomar: son los sellos de siempre y confundirían la autoría. */
const RESERVADOS = new Set([nombreClave(AUTOR_SOPORTE), "soporte", nombreClave(AUTOR_POR_DEFECTO)]);

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string };

/**
 * Nombre visible de un ayudante: letras (con tildes), espacios, punto, guion y apóstrofo. «Polo» queda
 * reservado para el dueño: así lo anterior a los perfiles no se confunde con un ayudante.
 */
export function validarNombre(entrada: unknown): Validacion<string> {
  const nombre = typeof entrada === "string" ? entrada.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < NOMBRE_MIN) return { ok: false, error: `El nombre necesita al menos ${NOMBRE_MIN} letras.` };
  if (nombre.length > AUTOR_MAX) return { ok: false, error: `El nombre admite hasta ${AUTOR_MAX} caracteres.` };
  if (!/^[\p{L}][\p{L} .'’-]*$/u.test(nombre)) {
    return { ok: false, error: "El nombre solo puede llevar letras, espacios, punto, guion y apóstrofo." };
  }
  if (RESERVADOS.has(nombreClave(nombre))) return { ok: false, error: "Ese nombre está reservado. Usa el nombre de la persona." };
  return { ok: true, valor: nombre };
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarCorreo(entrada: unknown): Validacion<string> {
  const correo = typeof entrada === "string" ? entrada.trim().toLowerCase() : "";
  if (!correo || correo.length > 120 || !CORREO.test(correo)) return { ok: false, error: "Escribe un correo válido." };
  return { ok: true, valor: correo };
}

/** Contraseña propia (la que alguien elige al cambiarla): larga, con al menos una letra y un número. */
export function validarContrasena(entrada: unknown): Validacion<string> {
  const clave = typeof entrada === "string" ? entrada : "";
  if (clave.length < CONTRASENA_MIN) return { ok: false, error: `La contraseña necesita al menos ${CONTRASENA_MIN} caracteres.` };
  if (clave.length > CONTRASENA_MAX) return { ok: false, error: `La contraseña admite hasta ${CONTRASENA_MAX} caracteres.` };
  if (!/\p{L}/u.test(clave) || !/\d/.test(clave)) return { ok: false, error: "Mezcla letras y números en la contraseña." };
  if (new Set(clave).size < 5) return { ok: false, error: "La contraseña es demasiado repetitiva." };
  return { ok: true, valor: clave };
}

/** Texto para mandarle al ayudante (WhatsApp, nota…) con lo que necesita para entrar. */
export function instruccionesDeIngreso(datos: { url: string; correo: string; contrasena: string }): string {
  return [
    "Hola, este es tu acceso a la app de Polo Air Cool:",
    "",
    `Enlace: ${datos.url}`,
    `Correo: ${datos.correo}`,
    `Contraseña temporal: ${datos.contrasena}`,
    "",
    "Ábrelo en el teléfono, inicia sesión y cambia la contraseña desde «Mi cuenta». Para instalarla, usa «Instalar» o «Agregar a pantalla de inicio» del navegador.",
  ].join("\n");
}
