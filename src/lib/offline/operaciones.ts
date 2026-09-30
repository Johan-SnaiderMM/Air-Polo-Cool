/**
 * Operaciones que se pueden registrar SIN conexión y sincronizar después.
 *
 * Diseño de idempotencia: cada registro nace con un UUID generado en el teléfono
 * (`id`). Si la sincronización se repite (corte de red a mitad, doble envío),
 * el servidor detecta el id duplicado y lo trata como "ya hecho" en vez de duplicar.
 *
 * Los tipos y la validación viven en src/lib/esquemas/ (una sola definición, derivada de los
 * esquemas Zod): este módulo los reexporta para no cambiar los imports del resto de la app y
 * añade lo propio de la cola (ids, descripción legible, clasificación de errores).
 * Módulo puro (sin acceso a red, IndexedDB ni servidor) con pruebas unitarias.
 */
import {
  MEDIOS_PAGO,
  validarOperacion,
  type DatosEvidencia,
  type DatosGasto,
  type DatosOrden,
  type DatosPago,
  type DatosVehiculoOrden,
  type Operacion,
  type TipoOperacion,
} from "@/lib/esquemas/operaciones";
import { pertenenciasONull } from "@/lib/esquemas/orden";
import type { Validacion } from "@/lib/esquemas/comunes";

export { MEDIOS_PAGO, pertenenciasONull, validarOperacion };
export type { DatosEvidencia, DatosGasto, DatosOrden, DatosPago, DatosVehiculoOrden, Operacion, TipoOperacion, Validacion };

export function nuevoId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------
// Descripción legible (lista de pendientes)
// ---------------------------------------------------------------------

const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function describirOperacion(op: Operacion): string {
  switch (op.tipo) {
    case "gasto.crear":
      return `Gasto ${moneda.format(op.datos.monto)}${op.conArchivo ? " · con recibo" : ""}`;
    case "pago.crear":
      return `${op.datos.es_devolucion ? "Devolución" : "Abono"} ${moneda.format(op.datos.monto)} (${op.datos.medio})`;
    case "orden.crear":
      return op.datos.vehiculo.nuevo
        ? `Orden nueva · ${op.datos.vehiculo.placa.toUpperCase()}`
        : "Orden nueva";
    case "evidencia.subir":
      return `Foto (${op.datos.tipo.replace("_", " ")})`;
  }
}

/** Errores transitorios de conexión/recursos en la base: se reintentan, no se marcan como fallidos. */
export function esErrorTransitorio(codigo: string | undefined): boolean {
  return !!codigo && (codigo.startsWith("08") || codigo.startsWith("53") || codigo === "57014");
}
