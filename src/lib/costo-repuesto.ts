/**
 * Costo de compra de un repuesto instalado (módulo puro). Al subir la foto del repuesto instalado la app lo
 * pide cuando todavía no está registrado, y lo guarda como un egreso de la orden (categoría «repuesto»).
 */
import type { TipoEvidencia } from "@/types/database";

/** ¿Hay que pedir el costo antes de la foto? Solo en «repuesto instalado», y solo si aún no tiene costo cargado. */
export function pideCostoRepuesto(tipo: TipoEvidencia, elegido: { costo: number } | undefined): boolean {
  return tipo === "repuesto_nuevo" && (!elegido || elegido.costo <= 0);
}

export type CostoRepuesto = { nombre: string; monto: number };

export type ResultadoCosto = { ok: true; valor: CostoRepuesto } | { ok: false; error: string };

/**
 * `yaEnOrden`: el repuesto es una línea de la orden (su nombre ya se conoce). Si no lo es, hace falta decir qué
 * repuesto es. El costo debe ser mayor que 0, salvo que se marque «sin costo» (el cliente trajo la pieza).
 */
export function validarCostoRepuesto(d: { yaEnOrden: boolean; nombre: string; monto: number; sinCosto: boolean }): ResultadoCosto {
  const nombre = d.nombre.replace(/\s+/g, " ").trim();
  if (!d.yaEnOrden && nombre.length < 2) {
    return { ok: false, error: "Escribe qué repuesto es (para la foto y el egreso)." };
  }
  if (!d.sinCosto && !(Number.isFinite(d.monto) && d.monto > 0)) {
    return { ok: false, error: "Escribe cuánto costó el repuesto, o marca que no tuvo costo." };
  }
  return { ok: true, valor: { nombre, monto: d.sinCosto ? 0 : Math.round(d.monto) } };
}
