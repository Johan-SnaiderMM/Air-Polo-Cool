/**
 * Esquema de los campos de una ORDEN tal como los escribe el usuario en el formulario (los números
 * llegan como texto). Lo comparten «crear orden» (en el teléfono) y «editar orden» (Server Action):
 * una regla cambia en un solo lugar.
 */
import { z } from "zod";
import { campo, numeroDeTexto, textoONull, textoOpcional } from "@/lib/esquemas/comunes";
import { OPCIONES_GARANTIA, esEstado } from "@/lib/ordenes";
import type { Pertenencias } from "@/types/database";

export const estadoOrdenSchema = () => campo((v) => (esEstado(v) ? v : undefined), "Estado inválido.");

export const garantiaSchema = () =>
  campo((v) => (OPCIONES_GARANTIA.some((o) => o.dias === v) ? (v as number) : undefined), "Selecciona un plazo de garantía válido.");

/** Próximo mantenimiento: solo 3, 6 o 12 meses; cualquier otro valor → sin aviso (null). */
export const mantenimientoSchema = z
  .unknown()
  .optional()
  .transform((v): 3 | 6 | 12 | null => (v === 3 || v === 6 || v === 12 ? v : null));

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Checklist de pertenencias: se reconstruye campo a campo (nunca se guarda lo que venga de fuera tal cual). */
export function pertenenciasONull(v: unknown): Pertenencias | null {
  if (!esObjeto(v)) return null;
  const carroceria = v.carroceria === "rayones" || v.carroceria === "golpes" ? v.carroceria : "sin_danos";
  return {
    carroceria,
    llanta_repuesto: v.llanta_repuesto === true,
    herramientas: v.herramientas === true,
    documentos: v.documentos === true,
    objetos_valor: textoONull(v.objetos_valor, 300) ?? "",
    notas: textoONull(v.notas, 500) ?? "",
  };
}

/** Campos de la orden que se validan igual al crear y al editar. El orden de las claves es el de validación. */
export const camposOrdenSchema = z.object({
  kilometraje: numeroDeTexto("El kilometraje debe ser un número entero mayor o igual a 0.", null, (n) => Number.isInteger(n) && n >= 0),
  mano_obra: numeroDeTexto("La mano de obra debe ser un valor mayor o igual a 0.", 0, (n) => n >= 0),
  total_cobrado: numeroDeTexto("El total cobrado debe ser un valor mayor o igual a 0.", 0, (n) => n >= 0),
  dias_garantia: garantiaSchema(),
  estado: estadoOrdenSchema(),
  diagnostico_inicial: textoOpcional(4000),
  trabajos_a_realizar: textoOpcional(4000),
});

export type CamposOrden = z.output<typeof camposOrdenSchema>;
