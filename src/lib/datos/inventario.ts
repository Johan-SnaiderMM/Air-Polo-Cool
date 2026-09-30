/** Acceso a datos del inventario (catálogo de repuestos e insumos). */
import { filtroCatalogo } from "@/lib/consultas";
import type { Tables } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type ItemInventario = Tables<"inventario">;

/** Ítems en o por debajo de su stock mínimo. */
export const esCritico = (i: Pick<ItemInventario, "stock_actual" | "stock_minimo">) => i.stock_actual <= i.stock_minimo;

export type CargaInventario = {
  items: ItemInventario[];
  /** Cuántos ítems están en stock crítico (vista v_inventario_reposicion), sin importar la búsqueda. */
  totalCriticos: number;
  error: string | null;
};

/**
 * El filtro crítico (stock_actual <= stock_minimo) compara columna contra columna, algo que
 * PostgREST no expresa: se filtra aquí sobre el catálogo (cientos de ítems como mucho) en lugar
 * de enviar cientos de ids en la URL. El conteo de críticos va en paralelo con el listado.
 */
export async function listarInventario(
  supabase: ClienteServidor,
  { q, critico, limite }: { q: string; critico: boolean; limite: number }
): Promise<CargaInventario> {
  const filtro = filtroCatalogo(q);
  let consulta = supabase
    .from("inventario")
    .select("*")
    .order("nombre", { ascending: true })
    .limit(critico ? 1000 : limite);
  if (filtro) consulta = consulta.or(filtro);

  const [criticos, lista] = await Promise.all([
    supabase.from("v_inventario_reposicion").select("id", { count: "exact", head: true }),
    consulta,
  ]);

  let items = lista.data ?? [];
  if (critico) items = items.filter(esCritico).slice(0, limite);
  return { items, totalCriticos: criticos.count ?? 0, error: lista.error?.message ?? null };
}
