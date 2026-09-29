import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldAlert, User } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { filtroVehiculos } from "@/lib/consultas";
import { SearchBar } from "@/components/ordenes/search-bar";

export const metadata: Metadata = { title: "Vehículos" };

const LIMITE = 50;

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qCrudo } = await searchParams;
  const q = (qCrudo ?? "").trim();

  const supabase = await createClient();

  let filtro: string | null = null;
  if (q) filtro = await filtroVehiculos(supabase, q);

  let vehiculos: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
    clientes: { nombre: string; telefono: string } | null;
  }[] = [];
  let errorConsulta: string | null = null;

  if (!q || filtro) {
    let consulta = supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo, anio, clientes(nombre, telefono)")
      .order(q ? "placa" : "created_at", { ascending: !!q })
      .limit(LIMITE);
    if (filtro) consulta = consulta.or(filtro);
    const { data, error } = await consulta;
    if (error) errorConsulta = error.message;
    vehiculos = data ?? [];
  }

  return (
    <section className="space-y-4">
      <SearchBar inicial={q} ruta="/vehiculos" placeholder="Placa, cliente o teléfono" />

      <Link
        href="/garantias"
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-sm font-semibold text-ink active:bg-stone-100"
      >
        <ShieldAlert className="size-5" aria-hidden />
        Ver panel de garantías
      </Link>

      {errorConsulta && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudieron cargar los vehículos: {errorConsulta}
        </p>
      )}

      {!errorConsulta && vehiculos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          {q
            ? "No hay vehículos que coincidan."
            : "Aún no hay vehículos. Se registran al crear una orden."}
        </div>
      )}

      <ul className="space-y-3">
        {vehiculos.map((v) => (
          <li key={v.id}>
            <Link
              href={`/vehiculos/${v.id}`}
              className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft active:bg-stone-50"
            >
              <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2.5 py-1 font-mono text-lg font-semibold tracking-wider text-ink">
                {v.placa}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {v.marca} {v.modelo}
                  {v.anio ? ` ${v.anio}` : ""}
                </p>
                <p className="flex items-center gap-1.5 truncate text-sm text-stone-600">
                  <User className="size-4 shrink-0" aria-hidden />
                  {v.clientes?.nombre ?? "Sin cliente"}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-stone-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {vehiculos.length === LIMITE && (
        <p className="text-center text-xs text-stone-500">
          Mostrando {LIMITE}. Afina la búsqueda para ver otros.
        </p>
      )}
    </section>
  );
}
