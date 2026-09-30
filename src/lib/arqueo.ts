import type { ResultadoCierre } from "@/types/database";

/** Denominaciones del peso colombiano, de mayor a menor. */
export const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000] as const;
export const MONEDAS = [1000, 500, 200, 100, 50] as const;
export const DENOMINACIONES = [...BILLETES, ...MONEDAS] as const;

/** { "50000": 3, "20000": 2 } — cantidad de piezas por denominación. */
export type Desglose = Partial<Record<string, number>>;

export function totalDesglose(desglose: Desglose): number {
  return DENOMINACIONES.reduce((suma, d) => suma + d * limpiarCantidad(desglose[String(d)]), 0);
}

/** Cantidad de piezas: entero >= 0 (cualquier otra cosa cuenta como 0). */
export function limpiarCantidad(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Quita denominaciones en 0 y valida lo que llega del cliente. */
export function desgloseLimpio(entrada: unknown): Desglose {
  const salida: Desglose = {};
  if (entrada && typeof entrada === "object") {
    for (const d of DENOMINACIONES) {
      const cantidad = limpiarCantidad((entrada as Record<string, unknown>)[String(d)]);
      if (cantidad > 0) salida[String(d)] = cantidad;
    }
  }
  return salida;
}

export type Comparacion = {
  diferencia: number;
  resultado: ResultadoCierre;
};

/** diferencia = conteo físico − saldo del sistema (negativo = faltante). */
export function comparar(saldoSistema: number, conteoFisico: number): Comparacion {
  const diferencia = Math.round((conteoFisico - saldoSistema) * 100) / 100;
  return {
    diferencia,
    resultado: diferencia === 0 ? "cuadrado" : diferencia < 0 ? "faltante" : "sobrante",
  };
}

export const RESULTADO_LABEL: Record<ResultadoCierre, string> = {
  cuadrado: "Cuadrado",
  faltante: "Faltante",
  sobrante: "Sobrante",
};
