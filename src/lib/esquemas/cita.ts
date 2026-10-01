/**
 * Esquema de la cita (agenda): fecha, hora, tipo y nota. El vehículo se valida aparte con
 * `seleccionVehiculoSchema` (el mismo selector que usan las cotizaciones).
 */
import { z } from "zod";
import { esHora, esTipoCita, MAX_DIAS_ADELANTE, sumarDias } from "@/lib/agenda";
import { autorSchema, campo, esFechaIso, textoOpcional } from "@/lib/esquemas/comunes";
import { hoyBogota } from "@/lib/caja";

export const MSG_FECHA_CITA = "Elige el día de la cita.";
export const MSG_HORA_CITA = "Elige la hora de la cita.";
export const MSG_TIPO_CITA = "El tipo de cita no es válido.";
export const MSG_CITA_PASADA = "El día de la cita no puede ser anterior a hoy.";
export const MSG_CITA_LEJANA = "El día de la cita está demasiado lejos (máximo un año).";

export const citaFormSchema = z
  .object({
    fecha: campo((v) => (esFechaIso(v) ? v : undefined), MSG_FECHA_CITA),
    hora: campo((v) => (esHora(v) ? v : undefined), MSG_HORA_CITA),
    tipo: campo((v) => (esTipoCita(v) ? v : undefined), MSG_TIPO_CITA),
    notas: textoOpcional(500),
    autor: autorSchema,
  })
  .superRefine((cita, ctx) => {
    const hoy = hoyBogota();
    if (cita.fecha < hoy) ctx.addIssue({ code: "custom", message: MSG_CITA_PASADA, path: ["fecha"] });
    else if (cita.fecha > sumarDias(hoy, MAX_DIAS_ADELANTE)) {
      ctx.addIssue({ code: "custom", message: MSG_CITA_LEJANA, path: ["fecha"] });
    }
  });

export type CitaForm = z.output<typeof citaFormSchema>;
