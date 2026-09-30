/**
 * Esquemas de vehículo y cliente. Las mismas reglas las usan: el formulario de «crear orden»
 * (cliente, en el teléfono), la alta de vehículo al procesar la cola (servidor) y la edición de
 * vehículo / cliente.
 */
import { z } from "zod";
import { esUuid } from "@/lib/ordenes";
import {
  anioVehiculo,
  campo,
  idUuid,
  numeroDeTexto,
  placa,
  textoObligatorio,
  textoOpcional,
  whatsapp,
} from "@/lib/esquemas/comunes";
import type { TipoGasSugerido } from "@/types/database";

export const MSG_NOMBRE_CLIENTE = "Ingresa el nombre del cliente.";
export const MSG_MARCA_LINEA = "Ingresa la marca y la línea.";

const GASES: readonly TipoGasSugerido[] = ["R134a", "R1234yf", "otro"];

// ---------------------------------------------------------------------
// Datos de un cliente + vehículo NUEVOS (sin ids)
// ---------------------------------------------------------------------
/**
 * Cliente y vehículo que se dan de alta junto con una orden. `modelo` es la LÍNEA del vehículo
 * (Spark GT, Duster…) y `anio` el MODELO (año), como lo dice el taller.
 */
export const camposVehiculoNuevoSchema = z.object({
  cliente_nombre: textoObligatorio(MSG_NOMBRE_CLIENTE, 120),
  cliente_telefono: whatsapp(),
  placa: placa(),
  marca: textoObligatorio(MSG_MARCA_LINEA, 60),
  modelo: textoObligatorio(MSG_MARCA_LINEA, 60),
  anio: anioVehiculo(),
});

/** Lo mismo con los ids generados en el teléfono (clave de idempotencia al reenviar). */
export const vehiculoNuevoConIdsSchema = z.object({
  nuevo: z.literal(true),
  id: idUuid("Vehículo inválido."),
  cliente_id: idUuid("Cliente inválido (id)."),
  ...camposVehiculoNuevoSchema.shape,
});

const vehiculoExistenteSchema = z
  .object({ id: idUuid("Vehículo inválido.") }, { error: "Vehículo inválido." })
  .transform((v) => ({ nuevo: false as const, id: v.id }));

export type DatosVehiculoOrden =
  | { nuevo: false; id: string }
  | z.output<typeof vehiculoNuevoConIdsSchema>;

/** Vehículo de una orden: uno existente (solo su id) o uno nuevo con su cliente. */
export const vehiculoOrdenSchema = z.unknown().transform((valor, ctx): DatosVehiculoOrden => {
  const esNuevo = typeof valor === "object" && valor !== null && (valor as { nuevo?: unknown }).nuevo === true;
  const r = esNuevo ? vehiculoNuevoConIdsSchema.safeParse(valor) : vehiculoExistenteSchema.safeParse(valor);
  if (!r.success) {
    for (const i of r.error.issues) ctx.issues.push({ code: "custom", message: i.message, input: valor });
    return z.NEVER;
  }
  return r.data;
});

// ---------------------------------------------------------------------
// Edición desde formularios (los valores llegan como TEXTO)
// ---------------------------------------------------------------------
export const editarVehiculoSchema = z.object({
  vehiculo_id: campo((v) => (typeof v === "string" && esUuid(v) ? v : undefined), "Vehículo inválido."),
  placa: placa(),
  marca: textoObligatorio(MSG_MARCA_LINEA, 60),
  modelo: textoObligatorio(MSG_MARCA_LINEA, 60),
  anio: anioVehiculo(),
  tipo_gas_sugerido: campo<TipoGasSugerido | null>(
    (v) => (v == null || v === "" ? null : GASES.find((g) => g === v)),
    "Tipo de refrigerante inválido."
  ),
  carga_estandar_gramos: numeroDeTexto("La carga estándar debe ser un valor en gramos mayor a 0.", null, (n) => n > 0 && n < 100000),
});

export const editarClienteSchema = z.object({
  cliente_id: campo((v) => (typeof v === "string" && esUuid(v) ? v : undefined), "Cliente inválido."),
  nombre: textoObligatorio(MSG_NOMBRE_CLIENTE, 120),
  telefono: whatsapp(),
  documento: textoOpcional(40),
});
