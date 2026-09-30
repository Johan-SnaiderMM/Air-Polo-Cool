import { redondearDinero } from "@/lib/inventario";
import { esUuid } from "@/lib/ordenes";
import type { EstadoCotizacion } from "@/types/database";

export type ItemCotizacion = {
  inventario_id: string | null;
  descripcion: string;
  /** Hasta 3 decimales (insumos a granel). */
  cantidad: number;
  precio_unitario: number;
  /** Costo estimado (para el margen interno; no se muestra al cliente). */
  costo_unitario: number;
};

export const MAX_ITEMS = 60;
export const VIGENCIAS_DIAS = [7, 15, 30] as const;

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
  if (!Array.isArray(entrada)) return { ok: false, error: "Los ítems no tienen un formato válido." };
  if (entrada.length > MAX_ITEMS) return { ok: false, error: `Máximo ${MAX_ITEMS} ítems por cotización.` };

  const items: ItemCotizacion[] = [];
  for (const [i, crudo] of entrada.entries()) {
    if (!crudo || typeof crudo !== "object") return { ok: false, error: `Ítem ${i + 1} inválido.` };
    const it = crudo as Record<string, unknown>;
    const descripcion = typeof it.descripcion === "string" ? it.descripcion.trim().slice(0, 200) : "";
    const cantidad = Number(it.cantidad);
    const precio = Number(it.precio_unitario);
    const costo = it.costo_unitario === undefined ? 0 : Number(it.costo_unitario);

    if (!descripcion) return { ok: false, error: `El ítem ${i + 1} no tiene descripción.` };
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000) {
      return { ok: false, error: `Cantidad inválida en "${descripcion}".` };
    }
    if (!Number.isFinite(precio) || precio < 0 || precio > 9_999_999_999) {
      return { ok: false, error: `Precio inválido en "${descripcion}".` };
    }
    if (!Number.isFinite(costo) || costo < 0 || costo > 9_999_999_999) {
      return { ok: false, error: `Costo inválido en "${descripcion}".` };
    }
    const inventarioId = typeof it.inventario_id === "string" && esUuid(it.inventario_id) ? it.inventario_id : null;
    items.push({
      inventario_id: inventarioId,
      descripcion,
      cantidad: Math.round(cantidad * 1000) / 1000,
      precio_unitario: Math.round(precio * 100) / 100,
      costo_unitario: Math.round(costo * 100) / 100,
    });
  }
  return { ok: true, items };
}
