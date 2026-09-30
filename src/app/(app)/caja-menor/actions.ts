"use server";

import { revalidatePath } from "next/cache";
import { validar } from "@/lib/esquemas/comunes";
import { anularGastoSchema, editarGastoSchema } from "@/lib/esquemas/gasto";
import { mensajeDeError } from "@/lib/errores";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Acciones de caja que requieren conexión (auditoría y cálculo en el servidor).
 * Registrar gastos, abonos y movimientos NO está aquí: eso pasa por la cola offline
 * (src/app/(app)/sync/actions.ts). Las reglas de cada dato están en src/lib/esquemas/gasto.ts.
 */
export type AccionCaja = { ok: true; mensaje?: string; id?: string } | { ok: false; error: string };

function refrescar() {
  revalidatePath("/caja-menor");
  revalidatePath("/");
}

// ---------------------------------------------------------------------
// Gastos: editar (con historial) y anular (con motivo)
// ---------------------------------------------------------------------

export async function editarGasto(datos: {
  id: string;
  fecha: string;
  categoria: string;
  monto: number;
  descripcion: string;
  ordenId: string | null;
  autor: string;
}): Promise<AccionCaja> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const g = validar(editarGastoSchema, datos);
  if (!g.ok) return { ok: false, error: g.error };

  const { error } = await supabase.rpc("editar_gasto", {
    p_id: g.valor.id,
    p_fecha: g.valor.fecha,
    p_categoria: g.valor.categoria,
    p_monto: g.valor.monto,
    p_descripcion: g.valor.descripcion,
    p_orden_id: g.valor.ordenId,
    p_autor: g.valor.autor,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Gasto actualizado." };
}

export async function anularGasto(datos: { id: string; motivo: string; autor: string }): Promise<AccionCaja> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const g = validar(anularGastoSchema, datos);
  if (!g.ok) return { ok: false, error: g.error };

  const { error } = await supabase.rpc("anular_gasto", {
    p_id: g.valor.id,
    p_motivo: g.valor.motivo,
    p_autor: g.valor.autor,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Gasto anulado." };
}
