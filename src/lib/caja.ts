import type { CategoriaGasto } from "@/types/database";

export const CATEGORIAS: CategoriaGasto[] = [
  "ayudante",
  "alimentacion_refrigerio",
  "flete_acarreo",
  "herramienta_consumible",
  "otros",
];

export const CATEGORIA_LABEL: Record<CategoriaGasto, string> = {
  ayudante: "Ayudante",
  alimentacion_refrigerio: "Alimentación",
  flete_acarreo: "Flete",
  herramienta_consumible: "Herramienta",
  otros: "Otros",
};

export const CATEGORIA_AYUDA: Record<CategoriaGasto, string> = {
  ayudante: "Jornal / pago de ayudante",
  alimentacion_refrigerio: "Gaseosas, almuerzos, café",
  flete_acarreo: "Transporte de piezas",
  herramienta_consumible: "Discos, lijas, cintas",
  otros: "Otros gastos del taller",
};

export function esCategoria(valor: unknown): valor is CategoriaGasto {
  return typeof valor === "string" && (CATEGORIAS as string[]).includes(valor);
}

// ---------- Fechas (todo en hora de Colombia, como la base de datos) ----------

/** 'YYYY-MM-DD' de hoy en America/Bogota. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date()
  );
}

/** 'YYYY-MM' de hoy en America/Bogota. */
export function mesActual(): string {
  return hoyBogota().slice(0, 7);
}

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Valida el parámetro ?mes=; si es inválido cae al mes actual. */
export function normalizarMes(valor: string | undefined): string {
  return valor && MES_RE.test(valor) ? valor : mesActual();
}

function desplazarMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export const mesAnterior = (mes: string) => desplazarMes(mes, -1);
export const mesSiguiente = (mes: string) => desplazarMes(mes, 1);

/** Rango semiabierto [desde, hasta) de fechas 'YYYY-MM-DD' del mes. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  return { desde: `${mes}-01`, hasta: `${mesSiguiente(mes)}-01` };
}

export function etiquetaMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** 'YYYY-MM-DD' -> "Hoy", "Ayer" o "mié, 24 sep". */
export function etiquetaDia(fecha: string): string {
  const hoy = hoyBogota();
  if (fecha === hoy) return "Hoy";
  const ayer = new Date(`${hoy}T00:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (fecha === ayer.toISOString().slice(0, 10)) return "Ayer";

  const [y, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
