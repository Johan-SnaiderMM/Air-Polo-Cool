/**
 * Esquemas de las operaciones que se pueden hacer SIN conexión (gasto, pago, foto, orden nueva).
 * Son la ÚNICA definición: los tipos (`Operacion`, `DatosGasto`…) se derivan de ellos, así que el
 * validador y el tipo no pueden desincronizarse. El cliente arma la operación con estos tipos y el
 * servidor la vuelve a validar (nunca confía en lo que llega de la cola).
 *
 * Criterio: lo que identifica o mueve dinero se RECHAZA si no es válido; los campos accesorios
 * (textos, extensión, cobros de una orden) se sanean con un valor por defecto.
 */
import { z } from "zod";
import {
  autorSchema,
  campo,
  categoriaGasto,
  fechaIso,
  idUuid,
  idUuidOpcional,
  montoPositivo,
  textoOpcional,
  type Validacion,
  validar,
} from "@/lib/esquemas/comunes";
import { mantenimientoSchema, pertenenciasONull } from "@/lib/esquemas/orden";
import { vehiculoOrdenSchema, type DatosVehiculoOrden } from "@/lib/esquemas/vehiculo";
import { esEstado, esTipoEvidencia } from "@/lib/ordenes";
import type { MedioPago } from "@/types/database";

export const MEDIOS_PAGO: MedioPago[] = ["efectivo", "transferencia", "tarjeta", "otro"];

const extensionImagen = z
  .unknown()
  .optional()
  .transform((v): "webp" | "jpg" | undefined => (v === "webp" || v === "jpg" ? v : undefined));

const conArchivo = z.unknown().optional().transform((v) => v === true);

/** Número ≥ 0; cualquier otra cosa → `porDefecto` (sanea, no rechaza). */
const numeroONada = (porDefecto = 0) =>
  z.unknown().optional().transform((v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : porDefecto));

// ---------------------------------------------------------------------
// Gasto
// ---------------------------------------------------------------------
const datosGastoSchema = z.object({
  id: idUuid("Gasto inválido (id)."),
  fecha: fechaIso(),
  monto: montoPositivo("El monto debe ser mayor a 0."),
  categoria: categoriaGasto(),
  orden_id: idUuidOpcional("Orden asociada inválida."),
  descripcion: textoOpcional(300),
  autor: autorSchema,
});
export type DatosGasto = z.output<typeof datosGastoSchema>;

const gastoSchema = z.object({
  tipo: z.literal("gasto.crear"),
  conArchivo,
  extension: extensionImagen,
  datos: z.unknown().pipe(datosGastoSchema),
});

// ---------------------------------------------------------------------
// Pago (abono o devolución)
// ---------------------------------------------------------------------
const datosPagoSchema = z.object({
  id: idUuid("Pago inválido (id u orden)."),
  orden_id: idUuid("Pago inválido (id u orden)."),
  fecha: fechaIso(),
  monto: montoPositivo("El monto debe ser mayor a 0."),
  medio: campo((v) => MEDIOS_PAGO.find((m) => m === v), "Medio de pago inválido."),
  es_devolucion: z.unknown().optional().transform((v) => v === true),
  referencia: textoOpcional(120),
  notas: textoOpcional(300),
  autor: autorSchema,
});
export type DatosPago = z.output<typeof datosPagoSchema>;

const pagoSchema = z.object({
  tipo: z.literal("pago.crear"),
  conArchivo,
  extension: extensionImagen,
  datos: z.unknown().pipe(datosPagoSchema),
});

// ---------------------------------------------------------------------
// Foto (evidencia)
// ---------------------------------------------------------------------
const datosEvidenciaSchema = z
  .object({
    id: idUuid("Evidencia inválida (id u orden)."),
    orden_id: idUuid("Evidencia inválida (id u orden)."),
    tipo: campo((v) => (esTipoEvidencia(v) ? v : undefined), "Tipo de foto inválido."),
    extension: campo((v) => (v === "webp" || v === "jpg" ? v : undefined), "Formato de imagen inválido."),
    notas: textoOpcional(300),
    /** Línea de repuesto de la orden a la que pertenece la foto (solo viejo / nuevo). */
    orden_repuesto_id: idUuidOpcional("Solo las fotos de repuesto pueden ligarse a un repuesto."),
  })
  .refine((d) => d.orden_repuesto_id === null || d.tipo === "repuesto_viejo" || d.tipo === "repuesto_nuevo", {
    error: "Solo las fotos de repuesto pueden ligarse a un repuesto.",
  });
export type DatosEvidencia = z.output<typeof datosEvidenciaSchema>;

const evidenciaSchema = z.object({
  tipo: z.literal("evidencia.subir"),
  conArchivo: z.unknown().optional().transform((): true => true),
  datos: z.unknown().pipe(datosEvidenciaSchema),
});

// ---------------------------------------------------------------------
// Orden nueva
// ---------------------------------------------------------------------
const datosOrdenSchema = z.object({
  id: idUuid("Orden inválida (id)."),
  vehiculo: vehiculoOrdenSchema,
  kilometraje: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null)),
  diagnostico_inicial: textoOpcional(4000),
  trabajos_a_realizar: textoOpcional(4000),
  mano_obra: numeroONada(),
  total_cobrado: numeroONada(),
  dias_garantia: numeroONada(),
  // Sin estado, la orden nace «Recibido».
  estado: campo((v) => { const e = v ?? "recibido"; return esEstado(e) ? e : undefined; }, "Estado inválido."),
  pertenencias: z.unknown().optional().transform((v) => pertenenciasONull(v)),
  mantenimiento_meses: mantenimientoSchema,
  autor: autorSchema,
});
export type DatosOrden = z.output<typeof datosOrdenSchema>;

const ordenSchema = z.object({
  tipo: z.literal("orden.crear"),
  datos: z.unknown().pipe(datosOrdenSchema),
});

export type { DatosVehiculoOrden };

// ---------------------------------------------------------------------
// Operación (unión de las cuatro)
// ---------------------------------------------------------------------
/** Al ARMAR una operación (cliente) `conArchivo` y `extension` son opcionales; al validarla siempre quedan definidos. */
type ConAdjuntoOpcional<T extends { conArchivo: boolean; extension: unknown }> = Omit<T, "conArchivo" | "extension"> & {
  conArchivo?: boolean;
  extension?: "webp" | "jpg";
};

export type Operacion =
  | ConAdjuntoOpcional<z.output<typeof gastoSchema>>
  | ConAdjuntoOpcional<z.output<typeof pagoSchema>>
  | z.output<typeof evidenciaSchema>
  | z.output<typeof ordenSchema>;

export type TipoOperacion = Operacion["tipo"];

const ESQUEMAS = {
  "gasto.crear": gastoSchema,
  "pago.crear": pagoSchema,
  "evidencia.subir": evidenciaSchema,
  "orden.crear": ordenSchema,
} as const;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Valida una operación recibida de la cola (o del navegador) y la devuelve normalizada. */
export function validarOperacion(entrada: unknown): Validacion<Operacion> {
  if (!esObjeto(entrada) || typeof entrada.tipo !== "string" || !esObjeto(entrada.datos)) {
    return { ok: false, error: "Operación inválida." };
  }
  const esquema = (ESQUEMAS as Record<string, z.ZodType<Operacion>>)[entrada.tipo];
  if (!esquema) return { ok: false, error: `Tipo de operación desconocido: ${entrada.tipo}` };
  return validar(esquema, entrada);
}
