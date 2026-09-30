import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LineaFirma, Membrete, SeccionImpresa } from "@/components/print/membrete";
import { BarraImpresion } from "@/components/print/boton-imprimir";
import { Dinero } from "@/components/ui/dinero";
import { DENOMINACIONES, RESULTADO_LABEL, desgloseLimpio } from "@/lib/arqueo";
import { CATEGORIA_LABEL, etiquetaDia } from "@/lib/caja";
import { esUuid, formatearFecha, formatearFechaDate } from "@/lib/ordenes";
import type { TipoMovCaja } from "@/types/database";

export const metadata: Metadata = { title: "Comprobante de cierre de caja" };
export const dynamic = "force-dynamic";

const MOV_LABEL: Record<TipoMovCaja, string> = {
  fondo_inicial: "Fondo inicial",
  reposicion: "Reposición",
  retiro: "Retiro",
  ajuste_sobrante: "Ajuste por sobrante",
  ajuste_faltante: "Ajuste por faltante",
};
const ENTRADA: Record<TipoMovCaja, boolean> = {
  fondo_inicial: true,
  reposicion: true,
  retiro: false,
  ajuste_sobrante: true,
  ajuste_faltante: false,
};

export default async function ComprobanteCierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: cierre } = await supabase.from("cierres_caja").select("*").eq("id", id).maybeSingle();
  if (!cierre) notFound();

  const [gastos, cobros, movs] = await Promise.all([
    supabase
      .from("gastos_caja_menor")
      .select("categoria, descripcion, monto, ordenes_servicio(vehiculos(placa))")
      .eq("fecha", cierre.fecha)
      .eq("anulado", false)
      .order("created_at"),
    supabase
      .from("pagos_orden")
      .select("monto, es_devolucion, ordenes_servicio(vehiculos(placa))")
      .eq("fecha", cierre.fecha)
      .eq("medio", "efectivo")
      .eq("anulado", false)
      .order("created_at"),
    supabase
      .from("caja_movimientos")
      .select("tipo, monto, notas")
      .eq("fecha", cierre.fecha)
      .eq("anulado", false)
      .order("created_at"),
  ]);

  const desglose = desgloseLimpio(cierre.desglose);
  const filasDesglose = DENOMINACIONES.flatMap((d) => {
    const cantidad = desglose[String(d)] ?? 0;
    return cantidad > 0 ? [{ valor: d, cantidad, subtotal: d * cantidad }] : [];
  });

  const totalGastos = (gastos.data ?? []).reduce((s, g) => s + g.monto, 0);
  const totalCobros = (cobros.data ?? []).reduce((s, p) => s + (p.es_devolucion ? -p.monto : p.monto), 0);

  return (
    <div>
      <BarraImpresion volver="/caja-menor?vista=caja" />

      <article className="mx-auto max-w-[760px] space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-[13px] text-ink print:rounded-none print:border-0 print:p-0">
        <Membrete
          titulo="Cierre de caja"
          referencia={cierre.id.slice(0, 8).toUpperCase()}
          fecha={`Día cerrado: ${formatearFechaDate(cierre.fecha)}`}
        />

        {cierre.anulado && (
          <p className="rounded-lg border border-brick-300 bg-brick-50 px-3 py-2 text-brick-700">
            <strong>CIERRE ANULADO</strong> · {cierre.anulado_motivo}
          </p>
        )}

        <SeccionImpresa titulo="Resultado del arqueo">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-stone-500">Saldo según el sistema</p>
              <p className="text-lg">
                <Dinero valor={cierre.saldo_sistema} />
              </p>
            </div>
            <div>
              <p className="text-stone-500">Conteo físico</p>
              <p className="text-lg">
                <Dinero valor={cierre.conteo_fisico} />
              </p>
            </div>
            <div>
              <p className="text-stone-500">{RESULTADO_LABEL[cierre.resultado]}</p>
              <p className="text-lg font-medium">
                {cierre.diferencia > 0 ? "+" : ""}
                <Dinero valor={cierre.diferencia} />
              </p>
            </div>
          </div>
          {cierre.notas && <p className="text-stone-500">Notas: {cierre.notas}</p>}
          <p className="text-stone-500">
            Registrado por {cierre.autor ?? "—"} · {formatearFecha(cierre.created_at)}
          </p>
        </SeccionImpresa>

        <SeccionImpresa titulo="Conteo de efectivo">
          {filasDesglose.length === 0 ? (
            <p className="text-stone-500">Sin desglose registrado.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[11px] text-stone-500 uppercase">
                <tr>
                  <th className="py-1 font-medium">Denominación</th>
                  <th className="py-1 text-right font-medium">Piezas</th>
                  <th className="py-1 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filasDesglose.map((f) => (
                  <tr key={f.valor}>
                    <td className="py-1">
                      <Dinero valor={f.valor} />
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">{f.cantidad}</td>
                    <td className="py-1 text-right">
                      <Dinero valor={f.subtotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SeccionImpresa>

        <SeccionImpresa titulo={`Movimientos del día (${etiquetaDia(cierre.fecha)})`}>
          <ul className="divide-y divide-stone-100">
            {(movs.data ?? []).map((m, i) => (
              <li key={`m${i}`} className="flex justify-between py-1">
                <span>
                  {MOV_LABEL[m.tipo]}
                  {m.notas ? ` · ${m.notas}` : ""}
                </span>
                <span>
                  {ENTRADA[m.tipo] ? "+" : "−"}
                  <Dinero valor={m.monto} />
                </span>
              </li>
            ))}
            {(cobros.data ?? []).map((p, i) => (
              <li key={`c${i}`} className="flex justify-between py-1">
                <span>
                  {p.es_devolucion ? "Devolución en efectivo" : "Cobro en efectivo"}
                  {p.ordenes_servicio?.vehiculos?.placa ? ` · ${p.ordenes_servicio.vehiculos.placa}` : ""}
                </span>
                <span>
                  {p.es_devolucion ? "−" : "+"}
                  <Dinero valor={p.monto} />
                </span>
              </li>
            ))}
            {(gastos.data ?? []).map((g, i) => (
              <li key={`g${i}`} className="flex justify-between py-1">
                <span>
                  Gasto · {CATEGORIA_LABEL[g.categoria]}
                  {g.descripcion ? ` · ${g.descripcion}` : ""}
                  {g.ordenes_servicio?.vehiculos?.placa ? ` · ${g.ordenes_servicio.vehiculos.placa}` : ""}
                </span>
                <span>
                  −<Dinero valor={g.monto} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-stone-500">
            Cobros en efectivo: <Dinero valor={totalCobros} /> · Gastos: <Dinero valor={totalGastos} />
          </p>
        </SeccionImpresa>

        <div className="evitar-corte flex gap-10 pt-6">
          <LineaFirma etiqueta="Contó (Polo / Soporte técnico)" />
          <LineaFirma etiqueta="Revisó" />
        </div>
      </article>
    </div>
  );
}
