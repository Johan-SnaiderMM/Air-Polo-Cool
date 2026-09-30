import Link from "next/link";
import { ArrowUpRight, Download, Printer } from "lucide-react";
import { hrefCaja } from "@/components/caja/selector-mes";
import { Dinero } from "@/components/ui/dinero";
import { etiquetaMes } from "@/lib/caja";

/**
 * Balance REAL (base cobrado): no asume que lo facturado está pagado.
 *   utilidad_real = cobrado − costo de repuestos − gastos de caja menor
 */
export type FilaBalance = {
  mes: string; // YYYY-MM
  facturado: number;
  cobrado: number;
  costoRepuestos: number;
  gastos: number;
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
      <span className="mt-0.5 w-3 shrink-0 text-center font-mono text-[15px] text-stone-400" aria-hidden>
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
 * Balance mensual: tres conceptos en una tarjeta con hairlines (se lee como un extracto),
 * el resultado en una tarjeta carbón, y debajo lo facturado y lo que aún se debe.
 */
export function BalanceMensual({
  actual,
  anteriores,
  mes,
  porCobrar,
}: {
  actual: FilaBalance;
  anteriores: FilaBalance[];
  mes: string;
  porCobrar: { total: number; ordenes: number };
}) {
  const negativa = actual.utilidadReal < 0;
  // Margen sobre lo cobrado (solo si se cobró algo ese mes).
  const margen = actual.cobrado > 0 ? Math.round((actual.utilidadReal / actual.cobrado) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
        <Linea signo="+" titulo="Cobrado" detalle="Efectivo y transferencias del mes, netos de devoluciones" valor={actual.cobrado} />
        <Linea signo="−" titulo="Costo de repuestos" detalle="Piezas de las órdenes entregadas en el mes" valor={actual.costoRepuestos} />
        <Linea signo="−" titulo="Gastos de caja menor" detalle="Gastos vigentes del mes (sin anulados)" valor={actual.gastos} />
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
        <p className={`mt-2 text-[34px] leading-none font-medium tracking-tight ${negativa ? "text-brick-300" : ""}`}>
          <Dinero valor={actual.utilidadReal} />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-200/70 bg-white p-4">
          <p className="text-[12px] text-stone-500">Facturado en el mes</p>
          <p className="mt-1 text-[17px]">
            <Dinero valor={actual.facturado} />
          </p>
          <p className="mt-1 text-[12px] text-stone-500">Órdenes entregadas</p>
        </div>
        <Link
          href="/cartera"
          className="rounded-2xl border border-stone-200/70 bg-white p-4 transition-colors active:bg-stone-50"
        >
          <p className="flex items-center justify-between text-[12px] text-stone-500">
            Por cobrar (total)
            <ArrowUpRight className="size-3.5" aria-hidden />
          </p>
          <p className={`mt-1 text-[17px] ${porCobrar.total > 0 ? "text-ochre-700" : ""}`}>
            <Dinero valor={porCobrar.total} />
          </p>
          <p className="mt-1 text-[12px] text-stone-500">
            {porCobrar.ordenes} {porCobrar.ordenes === 1 ? "orden" : "órdenes"}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={`/caja-menor/exportar?mes=${mes}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-[14px] font-medium active:bg-stone-100"
        >
          <Download className="size-4" aria-hidden /> CSV para Excel
        </a>
        <Link
          href={`/caja-menor/reporte?mes=${mes}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-[14px] font-medium active:bg-stone-100"
        >
          <Printer className="size-4" aria-hidden /> PDF del balance
        </Link>
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
                  className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 transition-colors active:bg-stone-50"
                >
                  <span className="text-[15px] font-medium">{etiquetaMes(f.mes)}</span>
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
