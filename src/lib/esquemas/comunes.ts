/**
 * Piezas comunes de los esquemas de validación (Zod). Una sola definición de cada regla
 * («id válido», «monto mayor a 0», «WhatsApp válido»…) que comparten el cliente (antes de
 * encolar o enviar un formulario) y el servidor (que nunca confía en lo que recibe).
 *
 * Convenciones:
 *  - Cada regla lleva su mensaje en español: es el que ve el usuario (se muestra el PRIMERO).
 *  - Las claves de un esquema se declaran en el orden en que deben validarse.
 *  - `campo()` convierte un valor desconocido en el tipo pedido o falla con el mensaje dado;
 *    así un dato ausente, mal tipado o basura produce el mismo mensaje claro.
 */
import { z } from "zod";
import { autorONull } from "@/lib/autor";
import { esCategoria } from "@/lib/caja";
import { esUuid, normalizarPlaca, normalizarTelefono } from "@/lib/ordenes";

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Valida `entrada` con `esquema`; ante un fallo devuelve el mensaje del primer problema. */
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): Validacion<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return { ok: true, valor: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
}

/**
 * Campo que se CONVIERTE: `convertir` devuelve el valor ya tipado o `undefined` si el dato no
 * sirve (entonces falla con `mensaje`). Acepta cualquier entrada, incluso si el campo falta.
 */
export function campo<T>(convertir: (valor: unknown) => T | undefined, mensaje: string) {
  return z
    .unknown()
    .optional()
    .transform((valor, ctx): T => {
      const r = convertir(valor);
      if (r === undefined) {
        ctx.issues.push({ code: "custom", message: mensaje, input: valor });
        return z.NEVER;
      }
      return r;
    });
}

// ---------------------------------------------------------------------
// Predicados básicos
// ---------------------------------------------------------------------
export const MAX_MONTO = 9_999_999_999;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" que existe en el calendario (rechaza 2026-02-31). */
export function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const esNumeroFinito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Texto recortado y acotado; vacío o no-texto → null. */
export function textoONull(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

// ---------------------------------------------------------------------
// Campos reutilizables
// ---------------------------------------------------------------------

/** Id (uuid) obligatorio. */
export const idUuid = (mensaje: string) => campo((v) => (typeof v === "string" && esUuid(v) ? v : undefined), mensaje);

/** Id (uuid) opcional: null/ausente → null; si viene algo, debe ser un uuid. */
export const idUuidOpcional = (mensaje: string) =>
  campo<string | null>((v) => (v == null ? null : typeof v === "string" && esUuid(v) ? v : undefined), mensaje);

export const fechaIso = (mensaje = "Fecha inválida.") => campo((v) => (esFechaIso(v) ? v : undefined), mensaje);

/** Monto > 0 y dentro del tope, redondeado a centavos. */
export const montoPositivo = (mensaje: string) =>
  campo((v) => (esNumeroFinito(v) && v > 0 && v <= MAX_MONTO ? Math.round(v * 100) / 100 : undefined), mensaje);

/** Texto opcional: recortado, acotado; cualquier cosa que no sea texto útil → null. */
export const textoOpcional = (max = 300) => z.unknown().optional().transform((v) => textoONull(v, max));

/** Texto obligatorio (recortado y acotado). */
export const textoObligatorio = (mensaje: string, max = 120) =>
  campo((v) => textoONull(v, max) ?? undefined, mensaje);

export const categoriaGasto = (mensaje = "Categoría inválida.") =>
  campo((v) => (esCategoria(v) ? v : undefined), mensaje);

/** «Polo» o «Soporte técnico»; cualquier otro valor se descarta (null), nunca se rechaza. */
export const autorSchema = z.unknown().optional().transform((v) => autorONull(v));

export const MSG_WHATSAPP = "WhatsApp inválido. Usa 10 dígitos (300 123 4567) o el formato +57…";
export const MSG_PLACA = "La placa debe tener entre 5 y 8 letras/números.";
export const MSG_ANIO = "El modelo (año) debe estar entre 1950 y 2100.";

/** WhatsApp en formato internacional (+57…), o falla. */
export const whatsapp = () => campo((v) => (typeof v === "string" ? (normalizarTelefono(v) ?? undefined) : undefined), MSG_WHATSAPP);

/** Placa normalizada (mayúsculas, sin guiones ni espacios), de 5 a 8 letras/números. */
export const placa = () =>
  campo((v) => {
    if (typeof v !== "string") return undefined;
    const p = normalizarPlaca(v);
    return /^[A-Z0-9]{5,8}$/.test(p) ? p : undefined;
  }, MSG_PLACA);

/**
 * Año/modelo del vehículo: ausente o vacío → null; número o texto numérico entero entre 1950 y 2100.
 * (El formulario lo entrega como texto; el servidor, como número o null.)
 */
export const anioVehiculo = () =>
  campo<number | null>((v) => {
    if (v == null || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : Number.NaN;
    return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : undefined;
  }, MSG_ANIO);

/**
 * Número que llega como TEXTO de un formulario: "" → `vacio`; válido → número; basura → error.
 * `validar` recibe el número y dice si sirve (p. ej. entero ≥ 0).
 */
export const numeroDeTexto = <T extends number | null>(
  mensaje: string,
  vacio: T,
  validarNumero: (n: number) => boolean
) =>
  campo<number | T>((v) => {
    if (v == null) return vacio;
    if (typeof v === "string" && v.trim() === "") return vacio;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : Number.NaN;
    return Number.isFinite(n) && validarNumero(n) ? n : undefined;
  }, mensaje);
