import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { cargarReporteMes } from "@/lib/datos/caja";
import { LineaFirma, Membrete, SeccionImpresa } from "@/components/print/membrete";
import { BarraImpresion } from "@/components/print/boton-imprimir";
import { Dinero } from "@/components/ui/dinero";
import { CATEGORIA_LABEL, MEDIO_PAGO_LABEL, etiquetaMes, normalizarMes } from "@/lib/caja";
import { formatearFecha } from "@/lib/ordenes";

export const metadata: Metadata = { title: "Reporte de balance" };
export const dynamic = "force-dynamic";

export default async function ReporteBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const mes = normalizarMes((await searchParams).mes);
  const { balance: b, porCategoria, totalGastos, porMedio, rentabilidad, totalCartera } = await cargarReporteMes(
    await createClient(),
    mes
  );

  return (
    <div>
      <BarraImpresion volver={`/caja-menor?vista=balance&mes=${mes}`} />

      <article className="mx-auto max-w-[760px] space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-[13px] text-ink print:rounded-none print:border-0 print:p-0">
        <Membrete
          titulo="Balance mensual"
          referencia={mes}
          fecha={`${etiquetaMes(mes)} · emitido ${formatearFecha(new Date().toISOString())}`}
        />

        <SeccionImpresa titulo="Resultado del mes (base cobrado)">
          <dl className="max-w-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-stone-500">Cobrado (neto de devoluciones)</dt>
              <dd>
                <Dinero valor={b.cobrado} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">− Costo de repuestos</dt>
              <dd>
                <Dinero valor={b.costoRepuestos} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">− Gastos de caja menor</dt>
              <dd>
                <Dinero valor={b.gastos} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-1 text-[15px] font-medium">
              <dt>Utilidad neta real</dt>
              <dd>
                <Dinero valor={b.utilidadReal} />
              </dd>
            </div>
          </dl>
          <p className="text-stone-500">
            Facturado en el mes (órdenes entregadas): <Dinero valor={b.facturado} /> · Por cobrar (total
            acumulado): <Dinero valor={totalCartera} />
          </p>
        </SeccionImpresa>

        <SeccionImpresa titulo="Cobrado por medio de pago">
          <dl className="max-w-sm space-y-1">
            {(["efectivo", "transferencia", "tarjeta", "otro"] as const)
              .filter((m) => m === "efectivo" || m === "transferencia" || porMedio[m] !== 0)
              .map((m) => (
                <div key={m} className="flex justify-between">
                  <dt className="text-stone-500">{MEDIO_PAGO_LABEL[m]}</dt>
                  <dd>
                    <Dinero valor={porMedio[m]} />
                  </dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-stone-300 pt-1 font-medium">
              <dt>Total cobrado</dt>
              <dd>
                <Dinero valor={porMedio.total} />
              </dd>
            </div>
          </dl>
        </SeccionImpresa>

        <SeccionImpresa titulo="Gastos por categoría">
          {porCategoria.length === 0 ? (
            <p className="text-stone-500">Sin gastos en el mes.</p>
          ) : (
            <table className="w-full text-left">
              <tbody className="divide-y divide-stone-100">
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td className="py-1">{CATEGORIA_LABEL[c.categoria]}</td>
                    <td className="py-1 text-right text-stone-500">
                      {totalGastos > 0 ? Math.round((c.total / totalGastos) * 100) : 0} %
                    </td>
                    <td className="py-1 text-right">
                      <Dinero valor={c.total} />
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1.5">Total</td>
                  <td />
                  <td className="py-1.5 text-right">
                    <Dinero valor={totalGastos} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </SeccionImpresa>

        <SeccionImpresa titulo="Rentabilidad por orden entregada">
          {rentabilidad.length === 0 ? (
            <p className="text-stone-500">Sin órdenes entregadas en el mes.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[11px] text-stone-500 uppercase">
                <tr>
                  <th className="py-1 font-medium">Placa</th>
                  <th className="py-1 text-right font-medium">Cobrado</th>
                  <th className="py-1 text-right font-medium">Costos</th>
                  <th className="py-1 text-right font-medium">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rentabilidad.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 font-mono tracking-wider">
                      {r.placa} <span className="font-sans tracking-normal text-stone-500">{r.cliente}</span>
                    </td>
                    <td className="py-1 text-right">
                      <Dinero valor={r.pagado ?? 0} />
                    </td>
                    <td className="py-1 text-right">
                      <Dinero valor={(r.costo_repuestos ?? 0) + (r.gastos_directos ?? 0)} />
                    </td>
                    <td className="py-1 text-right">
                      <Dinero valor={r.utilidad_real ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SeccionImpresa>

        <div className="evitar-corte flex gap-10 pt-6">
          <LineaFirma etiqueta="Elaboró" />
          <LineaFirma etiqueta="Revisó (contador)" />
        </div>
      </article>
    </div>
  );
}
