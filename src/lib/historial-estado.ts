import { ESTADO_LABEL } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

/**
 * Bitácora de cambios de estado de una orden. Se guarda como líneas de texto al final de
 * `ordenes_servicio.notas` (sin tabla nueva): "30 sep 10:12 · Polo · Diagnóstico → En proceso · nota".
 */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_NOTAS = 4000;

/** "30 sep 10:12" en hora de Colombia. */
export function formatoMomento(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${Number(dato("day"))} ${MESES[Number(dato("month")) - 1]} ${dato("hour")}:${dato("minute")}`;
}

export function armarLineaHistorial(d: {
  momento: Date;
  autor: string | null;
  de: EstadoOrden;
  a: EstadoOrden;
  nota: string;
}): string {
  const nota = d.nota.replace(/\s+/g, " ").trim();
  return [
    formatoMomento(d.momento),
    ...(d.autor ? [d.autor] : []),
    `${ESTADO_LABEL[d.de]} → ${ESTADO_LABEL[d.a]}`,
    ...(nota ? [nota] : []),
  ].join(" · ");
}

/** Añade la línea al final y, si el texto crece demasiado, descarta las más antiguas. */
export function agregarHistorial(actual: string | null, linea: string): string {
  const lineas = [...(actual ?? "").split("\n").filter((l) => l.trim() !== ""), linea];
  while (lineas.length > 1 && lineas.join("\n").length > MAX_NOTAS) lineas.shift();
  return lineas.join("\n");
}

/** Líneas para mostrar: la más reciente primero. */
export function lineasHistorial(notas: string | null): string[] {
  return (notas ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .reverse();
}
