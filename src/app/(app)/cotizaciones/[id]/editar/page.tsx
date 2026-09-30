import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cargarCotizacion } from "@/lib/datos/cotizaciones";
import { CotizacionForm } from "@/components/cotizaciones/cotizacion-form";
import { esUuid } from "@/lib/ordenes";

export const metadata: Metadata = { title: "Editar cotización" };
export const dynamic = "force-dynamic";

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const datos = await cargarCotizacion(await createClient(), id);
  if (!datos) notFound();
  const { cotizacion: cot, items } = datos;
  if (cot.estado === "convertida") redirect(`/cotizaciones/${id}`);

  const v = cot.vehiculos;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/cotizaciones/${id}`}
          aria-label="Volver a la cotización"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Editar cotización</h2>
      </div>

      <CotizacionForm
        modo="editar"
        cotizacionId={cot.id}
        vehiculoTexto={v ? `${v.placa} · ${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""} · ${v.clientes?.nombre ?? ""}` : ""}
        inicial={{
          mano_obra: cot.mano_obra,
          vigencia_dias: cot.vigencia_dias,
          notas: cot.notas ?? "",
          items: items.map((i) => ({
            inventario_id: i.inventario_id,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            costo_unitario: i.costo_unitario,
          })),
        }}
      />
    </section>
  );
}
