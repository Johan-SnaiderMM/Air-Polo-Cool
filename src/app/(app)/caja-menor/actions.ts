"use server";

import { revalidatePath } from "next/cache";
import { autorONull } from "@/lib/autor";
import { esCategoria, hoyBogota } from "@/lib/caja";
import { mensajeDeError } from "@/lib/errores";
import { esUuid } from "@/lib/ordenes";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Acciones de caja que requieren conexión (auditoría y cálculo en el servidor).
 * Registrar gastos, abonos y movimientos NO está aquí: eso pasa por la cola offline
 * (src/app/(app)/sync/actions.ts).
 */
export type AccionCaja = { ok: true; mensaje?: string; id?: string } | { ok: false; error: string };

const MAX_MONTO = 9_999_999_999;

const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`));

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

  if (!esUuid(datos.id)) return { ok: false, error: "Gasto inválido." };
  if (!esFecha(datos.fecha) || datos.fecha > hoyBogota()) {
    return { ok: false, error: "La fecha no puede ser futura." };
  }
  if (!esCategoria(datos.categoria)) return { ok: false, error: "Categoría inválida." };
  if (!Number.isFinite(datos.monto) || datos.monto <= 0 || datos.monto > MAX_MONTO) {
    return { ok: false, error: "Ingresa un monto mayor a 0." };
  }
  if (datos.ordenId !== null && !esUuid(datos.ordenId)) return { ok: false, error: "Orden inválida." };

  const { error } = await supabase.rpc("editar_gasto", {
    p_id: datos.id,
    p_fecha: datos.fecha,
    p_categoria: datos.categoria,
    p_monto: Math.round(datos.monto * 100) / 100,
    p_descripcion: datos.descripcion.trim().slice(0, 300) || null,
    p_orden_id: datos.ordenId,
    p_autor: autorONull(datos.autor),
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Gasto actualizado." };
}

export async function anularGasto(datos: { id: string; motivo: string; autor: string }): Promise<AccionCaja> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (!esUuid(datos.id)) return { ok: false, error: "Gasto inválido." };
  if (datos.motivo.trim().length < 3) return { ok: false, error: "Escribe el motivo de la anulación." };

  const { error } = await supabase.rpc("anular_gasto", {
    p_id: datos.id,
    p_motivo: datos.motivo.trim().slice(0, 300),
    p_autor: autorONull(datos.autor),
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Gasto anulado." };
}
