import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { enlaceWhatsApp, mensajeGarantia } from "@/lib/whatsapp";
import { formatearFechaDate } from "@/lib/ordenes";
import type { SemaforoGarantia, Views } from "@/types/database";

export const metadata: Metadata = { title: "Garantías" };

type Filtro = SemaforoGarantia | "todas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "amarillo", label: "Por vencer" },
  { id: "verde", label: "Vigentes" },
  { id: "rojo", label: "Vencidas" },
  { id: "todas", label: "Todas" },
];

const ESTILO: Record<SemaforoGarantia, { punto: string; texto: string; etiqueta: string }> = {
  verde: { punto: "bg-sage-500", texto: "text-sage-700", etiqueta: "Vigente" },
  amarillo: { punto: "bg-ochre-500", texto: "text-ochre-700", etiqueta: "Por vencer" },
  rojo: { punto: "bg-brick-500", texto: "text-brick-700", etiqueta: "Vencida" },
};

const esSemaforo = (v: string | undefined): v is SemaforoGarantia =>
  v === "verde" || v === "amarillo" || v === "rojo";

type Fila = Views<"v_garantias">;

export default async function GarantiasPage({
  searchParams,
}: {
  searchParams: Promise<{ semaforo?: string }>;
}) {
  const { semaforo } = await searchParams;
  const filtro: Filtro = semaforo === "todas" ? "todas" : esSemaforo(semaforo) ? semaforo : "amarillo";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_garantias")
    .select("*")
    .order("fecha_fin_garantia", { ascending: true })
    .limit(500);

  const todas = (data ?? []).filter((g: Fila) => g.orden_id && g.semaforo);
  const cuenta = (s: SemaforoGarantia) => todas.filter((g) => g.semaforo === s).length;
  const conteos: Record<Filtro, number> = {
    amarillo: cuenta("amarillo"),
    verde: cuenta("verde"),
    rojo: cuenta("rojo"),
    todas: todas.length,
  };

  let visibles = filtro === "todas" ? todas : todas.filter((g) => g.semaforo === filtro);
  // Vencidas: las más recientes primero; el resto, las que vencen antes primero.
  if (filtro === "rojo") visibles = [...visibles].reverse();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/vehiculos"
          aria-label="Volver a vehículos"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Garantías</h2>
      </div>

      <nav
        aria-label="Filtrar garantías"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "amarillo" ? "/garantias" : `/garantias?semaforo=${f.id}`}
            replace
            aria-current={filtro === f.id ? "true" : undefined}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
              filtro === f.id
                ? "border-ink bg-ink text-white"
                : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-2 text-xs ${
                filtro === f.id ? "bg-white/25" : "bg-stone-100"
              }`}
            >
              {conteos[f.id]}
            </span>
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudieron cargar las garantías: {error.message}
        </p>
      )}

      {!error && visibles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          No hay garantías en esta categoría.
        </p>
      )}

      <ul className="space-y-3">
        {visibles.map((g) => {
          const s = ESTILO[g.semaforo as SemaforoGarantia];
          const restantes = g.dias_restantes ?? 0;
          const fin = g.fecha_fin_garantia ? formatearFechaDate(g.fecha_fin_garantia) : "";
          const recordatorio =
            g.telefono && g.cliente && g.placa
              ? enlaceWhatsApp(
                  g.telefono,
                  mensajeGarantia({
                    cliente: g.cliente,
                    placa: g.placa,
                    fechaFin: fin,
                    diasRestantes: restantes,
                  })
                )
              : null;

          return (
            <li
              key={g.orden_id}
              className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2.5 py-1 font-mono text-lg font-semibold tracking-wider text-ink">
                  {g.placa}
                </span>
                <span className={`flex items-center gap-2 text-sm font-semibold ${s.texto}`}>
                  <span className={`size-3 rounded-full ${s.punto}`} aria-hidden />
                  {s.etiqueta}
                </span>
              </div>

              <div>
                <p className="font-medium">{g.cliente}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
                  <CalendarClock className="size-4" aria-hidden />
                  Vence el {fin} ·{" "}
                  {restantes < 0
                    ? `hace ${Math.abs(restantes)} ${Math.abs(restantes) === 1 ? "día" : "días"}`
                    : restantes === 0
                      ? "hoy"
                      : `en ${restantes} ${restantes === 1 ? "día" : "días"}`}
                </p>
              </div>

              <div className="flex gap-2">
                {recordatorio && (
                  <a
                    href={recordatorio}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 flex-1 items-center justify-center rounded-xl bg-sage-700 text-sm font-semibold text-white active:bg-sage-800"
                  >
                    Enviar recordatorio
                  </a>
                )}
                <Link
                  href={`/ordenes/${g.orden_id}`}
                  className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-stone-300/70 text-sm font-semibold text-stone-700 active:bg-stone-100"
                >
                  Ver orden <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {todas.length === 500 && (
        <p className="text-center text-xs text-stone-500">Mostrando las primeras 500 garantías.</p>
      )}
    </section>
  );
}
