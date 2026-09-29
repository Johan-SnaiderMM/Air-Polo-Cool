import { formatearMoneda } from "@/lib/ordenes";

/**
 * Valor monetario en tipografía monoespaciada de cifras tabulares:
 * las columnas de importes quedan alineadas y se leen como datos, no como texto.
 */
export function Dinero({
  valor,
  className = "",
}: {
  valor: number;
  className?: string;
}) {
  return (
    <span className={`font-mono tracking-tight tabular-nums ${className}`}>
      {formatearMoneda(valor)}
    </span>
  );
}
