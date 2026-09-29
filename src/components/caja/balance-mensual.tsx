import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { hrefCaja } from "@/components/caja/selector-mes";
import { Dinero } from "@/components/ui/dinero";
import { etiquetaMes } from "@/lib/caja";

export type FilaBalance = {
  mes: string; // YYYY-MM
  ingresos: number;
  costoRepuestos: number;
  gastosCajaMenor: number;
  utilidadReal: number;
};

/** Fila del "libro": concepto + nota a la izquierda, importe monoespaciado a la derecha. */
function Linea({
  signo,
  titulo,
  detalle,
  valor,
}: {
  signo: "+" | "−";
  titulo: string;
  detalle: string;
  valor: number;
}) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <span
        className="mt-0.5 w-3 shrink-0 text-center font-mono text-[15px] text-stone-400"
        aria-hidden
      >
        {signo}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{titulo}</p>
        <p className="text-[13px] text-stone-500">{detalle}</p>
      </div>
      <Dinero valor={valor} className="text-[17px]" />
    </div>
  );
}

/**
 * Balance mensual: tres conceptos en una única tarjeta con hairlines (se lee como un
 * extracto) y el resultado en una tarjeta carbón. Sin iconos de colores ni semáforos
 * chillones: un resultado negativo solo tiñe la cifra de ladrillo.
 */
export function BalanceMensual({
  actual,
  historial,
  mes,
}: {
  actual: FilaBalance;
  historial: FilaBalance[];
  mes: string;
}) {
  const negativa = actual.utilidadReal < 0;
  // Margen operativo sobre ingresos (solo si hubo ingresos ese mes).
  const margen =
    actual.ingresos > 0 ? Math.round((actual.utilidadReal / actual.ingresos) * 100) : null;
  // Solo meses realmente anteriores al seleccionado (YYYY-MM se ordena como texto).
  const anteriores = historial.filter((f) => f.mes < mes);

  return (
    <div className="space-y-6">
      <div className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
        <Linea
          signo="+"
          titulo="Ingresos"
          detalle="Órdenes entregadas en el mes"
          valor={actual.ingresos}
        />
        <Linea
          signo="−"
          titulo="Costo de repuestos"
          detalle="Piezas de esas órdenes, a costo de compra"
          valor={actual.costoRepuestos}
        />
        <Linea
          signo="−"
          titulo="Caja menor"
          detalle="Gastos operativos del mes"
          valor={actual.gastosCajaMenor}
        />
      </div>

      <div className="rounded-2xl bg-ink p-6 text-paper">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-stone-400">Utilidad neta real</p>
          {margen !== null && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[12px] text-ice-300 tabular-nums">
              Margen {margen} %
            </span>
          )}
        </div>
        <p
          className={`mt-2 text-[34px] leading-none font-medium tracking-tight ${
            negativa ? "text-brick-300" : ""
          }`}
        >
          <Dinero valor={actual.utilidadReal} />
        </p>
      </div>

      {anteriores.length > 0 && (
        <section>
          <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            Meses anteriores
          </h3>
          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
            {anteriores.map((f) => (
              <li key={f.mes}>
                <Link
                  href={hrefCaja("balance", f.mes)}
                  replace
                  aria-current={f.mes === mes ? "true" : undefined}
                  className={`flex min-h-14 items-center justify-between gap-3 px-5 py-3 transition-colors active:bg-stone-50 ${
                    f.mes === mes ? "bg-stone-50" : ""
                  }`}
                >
                  <span
                    className={`text-[15px] ${f.mes === mes ? "font-semibold" : "font-medium"}`}
                  >
                    {etiquetaMes(f.mes)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Dinero
                      valor={f.utilidadReal}
                      className={`text-[15px] ${f.utilidadReal < 0 ? "text-brick-600" : ""}`}
                    />
                    <ArrowUpRight className="size-3.5 text-stone-300" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
