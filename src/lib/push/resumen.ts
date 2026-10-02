/**
 * Texto de los avisos de la agenda (módulo puro). Es un RESUMEN: cuántas citas hay y cuántas faltan
 * por recordar, para que quien lo lea sepa de un vistazo si tiene algo pendiente por avisar o si las
 * citas ya están todas recordadas.
 *
 *   7:00 a. m. («dia»)   → las citas de HOY (y, si las hay, las atrasadas sin atender).
 *   5:30 p. m. («tarde») → las citas de MAÑANA, para recordarlas hoy a los clientes.
 */
import type { FranjaAviso } from "@/types/database";

export type DatosResumen = {
  franja: FranjaAviso;
  /** Citas pendientes del día que toca (hoy o mañana). */
  total: number;
  /** De esas, las que todavía no se le recordaron al cliente por WhatsApp. */
  sinRecordar: number;
  /** Citas de días anteriores que nadie atendió (solo se mencionan en el aviso de la mañana). */
  atrasadas: number;
};

export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** Pantalla que abre al tocarlo. */
  url: string;
  /** Un aviso nuevo con la misma etiqueta reemplaza al anterior en vez de apilarse. */
  etiqueta: string;
};

const citas = (n: number) => `${n} ${n === 1 ? "cita" : "citas"}`;

/** "2 por recordar", "por recordar", "todas ya recordadas" o "ya recordada". */
function estadoRecordatorio(total: number, sinRecordar: number): string {
  if (sinRecordar === 0) return total === 1 ? "ya recordada" : "todas ya recordadas";
  if (total === 1) return "por recordar";
  return `${sinRecordar} por recordar`;
}

/** El aviso de esa franja, o null si no hay nada que decir (no se molesta con avisos vacíos). */
export function armarAviso({ franja, total, sinRecordar, atrasadas }: DatosResumen): Aviso | null {
  const etiqueta = `agenda-${franja}`;
  const url = "/agenda";

  if (franja === "tarde") {
    if (total === 0) return null;
    return {
      titulo: "Agenda de mañana",
      cuerpo: `${citas(total)} mañana · ${estadoRecordatorio(total, sinRecordar)}`,
      url,
      etiqueta,
    };
  }

  if (total === 0 && atrasadas === 0) return null;
  const partes = [total === 0 ? "Sin citas hoy" : `${citas(total)} hoy · ${estadoRecordatorio(total, sinRecordar)}`];
  if (atrasadas > 0) partes.push(`${atrasadas} ${atrasadas === 1 ? "atrasada sin atender" : "atrasadas sin atender"}`);
  return { titulo: "Agenda de hoy", cuerpo: partes.join(" · "), url, etiqueta };
}
