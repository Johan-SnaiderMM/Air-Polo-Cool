import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { AccionesCotizacion } from "@/components/cotizaciones/acciones-cotizacion";
import { Dinero } from "@/components/ui/dinero";
import { hoyBogota } from "@/lib/caja";
import {
  ESTADO_COTIZACION_CLASE,
  ESTADO_COTIZACION_LABEL,
  estaVencida,
  totalesCotizacion,
  vigenteHasta,
} from "@/lib/cotizaciones";
import { esUuid, formatearFechaDate } from "@/lib/ordenes";
import { enlaceWhatsApp, mensajeCotizacion } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Cotización" };
export const dynamic = "force-dynamic";

export default async function CotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: cot } = await supabase
    .from("cotizaciones")
    .select("*, vehiculos(placa, marca, modelo, anio, clientes(nombre, telefono))")
    .eq("id", id)
    .maybeSingle();
  if (!cot) notFound();

  const { data: items } = await supabase
    .from("cotizacion_items")
    .select("*")
    .eq("cotizacion_id", id)
    .order("created_at");

  const v = cot.vehiculos;
  const cliente = v?.clientes;
  const lista = items ?? [];
  const totales = totalesCotizacion(cot.mano_obra, lista);
  const hasta = vigenteHasta(cot.fecha, cot.vigencia_dias);
  const vencida = (cot.estado === "borrador" || cot.estado === "enviada") && estaVencida(cot.fecha, cot.vigencia_dias, hoyBogota());
  const vehiculoTexto = v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : "";

  const whatsappHref =
    cliente?.telefono && v
      ? enlaceWhatsApp(
          cliente.telefono,
          mensajeCotizacion({
            cliente: cliente.nombre,
            vehiculo: vehiculoTexto,
            placa: v.placa,
            manoObra: cot.mano_obra,
            items: lista,
            total: totales.total,
            vigenteHasta: formatearFechaDate(hasta),
          })
        )
      : null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/cotizaciones"
          aria-label="Volver a cotizaciones"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Cotización</h2>
      </div>

      <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2.5 py-1 font-mono text-lg font-semibold tracking-wider">
            {v?.placa}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_COTIZACION_CLASE[cot.estado]}`}>
            {ESTADO_COTIZACION_LABEL[cot.estado]}
          </span>
        </div>
        <p className="mt-2 text-base font-medium">{vehiculoTexto}</p>
        <p className="text-sm text-stone-600">{cliente?.nombre}</p>
        <p className="mt-2 text-[13px] text-stone-500">
          Emitida el {formatearFechaDate(cot.fecha)} ·{" "}
          {vencida ? (
            <span className="text-ochre-700">venció el {formatearFechaDate(hasta)}</span>
          ) : (
            <>válida hasta el {formatearFechaDate(hasta)}</>
          )}
          {cot.autor ? ` · ${cot.autor}` : ""}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Detalle</h3>
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
          {lista.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{i.descripcion}</p>
                <p className="text-[13px] text-stone-500">
                  {i.cantidad} × <Dinero valor={i.precio_unitario} />
                </p>
              </div>
              <p className="shrink-0 text-[15px]">
                <Dinero valor={Math.round(i.cantidad * i.precio_unitario)} />
              </p>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 py-3 text-[15px]">
            <span className="text-stone-500">Mano de obra</span>
            <Dinero valor={cot.mano_obra} />
          </li>
        </ul>
        {cot.notas && <p className="px-1 text-[13px] whitespace-pre-line text-stone-600">{cot.notas}</p>}
      </div>

      <div className="rounded-2xl bg-ink p-5 text-paper">
        <p className="text-[13px] text-stone-400">Total</p>
        <p className="mt-1 text-[32px] leading-none font-medium tracking-tight">
          <Dinero valor={totales.total} />
        </p>
        <p className="mt-3 text-[12px] text-stone-500">
          Costo estimado <Dinero valor={totales.costoEstimado} /> · Margen estimado{" "}
          <Dinero valor={totales.margenEstimado} />
        </p>
      </div>

      <AccionesCotizacion id={cot.id} estado={cot.estado} ordenId={cot.orden_id} whatsappHref={whatsappHref} />
    </section>
  );
}
