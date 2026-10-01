/**
 * Agenda de citas: fechas y horas en hora de Colombia, y agrupación por día. Módulo puro (sin
 * dependencias de servidor): se usa en el servidor, en el navegador y en las pruebas.
 *
 * La base guarda cada cita como un instante (timestamptz). Colombia está siempre en UTC-5 (no tiene
 * horario de verano), así que convertir «fecha + hora del taller» a instante es sumar un offset fijo.
 */
import type { TipoCita } from "@/types/database";

export const TIPOS_CITA: readonly TipoCita[] = ["servicio", "mantenimiento"];

export const TIPO_CITA_LABEL: Record<TipoCita, string> = {
  servicio: "Servicio / revisión",
  mantenimiento: "Mantenimiento",
};

/** Cuántos días hacia adelante se puede agendar. */
export const MAX_DIAS_ADELANTE = 365;
/** Cuántos días hacia atrás se siguen mostrando las citas que nadie marcó (llegó / canceló). */
export const DIAS_ATRASADAS = 14;

const ZONA = "America/Bogota";
const OFFSET = "-05:00";

export const esTipoCita = (v: unknown): v is TipoCita => typeof v === "string" && (TIPOS_CITA as readonly string[]).includes(v);

/** "HH:MM" en 24 horas, tal como lo entrega <input type="time">. */
export const esHora = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** 'YYYY-MM-DD' + 'HH:MM' (hora del taller) → instante ISO en UTC. */
export function instanteBogota(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00${OFFSET}`).toISOString();
}

/** Instante → fecha y hora del taller: { fecha: 'YYYY-MM-DD', hora: 'HH:MM' }. */
export function partesBogota(instante: string): { fecha: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instante));
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD'. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "9:30 a. m." */
export function horaLegible(instante: string): string {
  return new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: ZONA }).format(
    new Date(instante)
  );
}

/** 'YYYY-MM-DD' → "jueves 2 de octubre". */
export function diaLegible(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}

/** Encabezado de un día en la agenda: "Hoy", "Mañana" o "Jueves 2 de octubre". */
export function etiquetaDiaAgenda(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  const texto = diaLegible(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "hoy a las 3:00 p. m.", "mañana a las 9:30 a. m." o "el jueves 2 de octubre a las 8:00 a. m." (para el mensaje). */
export function cuandoCita(instante: string, hoy: string): string {
  const { fecha } = partesBogota(instante);
  const dia = fecha === hoy ? "hoy" : fecha === sumarDias(hoy, 1) ? "mañana" : `el ${diaLegible(fecha)}`;
  return `${dia} a las ${horaLegible(instante)}`;
}

export type GrupoDia<T> = { fecha: string; etiqueta: string; citas: T[] };

/**
 * Separa las citas (ya ordenadas por fecha y hora) en las de días anteriores a hoy que nadie atendió
 * (`atrasadas`) y las de hoy en adelante, agrupadas por día.
 */
export function agruparCitas<T extends { fechaHora: string }>(
  citas: T[],
  hoy: string
): { atrasadas: T[]; dias: GrupoDia<T>[] } {
  const atrasadas: T[] = [];
  const dias: GrupoDia<T>[] = [];
  for (const cita of citas) {
    const { fecha } = partesBogota(cita.fechaHora);
    if (fecha < hoy) {
      atrasadas.push(cita);
      continue;
    }
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === fecha) ultimo.citas.push(cita);
    else dias.push({ fecha, etiqueta: etiquetaDiaAgenda(fecha, hoy), citas: [cita] });
  }
  return { atrasadas, dias };
}
