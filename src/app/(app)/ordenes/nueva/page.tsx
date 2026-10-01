import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { esUuid } from "@/lib/ordenes";
import { OrdenFormCrear } from "@/components/ordenes/orden-form-crear";
import { buscarVehiculoParaOrden } from "@/lib/datos/vehiculos";

export const metadata: Metadata = { title: "Nueva orden" };

export default async function NuevaOrdenPage({
  searchParams,
}: {
  searchParams: Promise<{ vehiculo?: string; cita?: string }>;
}) {
  const { vehiculo: vehiculoId, cita } = await searchParams;

  // ?vehiculo=<id> preselecciona el vehículo (desde su historial).
  const vehiculoInicial =
    vehiculoId && esUuid(vehiculoId) ? await buscarVehiculoParaOrden(await createClient(), vehiculoId) : null;

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

      {/* ?cita=<id> viene de la agenda: esa cita se cierra al guardar la orden. */}
      <OrdenFormCrear vehiculoInicial={vehiculoInicial} citaId={vehiculoInicial && cita && esUuid(cita) ? cita : null} />

      <p className="text-center text-sm text-stone-500">
        Al crear la orden podrás adjuntar las fotos de ingreso.
      </p>
    </section>
  );
}
