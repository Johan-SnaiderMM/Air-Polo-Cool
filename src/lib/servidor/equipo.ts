import "server-only";
import { randomInt } from "node:crypto";

/** Sin caracteres que se confunden al leerlos o dictarlos (0/O, 1/l/I). */
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const DIGITOS = "23456789";
const TODOS = MAYUSCULAS + MINUSCULAS + DIGITOS;

const elegir = (alfabeto: string) => alfabeto[randomInt(alfabeto.length)];

/**
 * Contraseña temporal aleatoria (criptográficamente segura) para un ayudante: 14 caracteres con mayúscula,
 * minúscula y número. Se muestra una sola vez; la persona debe cambiarla en «Mi cuenta».
 */
export function generarContrasena(largo = 14): string {
  const caracteres = [elegir(MAYUSCULAS), elegir(MINUSCULAS), elegir(DIGITOS)];
  while (caracteres.length < largo) caracteres.push(elegir(TODOS));
  // Fisher–Yates: que las tres obligatorias no queden siempre al principio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}
