/** Acceso a datos de cotizaciones (lista, detalle, edición y vista imprimible). */
import { esErrorDeMigracion } from "@/lib/errores";
import type { EstadoCotizacion } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------

async function consultarLista(supabase: ClienteServidor, estado: EstadoCotizacion | undefined, limite: number) {
  let consulta = supabase
    .from("cotizaciones")
    .select("id, estado, fecha, vigencia_dias, vehiculos(placa, marca, modelo, anio, clientes(nombre))")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (estado) consulta = consulta.eq("estado", estado);
  return consulta;
}

export type CotizacionEnLista = NonNullable<Awaited<ReturnType<typeof consultarLista>>["data"]>[number];

export type CargaCotizaciones = {
  cotizaciones: CotizacionEnLista[];
  /** Total de cada cotización (id → total), de la vista v_cotizacion_totales. */
  totalDe: Map<string, number>;
  error: string | null;
  /** Falta ejecutar la migración de la fase 4. */
  migracionPendiente: boolean;
};

export async function listarCotizaciones(
  supabase: ClienteServidor,
  { estado, limite }: { estado?: EstadoCotizacion; limite: number }
): Promise<CargaCotizaciones> {
  const [lista, totales] = await Promise.all([
    consultarLista(supabase, estado, limite),
    supabase.from("v_cotizacion_totales").select("cotizacion_id, total").limit(500),
  ]);
  return {
    cotizaciones: lista.data ?? [],
    totalDe: new Map((totales.data ?? []).flatMap((t) => (t.cotizacion_id ? [[t.cotizacion_id, t.total ?? 0] as const] : []))),
    error: lista.error?.message ?? null,
    migracionPendiente: esErrorDeMigracion(lista.error),
  };
}

// ---------------------------------------------------------------------
// Una cotización con sus ítems
// ---------------------------------------------------------------------

async function consultarCotizacion(supabase: ClienteServidor, id: string) {
  const { data } = await supabase
    .from("cotizaciones")
    .select("*, vehiculos(placa, marca, modelo, anio, clientes(nombre, telefono))")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type Cotizacion = NonNullable<Awaited<ReturnType<typeof consultarCotizacion>>>;

/** La cotización y sus ítems (en el orden en que se cargaron), o null si no existe. */
export async function cargarCotizacion(
  supabase: ClienteServidor,
  id: string
): Promise<{ cotizacion: Cotizacion; items: NonNullable<Awaited<ReturnType<typeof consultarItems>>> } | null> {
  const [cotizacion, items] = await Promise.all([consultarCotizacion(supabase, id), consultarItems(supabase, id)]);
  return cotizacion ? { cotizacion, items } : null;
}

async function consultarItems(supabase: ClienteServidor, id: string) {
  const { data } = await supabase.from("cotizacion_items").select("*").eq("cotizacion_id", id).order("created_at");
  return data ?? [];
}
