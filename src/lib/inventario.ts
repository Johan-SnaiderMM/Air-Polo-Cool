import type { TipoUnidad } from "@/types/database";

export const UNIDAD_LABEL: Record<TipoUnidad, string> = {
  unidad: "unidad",
  gramo: "gramo",
  libra: "libra",
  onza: "onza",
};

export const UNIDAD_ABREV: Record<TipoUnidad, string> = {
  unidad: "u",
  gramo: "g",
  libra: "lb",
  onza: "oz",
};

export const TIPOS_UNIDAD: TipoUnidad[] = ["unidad", "gramo", "libra", "onza"];

export function esTipoUnidad(valor: unknown): valor is TipoUnidad {
  return typeof valor === "string" && (TIPOS_UNIDAD as string[]).includes(valor);
}

/** Las unidades físicas no admiten fracciones; los consumibles a granel sí. */
export function admiteDecimales(unidad: TipoUnidad): boolean {
  return unidad !== "unidad";
}

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });

export function formatearCantidad(valor: number, unidad: TipoUnidad): string {
  return `${numero.format(valor)} ${UNIDAD_ABREV[unidad]}`;
}

export type NivelStock = "agotado" | "critico" | "ok";

/** agotado = 0; crítico = stock_actual <= stock_minimo (regla de la vista de reposición). */
export function nivelStock(stockActual: number, stockMinimo: number): NivelStock {
  if (stockActual <= 0) return "agotado";
  if (stockActual <= stockMinimo) return "critico";
  return "ok";
}

/** Evita ruido de punto flotante en dinero (2 decimales). */
export function redondearDinero(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
