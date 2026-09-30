import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CotizacionForm } from "@/components/cotizaciones/cotizacion-form";

export const metadata: Metadata = { title: "Nueva cotización" };

export default function NuevaCotizacionPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/cotizaciones"
          aria-label="Volver a cotizaciones"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Nueva cotización</h2>
      </div>
      <CotizacionForm modo="crear" />
    </section>
  );
}
