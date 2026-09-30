/**
 * Libro de movimientos del mes para el contador (exportación CSV/Excel).
 * Une gastos y cobros de clientes (con su medio de pago) en un solo listado
 * cronológico con: Fecha, Categoría, Monto, Medio de pago, Placa asociada, Autor.
 * Los registros ANULADOS se incluyen (marcados) para que la auditoría cuadre.
 */
export type FilaLibro = {
  fecha: string; // YYYY-MM-DD
  /** Momento de creación (desempate estable dentro del mismo día). */
  creado: string;
  tipo: string; // Gasto | Cobro | Devolución
  concepto: string; // categoría del gasto, concepto del cobro, …
  descripcion: string | null;
  monto: number;
  sentido: "Entrada" | "Salida";
  medio: string;
  placa: string | null;
  autor: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
  referencia: string | null;
};

export const ENCABEZADOS_LIBRO = [
  "Fecha",
  "Tipo",
  "Categoría / Concepto",
  "Descripción",
  "Monto",
  "Sentido",
  "Medio de pago",
  "Placa asociada",
  "Autor",
  "Estado",
  "Motivo de anulación",
  "Referencia",
];

/** Orden cronológico ascendente (Excel: de arriba hacia abajo como el mes transcurrió). */
export function ordenarLibro(filas: FilaLibro[]): FilaLibro[] {
  return [...filas].sort((a, b) =>
    a.fecha === b.fecha ? a.creado.localeCompare(b.creado) : a.fecha.localeCompare(b.fecha)
  );
}

export function filaALibroCsv(f: FilaLibro): (string | number | null)[] {
  return [
    f.fecha,
    f.tipo,
    f.concepto,
    f.descripcion,
    f.monto,
    f.sentido,
    f.medio,
    f.placa,
    f.autor,
    f.anulado ? "Anulado" : "Vigente",
    f.motivoAnulacion,
    f.referencia,
  ];
}
