/** Esquema de EDICIÓN de un gasto ya registrado (el alta pasa por las operaciones offline). */
import { z } from "zod";
import { hoyBogota } from "@/lib/caja";
import {
  autorSchema,
  campo,
  categoriaGasto,
  esFechaIso,
  idUuid,
  idUuidOpcional,
  montoPositivo,
  textoOpcional,
} from "@/lib/esquemas/comunes";

export const editarGastoSchema = z.object({
  id: idUuid("Gasto inválido."),
  // La fecha se compara con «hoy» en el momento de validar, no al cargar el módulo.
  fecha: campo((v) => (esFechaIso(v) && v <= hoyBogota() ? v : undefined), "La fecha no puede ser futura."),
  categoria: categoriaGasto(),
  monto: montoPositivo("Ingresa un monto mayor a 0."),
  descripcion: textoOpcional(300),
  ordenId: idUuidOpcional("Orden inválida."),
  autor: autorSchema,
});

export const anularGastoSchema = z.object({
  id: idUuid("Gasto inválido."),
  motivo: campo((v) => (typeof v === "string" && v.trim().length >= 3 ? v.trim().slice(0, 300) : undefined), "Escribe el motivo de la anulación."),
  autor: autorSchema,
});
