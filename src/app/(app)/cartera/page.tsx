import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Dinero } from "@/components/ui/dinero";
import { EstadoBadge } from "@/components/ordenes/estado-badge";
import { enlaceWhatsApp, mensajeCobro } from "@/lib/whatsapp";
import { formatearFechaCorta } from "@/lib/ordenes";
import { cargarCartera } from "@/lib/datos/cartera";

export const metadata: Metadata = { title: "Por cobrar" };

/** Días desde la entrega -> tono: pasado de 30 días, ocre; de 60, ladrillo. */
function tonoAntiguedad(dias: number | null): string {
  if (dias === null) return "bg-stone-100 text-stone-600";
  if (dias > 60) return "bg-brick-50 text-brick-700";
  if (dias > 30) return "bg-ochre-50 text-ochre-800";
  return "bg-stone-100 text-stone-600";
}

export default async function CarteraPage() {
  const { clientes: lista, totalOrdenes, total, error, migracionPendiente } = await cargarCartera(await createClient());

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/caja-menor?vista=balance"
          aria-label="Volver al balance"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Por cobrar</h2>
      </div>

      {migracionPendiente && (
        <p role="alert" className="rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
          Falta ejecutar la migración de la fase 3 (supabase/migrations) en Supabase para ver las cuentas por cobrar.
        </p>
      )}
      {error && !migracionPendiente && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudo cargar la cartera: {error}
        </p>
      )}

      <div className="rounded-2xl bg-ink p-6 text-paper">
        <p className="text-[13px] text-stone-400">Total por cobrar</p>
        <p className="mt-2 text-[34px] leading-none font-medium tracking-tight">
          <Dinero valor={total} />
        </p>
        <p className="mt-3 text-[13px] text-stone-400">
          {lista.length} {lista.length === 1 ? "cliente" : "clientes"} · {totalOrdenes}{" "}
          {totalOrdenes === 1 ? "orden" : "órdenes"}
        </p>
      </div>

      {lista.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          No hay saldos pendientes. Todo está al día.
        </p>
      )}

      <ul className="space-y-4">
        {lista.map((c) => (
          <li key={c.telefono || c.nombre} className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-medium">{c.nombre}</p>
                <p className="text-[12px] text-stone-500">{c.telefono}</p>
              </div>
              <p className="shrink-0 text-[17px] text-ochre-700">
                <Dinero valor={c.total} />
              </p>
            </div>

            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {c.ordenes.map((o) => {
                const recordatorio =
                  o.telefono && o.placa
                    ? enlaceWhatsApp(
                        o.telefono,
                        mensajeCobro({ cliente: o.cliente ?? c.nombre, placa: o.placa, saldo: o.saldo ?? 0 })
                      )
                    : null;
                return (
                  <li key={o.orden_id} className="space-y-2 px-4 py-3">
                    <Link href={`/ordenes/${o.orden_id}`} className="flex items-center gap-3">
                      <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wider">
                        {o.placa}
                      </span>
                      {o.estado && <EstadoBadge estado={o.estado} />}
                      <span className="ml-auto text-[15px]">
                        <Dinero valor={o.saldo ?? 0} />
                      </span>
                      <ChevronRight className="size-4 text-stone-300" aria-hidden />
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-500">
                      <span>
                        Total <Dinero valor={o.total_cobrado ?? 0} /> · Pagado <Dinero valor={o.pagado ?? 0} />
                      </span>
                      {o.fecha_entrega && (
                        <span className={`rounded-full px-2 py-0.5 ${tonoAntiguedad(o.dias_desde_entrega)}`}>
                          Entregado {formatearFechaCorta(o.fecha_entrega)}
                          {o.dias_desde_entrega !== null ? ` · hace ${o.dias_desde_entrega} d` : ""}
                        </span>
                      )}
                    </div>
                    {recordatorio && (
                      <a
                        href={recordatorio}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-sage-700 text-[13px] font-medium text-white active:bg-sage-800"
                      >
                        <MessageCircle className="size-4" aria-hidden /> Recordar saldo por WhatsApp
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
