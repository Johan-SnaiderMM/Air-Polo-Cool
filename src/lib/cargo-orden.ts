/**
 * Otros cargos de una orden (módulo puro): gastos hechos POR el trabajo que se le cobran al cliente y no son
 * repuestos ni mano de obra (gasolina, flete, parqueadero, peaje…). Llevan su concepto, lo que costó (opcional)
 * y lo que se le cobra al cliente; el cobro se suma al total de la orden y el costo baja el margen.
 */

/** Atajos para no escribir lo de siempre. «Otro» deja el concepto libre. */
export const CARGOS_SUGERIDOS = ["Gasolina", "Parqueadero", "Flete", "Peaje", "Lavado"] as const;

export type CargoOrden = { nombre: string; costo: number; precio: number };

export type ResultadoCargo = { ok: true; valor: CargoOrden } | { ok: false; error: string };

/**
 * `precio` null = el usuario no lo tocó: se cobra lo que costó (pasa la plata del cliente sin ganancia ni
 * pérdida). Hace falta cobrar algo: un gasto que NO se cobra al cliente va en Caja menor.
 */
export function validarCargo(d: { nombre: string; costo: number; precio: number | null }): ResultadoCargo {
  const nombre = d.nombre.replace(/\s+/g, " ").trim();
  if (nombre.length < 2) return { ok: false, error: "Escribe de qué es el cargo (por ejemplo, Gasolina)." };
  const costo = Number.isFinite(d.costo) && d.costo > 0 ? Math.round(d.costo) : 0;
  const precio = d.precio === null ? costo : Math.round(d.precio);
  if (!Number.isFinite(precio) || precio <= 0) {
    return { ok: false, error: "Escribe cuánto se le cobra al cliente." };
  }
  return { ok: true, valor: { nombre, costo, precio } };
}
