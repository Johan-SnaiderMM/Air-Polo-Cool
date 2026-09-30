/**
 * CSV compatible con Excel en configuración regional española/latina:
 * separador ";" (la coma es decimal), BOM UTF-8 (tildes correctas) y CRLF.
 */
const SEPARADOR = ";";

/** Protege celdas que Excel interpretaría como fórmula (CSV injection). */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

export function celdaCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  const texto = neutralizarFormula(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function filaCsv(celdas: (string | number | boolean | null | undefined)[]): string {
  return celdas.map(celdaCsv).join(SEPARADOR);
}

export function construirCsv(
  encabezados: string[],
  filas: (string | number | boolean | null | undefined)[][]
): string {
  const cuerpo = [encabezados, ...filas].map(filaCsv).join("\r\n");
  return `﻿${cuerpo}\r\n`;
}
