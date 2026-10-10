/**
 * Costo y precio de un repuesto instalado que NO está en el inventario (módulo puro). Al subir la foto del
 * repuesto instalado la app lo pide cuando todavía no está registrado; después lo agrega a la orden como un
 * repuesto sin inventario: su costo baja el margen y su precio se suma al total que se le cobra al cliente.
 */
import type { TipoEvidencia } from "@/types/database";

/** ¿Hay que pedir el costo antes de la foto? Solo en «repuesto instalado», y solo si aún no tiene costo cargado. */
export function pideCostoRepuesto(tipo: TipoEvidencia, elegido: { costo: number } | undefined): boolean {
  return tipo === "repuesto_nuevo" && (!elegido || elegido.costo <= 0);
}

/**
 * `costo` y `precio` en pesos. Con `sinCosto` (el cliente trajo la pieza) no hay línea que agregar: solo la foto,
 * y costo y precio quedan en 0.
 */
export type CostoRepuesto = { nombre: string; costo: number; precio: number };

export type ResultadoCosto = { ok: true; valor: CostoRepuesto } | { ok: false; error: string };

/**
 * `yaEnOrden`: el repuesto es una línea de la orden (su nombre ya se conoce). Si no lo es, hace falta decir qué
 * repuesto es. El costo debe ser mayor que 0, salvo «sin costo». El precio al cliente puede ser 0 (por ejemplo, si
 * ya está incluido en el total acordado), pero no negativo; si no se escribe, se cobra al costo.
 */
export function validarCostoRepuesto(d: {
  yaEnOrden: boolean;
  nombre: string;
  costo: number;
  /** null = el usuario no lo tocó: se cobra al costo. */
  precio: number | null;
  sinCosto: boolean;
}): ResultadoCosto {
  const nombre = d.nombre.replace(/\s+/g, " ").trim();
  if (!d.yaEnOrden && nombre.length < 2) {
    return { ok: false, error: "Escribe qué repuesto es (para la foto y para la orden)." };
  }
  if (d.sinCosto) return { ok: true, valor: { nombre, costo: 0, precio: 0 } };
  if (!(Number.isFinite(d.costo) && d.costo > 0)) {
    return { ok: false, error: "Escribe cuánto costó el repuesto, o marca que no tuvo costo." };
  }
  const costo = Math.round(d.costo);
  const precio = d.precio === null ? costo : Math.round(d.precio);
  if (!Number.isFinite(precio) || precio < 0) {
    return { ok: false, error: "El precio al cliente no puede ser negativo." };
  }
  return { ok: true, valor: { nombre, costo, precio } };
}
