import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LineaFirma, Membrete, SeccionImpresa } from "@/components/print/membrete";
import { BarraImpresion } from "@/components/print/boton-imprimir";
import { Dinero } from "@/components/ui/dinero";
import { totalesCotizacion, vigenteHasta } from "@/lib/cotizaciones";
import { esUuid, formatearFecha, formatearFechaDate } from "@/lib/ordenes";

export const metadata: Metadata = { title: "Cotización (PDF)" };
export const dynamic = "force-dynamic";

/** Vista imprimible para el cliente: NO muestra costos ni márgenes internos. */
export default async function ImprimirCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: cot } = await supabase
    .from("cotizaciones")
    .select("*, vehiculos(placa, marca, modelo, anio, clientes(nombre, telefono))")
    .eq("id", id)
    .maybeSingle();
  if (!cot) notFound();
  const { data: items } = await supabase.from("cotizacion_items").select("*").eq("cotizacion_id", id).order("created_at");

  const v = cot.vehiculos;
  const lista = items ?? [];
  const totales = totalesCotizacion(cot.mano_obra, lista);

  return (
    <div>
      <BarraImpresion volver={`/cotizaciones/${id}`} />

      <article className="mx-auto max-w-[760px] space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-[13px] text-ink print:rounded-none print:border-0 print:p-0">
        <Membrete
          titulo="Cotización"
          referencia={cot.id.slice(0, 8).toUpperCase()}
          fecha={`Emitida el ${formatearFechaDate(cot.fecha)}`}
        />

        <div className="grid grid-cols-2 gap-4">
          <SeccionImpresa titulo="Vehículo">
            <p className="font-mono text-lg font-semibold tracking-widest">{v?.placa}</p>
            <p>
              {v?.marca} {v?.modelo}
              {v?.anio ? ` ${v.anio}` : ""}
            </p>
          </SeccionImpresa>
          <SeccionImpresa titulo="Cliente">
            <p className="font-medium">{v?.clientes?.nombre}</p>
            <p>{v?.clientes?.telefono}</p>
          </SeccionImpresa>
        </div>

        <SeccionImpresa titulo="Detalle">
          <table className="w-full text-left">
            <thead className="text-[11px] text-stone-500 uppercase">
              <tr>
                <th className="py-1 font-medium">Concepto</th>
                <th className="py-1 text-right font-medium">Cant.</th>
                <th className="py-1 text-right font-medium">Precio</th>
                <th className="py-1 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lista.map((i) => (
                <tr key={i.id}>
                  <td className="py-1.5">{i.descripcion}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{i.cantidad}</td>
                  <td className="py-1.5 text-right">
                    <Dinero valor={i.precio_unitario} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Dinero valor={Math.round(i.cantidad * i.precio_unitario)} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5">Mano de obra</td>
                <td />
                <td />
                <td className="py-1.5 text-right">
                  <Dinero valor={cot.mano_obra} />
                </td>
              </tr>
              <tr className="text-[15px] font-medium">
                <td className="py-2" colSpan={3}>
                  Total
                </td>
                <td className="py-2 text-right">
                  <Dinero valor={totales.total} />
                </td>
              </tr>
            </tbody>
          </table>
        </SeccionImpresa>

        {cot.notas && (
          <SeccionImpresa titulo="Notas">
            <p className="whitespace-pre-line">{cot.notas}</p>
          </SeccionImpresa>
        )}

        <p className="text-stone-500">
          Cotización válida hasta el {formatearFechaDate(vigenteHasta(cot.fecha, cot.vigencia_dias))}. Los repuestos son
          estimados y el valor final se confirma al terminar el trabajo. Emitida {formatearFecha(cot.created_at)}.
        </p>

        <div className="evitar-corte flex gap-10 pt-6">
          <LineaFirma etiqueta="Aprobado por el cliente" />
          <LineaFirma etiqueta="Polo Air Cool" />
        </div>
      </article>
    </div>
  );
}
