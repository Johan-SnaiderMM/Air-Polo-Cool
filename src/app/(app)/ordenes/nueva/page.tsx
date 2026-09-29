import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { esUuid } from "@/lib/ordenes";
import { OrdenForm } from "@/components/ordenes/orden-form";
import type { VehiculoResultado } from "@/app/(app)/ordenes/actions";

export const metadata: Metadata = { title: "Nueva orden" };

export default async function NuevaOrdenPage({
  searchParams,
}: {
  searchParams: Promise<{ vehiculo?: string }>;
}) {
  const { vehiculo: vehiculoId } = await searchParams;

  // ?vehiculo=<id> preselecciona el vehículo (desde su historial).
  let vehiculoInicial: VehiculoResultado | null = null;
  if (vehiculoId && esUuid(vehiculoId)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo, anio, clientes(nombre)")
      .eq("id", vehiculoId)
      .maybeSingle();
    if (data) {
      vehiculoInicial = {
        id: data.id,
        placa: data.placa,
        marca: data.marca,
        modelo: data.modelo,
        anio: data.anio,
        cliente: data.clientes?.nombre ?? "",
      };
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/ordenes"
          aria-label="Volver a órdenes"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Nueva orden</h2>
      </div>

      <OrdenForm modo="crear" vehiculoInicial={vehiculoInicial} />

      <p className="text-center text-sm text-stone-500">
        Al crear la orden podrás adjuntar las fotos de ingreso.
      </p>
    </section>
  );
}
