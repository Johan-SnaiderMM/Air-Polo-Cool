import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ListaInventario } from "@/components/inventario/lista-inventario";
import type { Tables } from "@/types/database";
import { SearchBar } from "@/components/ordenes/search-bar";

export const metadata: Metadata = { title: "Inventario" };

const LIMITE = 100;

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q: qCrudo, filtro: filtroCrudo } = await searchParams;
  const q = (qCrudo ?? "").trim();
  const critico = filtroCrudo === "critico";

  const supabase = await createClient();

  // Se quitan caracteres con significado especial en .or()/ILIKE de PostgREST.
  const busqueda = q.replace(/[%_,()*\\]/g, " ").trim();
  const filtroTexto = busqueda
    ? `codigo.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`
    : null;

  // Cantidad de ítems críticos (vista v_inventario_reposicion: stock_actual <= stock_minimo).
  const { count: totalCriticos } = await supabase
    .from("v_inventario_reposicion")
    .select("id", { count: "exact", head: true });

  let items: Tables<"inventario">[] = [];
  let errorConsulta: string | null = null;

  // El filtro crítico (stock_actual <= stock_minimo) compara columna contra columna, algo que
  // PostgREST no expresa: se filtra aquí sobre el catálogo (cientos de ítems como mucho) en
  // lugar de enviar cientos de ids en la URL.
  let consulta = supabase
    .from("inventario")
    .select("*")
    .order("nombre", { ascending: true })
    .limit(critico ? 1000 : LIMITE);
  if (filtroTexto) consulta = consulta.or(filtroTexto);
  const { data, error } = await consulta;
  if (error) errorConsulta = error.message;
  items = data ?? [];
  if (critico) {
    items = items.filter((i) => i.stock_actual <= i.stock_minimo).slice(0, LIMITE);
  }

  const pestanas = [
    { label: "Todo", href: q ? `/inventario?q=${encodeURIComponent(q)}` : "/inventario", activa: !critico },
    {
      label: `Stock crítico${totalCriticos ? ` (${totalCriticos})` : ""}`,
      href: `/inventario?filtro=critico${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      activa: critico,
    },
  ];

  return (
    <section className="space-y-4">
      <SearchBar
        inicial={q}
        ruta="/inventario"
        extra={{ filtro: critico ? "critico" : undefined }}
        placeholder="Buscar por código o nombre"
      />

      <nav aria-label="Filtro de inventario" className="grid grid-cols-2 gap-2">
        {pestanas.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            replace
            aria-current={p.activa ? "true" : undefined}
            className={`flex h-12 items-center justify-center rounded-xl border text-sm font-semibold ${
              p.activa
                ? "border-ink bg-ink text-white"
                : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {errorConsulta && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudo cargar el inventario: {errorConsulta}
        </p>
      )}

      <ListaInventario items={items} />

      {items.length === LIMITE && (
        <p className="text-center text-xs text-stone-500">
          Mostrando los primeros {LIMITE}. Afina la búsqueda para ver otros.
        </p>
      )}
    </section>
  );
}
