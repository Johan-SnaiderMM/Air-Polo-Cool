import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { filtroVehiculos } from "@/lib/consultas";
import { ESTADOS_FILTRO, ESTADO_LABEL, esEstado } from "@/lib/ordenes";
import { OrdenCard, type OrdenResumen } from "@/components/ordenes/orden-card";
import { OrdenesPendientes } from "@/components/sync/ordenes-pendientes";
import { SearchBar } from "@/components/ordenes/search-bar";

export const metadata: Metadata = { title: "Órdenes" };

const LIMITE = 50;

function hrefFiltro(q: string, estado?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  const qs = params.toString();
  return qs ? `/ordenes?${qs}` : "/ordenes";
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q: qCrudo, estado: estadoCrudo } = await searchParams;
  const q = (qCrudo ?? "").trim();
  const estado = esEstado(estadoCrudo) ? estadoCrudo : undefined;

  const supabase = await createClient();

  let ids: string[] | null = null; // null = sin filtro de texto
  if (q) {
    const filtro = await filtroVehiculos(supabase, q);
    if (filtro) {
      const { data } = await supabase
        .from("vehiculos")
        .select("id")
        .or(filtro)
        .limit(100); // tope: los ids viajan en la URL de la consulta siguiente
      ids = (data ?? []).map((v) => v.id);
    } else {
      ids = [];
    }
  }

  let ordenes: OrdenResumen[] = [];
  let errorConsulta: string | null = null;

  if (ids === null || ids.length > 0) {
    let consulta = supabase
      .from("ordenes_servicio")
      .select(
        "id, estado, fecha_ingreso, total_cobrado, mantenimiento_meses, vehiculos(placa, marca, modelo, anio, clientes(nombre))"
      )
      .order("fecha_ingreso", { ascending: false })
      .limit(LIMITE);

    if (estado) consulta = consulta.eq("estado", estado);
    if (ids) consulta = consulta.in("vehiculo_id", ids);

    const { data, error } = await consulta;
    if (error) errorConsulta = error.message;
    ordenes = (data ?? []) as OrdenResumen[];
  }

  // Saldos por cobrar de las órdenes listadas (una sola consulta acotada, sin ids en la URL).
  const { data: saldos } = await supabase
    .from("v_saldo_ordenes")
    .select("orden_id, saldo")
    .gt("saldo", 0)
    .limit(1000);
  const saldoDe = new Map(
    (saldos ?? []).flatMap((x) => (x.orden_id && x.saldo !== null ? [[x.orden_id, x.saldo] as const] : []))
  );

  const chips: { valor?: string; label: string }[] = [
    { label: "Todos" },
    ...ESTADOS_FILTRO.map((e) => ({ valor: e, label: ESTADO_LABEL[e] })),
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <span
          aria-current="page"
          className="flex h-11 items-center justify-center rounded-xl bg-ink text-sm font-medium text-white"
        >
          Órdenes
        </span>
        <Link
          href="/cotizaciones"
          className="flex h-11 items-center justify-center rounded-xl border border-stone-300/70 bg-white text-sm font-medium text-stone-700 active:bg-stone-100"
        >
          Cotizaciones
        </Link>
      </div>

      <OrdenesPendientes />

      <SearchBar inicial={q} ruta="/ordenes" extra={{ estado }} />

      <nav
        aria-label="Filtrar por estado"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip) => {
          const activo = chip.valor === estado;
          return (
            <Link
              key={chip.label}
              href={hrefFiltro(q, chip.valor)}
              replace
              aria-current={activo ? "true" : undefined}
              className={`flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-semibold transition-colors ${
                activo
                  ? "border-ink bg-ink text-white"
                  : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>

      {errorConsulta && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudieron cargar las órdenes: {errorConsulta}
        </p>
      )}

      {!errorConsulta && ordenes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          {q || estado
            ? "No hay órdenes que coincidan con la búsqueda."
            : "Aún no hay órdenes. Crea la primera con “Nueva orden”."}
        </div>
      )}

      <ul className="space-y-3">
        {ordenes.map((orden) => (
          <li key={orden.id}>
            <OrdenCard orden={orden} saldo={saldoDe.get(orden.id) ?? 0} />
          </li>
        ))}
      </ul>

      {ordenes.length === LIMITE && (
        <p className="text-center text-xs text-stone-500">
          Mostrando las {LIMITE} más recientes. Afina la búsqueda para ver otras.
        </p>
      )}

      <Link
        href="/ordenes/nueva"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-accent-600 px-6 text-[15px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(31,30,29,0.45)] transition-colors active:bg-accent-700"
      >
        <Plus className="size-6" aria-hidden />
        Nueva orden
      </Link>
    </section>
  );
}
