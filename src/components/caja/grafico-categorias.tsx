import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { Dinero } from "@/components/ui/dinero";
import { CATEGORIAS, CATEGORIA_LABEL } from "@/lib/caja";
import type { CategoriaGasto } from "@/types/database";

export type TotalesCategoria = Record<CategoriaGasto, number>;

export function totalesVacios(): TotalesCategoria {
  return Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as TotalesCategoria;
}

/** Variación porcentual contra el mes anterior (null si no hay base de comparación). */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/**
 * Distribución de gastos por categoría del mes, con una barra fina de referencia
 * del mes anterior. Solo divs (sin librerías de gráficos): liviano y accesible.
 */
export function GraficoCategorias({
  actual,
  anterior,
  etiquetaAnterior,
}: {
  actual: TotalesCategoria;
  anterior: TotalesCategoria;
  etiquetaAnterior: string;
}) {
  const totalActual = CATEGORIAS.reduce((s, c) => s + actual[c], 0);
  const totalAnterior = CATEGORIAS.reduce((s, c) => s + anterior[c], 0);
  const maximo = Math.max(1, ...CATEGORIAS.map((c) => Math.max(actual[c], anterior[c])));
  const filas = [...CATEGORIAS].sort((a, b) => actual[b] - actual[a]);
  const variacionTotal = variacion(totalActual, totalAnterior);

  if (totalActual === 0 && totalAnterior === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
        Sin gastos para graficar en este período.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[15px]">
          <Dinero valor={totalActual} />
        </p>
        <p className="text-[12px] text-stone-500">
          {variacionTotal === null
            ? `Sin gastos en ${etiquetaAnterior.toLowerCase()}`
            : `${variacionTotal > 0 ? "▲" : variacionTotal < 0 ? "▼" : "="} ${Math.abs(variacionTotal)} % vs ${etiquetaAnterior.toLowerCase()}`}
        </p>
      </div>

      <ul className="space-y-4">
        {filas.map((c) => {
          const Icono = CATEGORIA_ICONO[c];
          const v = variacion(actual[c], anterior[c]);
          const porcentaje = totalActual > 0 ? Math.round((actual[c] / totalActual) * 100) : 0;
          return (
            <li key={c}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2 text-stone-700">
                  <Icono className="size-4 text-stone-400" strokeWidth={1.5} aria-hidden />
                  {CATEGORIA_LABEL[c]}
                  {actual[c] > 0 && <span className="text-stone-500">{porcentaje} %</span>}
                </span>
                <span className="flex items-baseline gap-2">
                  <Dinero valor={actual[c]} className="text-[13px]" />
                  {v !== null && (
                    <span className={`text-[11px] ${v > 0 ? "text-ochre-700" : "text-stone-500"}`}>
                      {v > 0 ? "▲" : v < 0 ? "▼" : "="} {Math.abs(v)} %
                    </span>
                  )}
                  {v === null && actual[c] > 0 && <span className="text-[11px] text-stone-500">nuevo</span>}
                </span>
              </div>
              <div
                className="space-y-1"
                role="img"
                aria-label={`${CATEGORIA_LABEL[c]}: este mes ${actual[c]} pesos; ${etiquetaAnterior} ${anterior[c]} pesos`}
              >
                <div className="h-2 rounded-full bg-stone-100">
                  <div
                    className="h-2 rounded-full bg-ink"
                    style={{ width: `${Math.max(actual[c] > 0 ? 2 : 0, (actual[c] / maximo) * 100)}%` }}
                  />
                </div>
                <div className="h-1 rounded-full bg-stone-100">
                  <div
                    className="h-1 rounded-full bg-stone-300"
                    style={{ width: `${Math.max(anterior[c] > 0 ? 2 : 0, (anterior[c] / maximo) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-center gap-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-ink" aria-hidden /> Este mes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-stone-300" aria-hidden /> {etiquetaAnterior}
        </span>
      </p>
    </div>
  );
}
