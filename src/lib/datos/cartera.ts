/** Acceso a datos de la cartera (cuentas por cobrar), agrupada por cliente. */
import { esErrorDeMigracion } from "@/lib/errores";
import type { Views } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type FilaCartera = Views<"v_cartera"> & { orden_id: string };

export type ClienteCartera = {
  nombre: string;
  telefono: string;
  total: number;
  ordenes: FilaCartera[];
};

/** Agrupa por cliente (mismo teléfono = mismo cliente) y ordena de mayor a menor deuda. */
export function agruparCartera(filas: FilaCartera[]): ClienteCartera[] {
  const clientes = new Map<string, ClienteCartera>();
  for (const f of filas) {
    const clave = f.telefono ?? f.cliente ?? f.orden_id;
    const c = clientes.get(clave) ?? { nombre: f.cliente ?? "Cliente", telefono: f.telefono ?? "", total: 0, ordenes: [] };
    c.total += f.saldo ?? 0;
    c.ordenes.push(f);
    clientes.set(clave, c);
  }
  return [...clientes.values()].sort((a, b) => b.total - a.total);
}

export type CargaCartera = {
  clientes: ClienteCartera[];
  /** Órdenes con saldo. */
  totalOrdenes: number;
  total: number;
  error: string | null;
  /** Falta ejecutar la migración de la fase 3 (la vista no existe). */
  migracionPendiente: boolean;
};

export async function cargarCartera(supabase: ClienteServidor): Promise<CargaCartera> {
  const { data, error } = await supabase
    .from("v_cartera")
    .select("*")
    .order("fecha_entrega", { ascending: true, nullsFirst: false })
    .limit(500);

  const filas = (data ?? []).filter((f): f is FilaCartera => !!f.orden_id);
  const clientes = agruparCartera(filas);
  return {
    clientes,
    totalOrdenes: filas.length,
    total: clientes.reduce((s, c) => s + c.total, 0),
    error: error?.message ?? null,
    migracionPendiente: esErrorDeMigracion(error),
  };
}
