import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Dinero } from "@/components/ui/dinero";
import { hoyBogota } from "@/lib/caja";
import {
  ESTADO_COTIZACION_CLASE,
  ESTADO_COTIZACION_LABEL,
  estaVencida,
  vigenteHasta,
} from "@/lib/cotizaciones";
import { formatearFechaCorta } from "@/lib/ordenes";
import type { EstadoCotizacion } from "@/types/database";

export const metadata: Metadata = { title: "Cotizaciones" };

const ESTADOS: EstadoCotizacion[] = ["borrador", "enviada", "aprobada", "rechazada", "convertida"];
const esEstadoCot = (v: string | undefined): v is EstadoCotizacion => !!v && (ESTADOS as string[]).includes(v);

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado: estadoCrudo } = await searchParams;
  const estado = esEstadoCot(estadoCrudo) ? estadoCrudo : undefined;
  const supabase = await createClient();

  let consulta = supabase
    .from("cotizaciones")
    .select("id, estado, fecha, vigencia_dias, vehiculos(placa, marca, modelo, anio, clientes(nombre))")
    .order("created_at", { ascending: false })
    .limit(80);
  if (estado) consulta = consulta.eq("estado", estado);

  const [{ data, error }, { data: totales }] = await Promise.all([
    consulta,
    supabase.from("v_cotizacion_totales").select("cotizacion_id, total").limit(500),
  ]);
  const totalDe = new Map(
    (totales ?? []).flatMap((t) => (t.cotizacion_id ? [[t.cotizacion_id, t.total ?? 0] as const] : []))
  );
  const hoy = hoyBogota();
  const migracionPendiente = error?.code === "PGRST205" || error?.code === "42P01";

  const chips: { valor?: EstadoCotizacion; label: string }[] = [
    { label: "Todas" },
    ...ESTADOS.map((e) => ({ valor: e, label: ESTADO_COTIZACION_LABEL[e].replace(" en orden", "") })),
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/ordenes"
          className="flex h-11 items-center justify-center rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100"
        >
          Órdenes
        </Link>
        <span aria-current="page" className="flex h-11 items-center justify-center rounded-xl bg-ink text-sm font-medium text-white">
          Cotizaciones
        </span>
      </div>

      <nav
        aria-label="Filtrar por estado"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((c) => {
          const activo = c.valor === estado;
          return (
            <Link
              key={c.label}
              href={c.valor ? `/cotizaciones?estado=${c.valor}` : "/cotizaciones"}
              replace
              aria-current={activo ? "true" : undefined}
              className={`flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-medium transition-colors ${
                activo ? "border-ink bg-ink text-white" : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      {migracionPendiente && (
        <p role="alert" className="rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
          Falta ejecutar <strong>polo_air_cool_fase4.sql</strong> en Supabase para usar cotizaciones.
        </p>
      )}
      {error && !migracionPendiente && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudieron cargar las cotizaciones: {error.message}
        </p>
      )}

      {!error && (data ?? []).length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          No hay cotizaciones{estado ? " en este estado" : ""}. Crea la primera con “Nueva cotización”.
        </p>
      )}

      <ul className="space-y-3">
        {(data ?? []).map((c) => {
          const v = c.vehiculos;
          const vencida = (c.estado === "borrador" || c.estado === "enviada") && estaVencida(c.fecha, c.vigencia_dias, hoy);
          return (
            <li key={c.id}>
              <Link
                href={`/cotizaciones/${c.id}`}
                className="block rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors active:bg-stone-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[15px] font-semibold tracking-[0.12em]">
                    {v?.placa ?? "—"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_COTIZACION_CLASE[c.estado]}`}>
                    {ESTADO_COTIZACION_LABEL[c.estado]}
                  </span>
                </div>
                <p className="mt-3 truncate text-[17px] leading-snug font-medium tracking-tight">
                  {v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : "Vehículo"}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="min-w-0 truncate text-[13px] text-stone-500">
                    {v?.clientes?.nombre ?? "Sin cliente"} · {formatearFechaCorta(c.fecha)}
                    {vencida && <span className="text-ochre-700"> · vencida</span>}
                    {!vencida && (c.estado === "borrador" || c.estado === "enviada") && (
                      <span> · válida hasta {formatearFechaCorta(vigenteHasta(c.fecha, c.vigencia_dias))}</span>
                    )}
                  </p>
                  <Dinero valor={totalDe.get(c.id) ?? 0} className="shrink-0 text-[15px] font-medium" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/cotizaciones/nueva"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-accent-600 px-6 text-[15px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(31,30,29,0.45)] transition-colors active:bg-accent-700"
      >
        <Plus className="size-6" aria-hidden />
        Nueva cotización
      </Link>
    </section>
  );
}
