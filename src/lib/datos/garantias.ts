/** Acceso a datos del panel de garantías y mantenimientos preventivos. */
import type { SemaforoGarantia, Views } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type Filtro = SemaforoGarantia | "todas" | "mantenimiento";

/** Una garantía con su orden y semáforo (las filas incompletas de la vista se descartan). */
export type Garantia = Views<"v_garantias"> & { orden_id: string; semaforo: SemaforoGarantia };

export type Mantenimiento = Views<"v_mantenimientos">;

const esGarantia = (g: Views<"v_garantias">): g is Garantia => !!g.orden_id && !!g.semaforo;

export function contarGarantias(garantias: Garantia[], mantenimientos: Mantenimiento[]): Record<Filtro, number> {
  const cuenta = (s: SemaforoGarantia) => garantias.filter((g) => g.semaforo === s).length;
  return {
    amarillo: cuenta("amarillo"),
    verde: cuenta("verde"),
    rojo: cuenta("rojo"),
    todas: garantias.length,
    mantenimiento: mantenimientos.filter((m) => m.estado_mantenimiento !== "lejano").length,
  };
}

/**
 * Garantías a mostrar para un filtro. La vista llega ordenada por fecha de vencimiento
 * (las que vencen antes primero); las vencidas se invierten para ver las más recientes arriba.
 */
export function garantiasVisibles(garantias: Garantia[], filtro: Filtro): Garantia[] {
  const visibles = filtro === "todas" || filtro === "mantenimiento" ? garantias : garantias.filter((g) => g.semaforo === filtro);
  return filtro === "rojo" ? [...visibles].reverse() : visibles;
}

export const LIMITE_GARANTIAS = 500;

export type CargaGarantias = {
  garantias: Garantia[];
  mantenimientos: Mantenimiento[];
  error: string | null;
};

/**
 * Las dos consultas son independientes y van a la vez. Los mantenimientos son de la fase 4: si
 * esa migración aún no está, la lista queda vacía sin romper el panel.
 */
export async function cargarGarantias(supabase: ClienteServidor): Promise<CargaGarantias> {
  const [garantias, mantenimientos] = await Promise.all([
    supabase.from("v_garantias").select("*").order("fecha_fin_garantia", { ascending: true }).limit(LIMITE_GARANTIAS),
    supabase.from("v_mantenimientos").select("*").order("proximo_mantenimiento", { ascending: true }).limit(300),
  ]);
  return {
    garantias: (garantias.data ?? []).filter(esGarantia),
    mantenimientos: mantenimientos.data ?? [],
    error: garantias.error?.message ?? null,
  };
}
