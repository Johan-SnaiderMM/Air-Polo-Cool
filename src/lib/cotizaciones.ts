import { validar } from "@/lib/esquemas/comunes";
import {
  MAX_ITEMS,
  VIGENCIAS_DIAS,
  itemsCotizacionSchema,
  type ItemCotizacion,
} from "@/lib/esquemas/cotizacion";
import { redondearDinero } from "@/lib/inventario";
import type { EstadoCotizacion } from "@/types/database";

// Las reglas y el tipo del ítem viven en el esquema (src/lib/esquemas/cotizacion.ts).
export { MAX_ITEMS, VIGENCIAS_DIAS };
export type { ItemCotizacion };

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  convertida: "Convertida en orden",
};

export const ESTADO_COTIZACION_CLASE: Record<EstadoCotizacion, string> = {
  borrador: "bg-stone-100 text-stone-700",
  enviada: "bg-dusk-100 text-dusk-800",
  aprobada: "bg-sage-100 text-sage-800",
  rechazada: "bg-brick-50 text-brick-700",
  convertida: "bg-stone-100 text-stone-500",
};

export type TotalesCotizacion = {
  repuestos: number;
  manoObra: number;
  total: number;
  costoEstimado: number;
  margenEstimado: number;
};

export function totalesCotizacion(manoObra: number, items: ItemCotizacion[]): TotalesCotizacion {
  const repuestos = redondearDinero(items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0));
  const costoEstimado = redondearDinero(items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0));
  const mo = redondearDinero(manoObra);
  const total = redondearDinero(mo + repuestos);
  return { repuestos, manoObra: mo, total, costoEstimado, margenEstimado: redondearDinero(total - costoEstimado) };
}

/** Fecha 'YYYY-MM-DD' hasta la que vale la cotización (fecha + días). */
export function vigenteHasta(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function estaVencida(fecha: string, dias: number, hoy: string): boolean {
  return vigenteHasta(fecha, dias) < hoy;
}

/** Valida los ítems que llegan del formulario (JSON). Nunca se confía en el cliente. */
export function validarItems(
  entrada: unknown
): { ok: true; items: ItemCotizacion[] } | { ok: false; error: string } {
  const r = validar(itemsCotizacionSchema, entrada);
  return r.ok ? { ok: true, items: r.valor } : { ok: false, error: r.error };
}
