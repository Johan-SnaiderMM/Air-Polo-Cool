import type { Pertenencias } from "@/types/database";

/** Resumen de una línea para la cabecera del acordeón de pertenencias. */
export function resumenPertenencias(p: Pertenencias | null): string {
  if (!p) return "Sin registrar";
  const items =
    Number(p.llanta_repuesto) +
    Number(p.herramientas) +
    Number(p.documentos) +
    (p.carroceria !== "sin_danos" ? 1 : 0) +
    (p.objetos_valor.trim() !== "" ? 1 : 0) +
    (p.notas.trim() !== "" ? 1 : 0);
  if (items === 0) return "Registrado · sin novedades";
  return `${items} ${items === 1 ? "ítem registrado" : "ítems registrados"}`;
}

/** Resumen de una línea para el acordeón de notas técnicas. */
export function resumenNotasTecnicas(diagnostico: string, trabajos: string): string {
  const d = diagnostico.trim() !== "";
  const t = trabajos.trim() !== "";
  if (d && t) return "Diagnóstico y trabajos registrados";
  if (d) return "Diagnóstico registrado";
  if (t) return "Trabajos registrados";
  return "Sin notas";
}
