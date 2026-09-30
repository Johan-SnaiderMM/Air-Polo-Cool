"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { desgloseLimpio, totalDesglose } from "@/lib/arqueo";
import { autorONull } from "@/lib/autor";
import { esCategoria, hoyBogota } from "@/lib/caja";
import { mensajeDeError } from "@/lib/errores";
import { esUuid } from "@/lib/ordenes";
import type { Json } from "@/types/database";

/**
 * Acciones de caja que requieren conexión (auditoría y cálculo en el servidor).
 * Registrar gastos, abonos y movimientos NO está aquí: eso pasa por la cola offline
 * (src/app/(app)/sync/actions.ts).
 */
export type AccionCaja = { ok: true; mensaje?: string; id?: string } | { ok: false; error: string };

const SESION = { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." } as const;
const MAX_MONTO = 9_999_999_999;

async function contexto() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

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
  const { supabase, user } = await contexto();
  if (!user) return SESION;

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
  const { supabase, user } = await contexto();
  if (!user) return SESION;
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

// ---------------------------------------------------------------------
// Caja: saldo, arqueo y cierre
// ---------------------------------------------------------------------

/** Saldo de caja al cierre de una fecha (lo usa el arqueo para fechas pasadas). */
export async function saldoCajaAl(fecha: string): Promise<{ ok: true; saldo: number } | { ok: false; error: string }> {
  const { supabase, user } = await contexto();
  if (!user) return SESION;
  if (!esFecha(fecha) || fecha > hoyBogota()) return { ok: false, error: "Fecha inválida." };
  const { data, error } = await supabase.rpc("fn_saldo_caja", { p_hasta: fecha });
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, saldo: Number(data ?? 0) };
}

/**
 * Cierra la caja del día: el SERVIDOR calcula el saldo del sistema y compara con el
 * conteo físico. Si hay diferencia se registra un ajuste, de modo que el saldo
 * queda igual al efectivo realmente contado.
 */
export async function cerrarCaja(datos: {
  fecha: string;
  desglose: Record<string, number>;
  notas: string;
  autor: string;
}): Promise<AccionCaja> {
  const { supabase, user } = await contexto();
  if (!user) return SESION;
  if (!esFecha(datos.fecha) || datos.fecha > hoyBogota()) {
    return { ok: false, error: "No se puede cerrar la caja de una fecha futura." };
  }

  const desglose = desgloseLimpio(datos.desglose);
  const conteo = totalDesglose(desglose);

  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_fecha: datos.fecha,
    p_conteo: conteo,
    p_desglose: desglose as Json,
    p_notas: datos.notas.trim().slice(0, 500) || null,
    p_autor: autorONull(datos.autor),
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, id: data?.id, mensaje: `Caja cerrada: ${data?.resultado ?? ""}` };
}

export async function anularCierre(datos: { id: string; motivo: string }): Promise<AccionCaja> {
  const { supabase, user } = await contexto();
  if (!user) return SESION;
  if (!esUuid(datos.id)) return { ok: false, error: "Cierre inválido." };
  if (datos.motivo.trim().length < 3) return { ok: false, error: "Escribe el motivo de la anulación." };
  const { error } = await supabase.rpc("anular_cierre", { p_id: datos.id, p_motivo: datos.motivo.trim().slice(0, 300) });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Cierre anulado." };
}

export async function anularMovimientoCaja(datos: { id: string; motivo: string }): Promise<AccionCaja> {
  const { supabase, user } = await contexto();
  if (!user) return SESION;
  if (!esUuid(datos.id)) return { ok: false, error: "Movimiento inválido." };
  if (datos.motivo.trim().length < 3) return { ok: false, error: "Escribe el motivo de la anulación." };
  const { error } = await supabase.rpc("anular_movimiento_caja", {
    p_id: datos.id,
    p_motivo: datos.motivo.trim().slice(0, 300),
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: "Movimiento anulado." };
}
