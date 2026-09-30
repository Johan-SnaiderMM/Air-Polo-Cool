import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { LineaFirma, Membrete, SeccionImpresa } from "@/components/print/membrete";
import { BarraImpresion } from "@/components/print/boton-imprimir";
import { Dinero } from "@/components/ui/dinero";
import { CATEGORIAS, CATEGORIA_LABEL, MEDIO_PAGO_LABEL, etiquetaMes, normalizarMes, rangoMes, totalesPorMedio } from "@/lib/caja";
import { formatearFecha } from "@/lib/ordenes";

export const metadata: Metadata = { title: "Reporte de balance" };
export const dynamic = "force-dynamic";

export default async function ReporteBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const mes = normalizarMes((await searchParams).mes);
  const { desde, hasta } = rangoMes(mes);
  const supabase = await createClient();

  const [balance, gastos, rentab, cartera, pagos] = await Promise.all([
    supabase.from("v_balance_real").select("*").eq("mes", `${mes}-01`).maybeSingle(),
    supabase
      .from("gastos_caja_menor")
      .select("categoria, monto")
      .eq("anulado", false)
      .gte("fecha", desde)
      .lt("fecha", hasta),
    supabase
      .from("v_rentabilidad_orden")
      .select("placa, cliente, pagado, costo_repuestos, gastos_directos, utilidad_real")
      .eq("estado", "entregado")
      .gte("fecha_entrega", `${desde}T00:00:00-05:00`)
      .lt("fecha_entrega", `${hasta}T00:00:00-05:00`)
      .order("utilidad_real", { ascending: false })
      .limit(40),
    supabase.from("v_cartera").select("saldo").limit(1000),
    supabase
      .from("pagos_orden")
      .select("medio, monto, es_devolucion")
      .eq("anulado", false)
      .gte("fecha", desde)
      .lt("fecha", hasta),
  ]);

  const b = balance.data;
  const porCategoria = CATEGORIAS.map((c) => ({
    categoria: c,
    total: (gastos.data ?? []).filter((g) => g.categoria === c).reduce((s, g) => s + g.monto, 0),
  })).filter((c) => c.total > 0);
  const porMedio = totalesPorMedio(pagos.data ?? []);
  const totalGastos = porCategoria.reduce((s, c) => s + c.total, 0);
  const totalCartera = (cartera.data ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0);

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
                <Dinero valor={b?.cobrado ?? 0} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">− Costo de repuestos</dt>
              <dd>
                <Dinero valor={b?.costo_repuestos ?? 0} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">− Gastos de caja menor</dt>
              <dd>
                <Dinero valor={b?.gastos ?? 0} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-1 text-[15px] font-medium">
              <dt>Utilidad neta real</dt>
              <dd>
                <Dinero valor={b?.utilidad_real ?? 0} />
              </dd>
            </div>
          </dl>
          <p className="text-stone-500">
            Facturado en el mes (órdenes entregadas): <Dinero valor={b?.facturado ?? 0} /> · Por cobrar (total
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
          {(rentab.data ?? []).length === 0 ? (
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
                {(rentab.data ?? []).map((r, i) => (
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
