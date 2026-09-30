import type { EstadoOrden, TipoEvidencia } from "@/types/database";

export const ESTADO_LABEL: Record<EstadoOrden, string> = {
  recibido: "Recibido",
  diagnostico: "Diagnóstico",
  en_proceso: "En proceso",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/**
 * Superficie de cada estado (badge, selector y modal): degradado muy tenue + micro-borde a tono.
 * Usa los tonos desaturados del sistema (ochre = ámbar, dusk = pizarra, sage = salvia).
 */
export const ESTADO_SUPERFICIE: Record<EstadoOrden, string> = {
  recibido: "bg-linear-to-br from-stone-100 to-stone-50 border-stone-300/70 text-stone-800",
  diagnostico: "bg-linear-to-br from-ochre-100/70 to-stone-50 border-ochre-300/70 text-ochre-800",
  en_proceso: "bg-linear-to-br from-dusk-100 to-stone-50 border-dusk-500/30 text-dusk-800",
  listo: "bg-linear-to-br from-sage-100/70 to-stone-50 border-sage-300/80 text-sage-800",
  entregado: "bg-linear-to-br from-stone-200/70 to-stone-50 border-stone-300/70 text-stone-600",
  cancelado: "bg-linear-to-br from-brick-50 to-stone-50 border-brick-300/60 text-brick-700",
};

/** Punto de color de cada estado (también usado en la barra segmentada del inicio). */
export const ESTADO_DOT: Record<EstadoOrden, string> = {
  recibido: "bg-stone-400",
  diagnostico: "bg-ochre-500",
  en_proceso: "bg-dusk-500",
  listo: "bg-sage-500",
  entregado: "bg-stone-300",
  cancelado: "bg-brick-500",
};

/** Flujo operativo (orden del selector de estado). */
export const ESTADOS_FLUJO: EstadoOrden[] = [
  "recibido",
  "diagnostico",
  "en_proceso",
  "listo",
  "entregado",
  "cancelado",
];

/** Chips de filtro de la lista (el estado "cancelado" solo aparece en "Todos"). */
export const ESTADOS_FILTRO: EstadoOrden[] = [
  "recibido",
  "diagnostico",
  "en_proceso",
  "listo",
  "entregado",
];

export function esEstado(valor: unknown): valor is EstadoOrden {
  return (
    typeof valor === "string" && (ESTADOS_FLUJO as string[]).includes(valor)
  );
}

export const TIPO_EVIDENCIA_LABEL: Record<TipoEvidencia, string> = {
  ingreso: "Foto ingreso",
  repuesto_viejo: "Repuesto viejo",
  repuesto_nuevo: "Repuesto nuevo instalado",
  prueba_tecnica: "Prueba técnica",
  factura_compra: "Factura de compra",
};

export const TIPOS_EVIDENCIA: TipoEvidencia[] = [
  "ingreso",
  "repuesto_viejo",
  "repuesto_nuevo",
  "prueba_tecnica",
  "factura_compra",
];

export function esTipoEvidencia(valor: unknown): valor is TipoEvidencia {
  return (
    typeof valor === "string" && (TIPOS_EVIDENCIA as string[]).includes(valor)
  );
}

export const OPCIONES_GARANTIA: { dias: number; label: string }[] = [
  { dias: 0, label: "Sin garantía" },
  { dias: 30, label: "30 días" },
  { dias: 60, label: "60 días" },
  { dias: 90, label: "90 días" },
  { dias: 180, label: "180 días" },
  { dias: 365, label: "1 año" },
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}

// ---------- Formato ----------

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatearMoneda(valor: number): string {
  return moneda.format(valor);
}

export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** Fecha 'YYYY-MM-DD' (tipo date de Postgres) -> "05 oct 2026" sin corrimiento de zona. */
export function formatearFechaDate(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Fecha fin de garantía = fecha base (día calendario Bogotá) + días. */
export function calcularFinGarantia(
  baseIso: string | null,
  dias: number
): string | null {
  if (dias <= 0) return null;
  const base = baseIso ? new Date(baseIso) : new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(base); // YYYY-MM-DD
  const [y, m, d] = partes.split("-").map(Number);
  const fin = new Date(Date.UTC(y, m - 1, d + dias));
  return fin.toISOString().slice(0, 10);
}

// ---------- Validación ----------

/**
 * Normaliza a E.164. Acepta "300 123 4567", "57 300...", "+57300..." o
 * cualquier número internacional que ya empiece con "+".
 * Devuelve null si no es válido (regex de la BD: ^\+[1-9][0-9]{7,14}$).
 */
export function normalizarTelefono(entrada: string): string | null {
  const limpio = entrada.replace(/[\s\-().]/g, "");
  let e164: string;
  if (limpio.startsWith("+")) {
    e164 = limpio;
  } else if (/^3\d{9}$/.test(limpio)) {
    e164 = `+57${limpio}`;
  } else if (/^57\d{10}$/.test(limpio)) {
    e164 = `+${limpio}`;
  } else {
    return null;
  }
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

/** Igual que el trigger de la BD: MAYÚSCULAS, solo A-Z y 0-9. */
export function normalizarPlaca(entrada: string): string {
  return entrada.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** "27 sept" (y el año solo si no es el actual): para tarjetas compactas. */
export function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso);
  const anio = (d: Date) =>
    new Intl.DateTimeFormat("es-CO", { year: "numeric", timeZone: "America/Bogota" }).format(d);
  const base = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
    ...(anio(fecha) !== anio(new Date()) ? { year: "numeric" as const } : {}),
  }).format(fecha);
  return base.replace(/\./g, "").replace(" de ", " ");
}
