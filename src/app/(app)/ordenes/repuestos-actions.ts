"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { mensajeDeError } from "@/lib/errores";
import { admiteDecimales, redondearDinero } from "@/lib/inventario";
import { esUuid } from "@/lib/ordenes";
import type { TipoUnidad } from "@/types/database";

export type AccionResultado = { ok: true; mensaje?: string } | { ok: false; error: string };

export type ItemBuscado = {
  id: string;
  codigo: string;
  nombre: string;
  tipo_unidad: TipoUnidad;
  stock_actual: number;
  precio_venta: number;
  costo_compra: number;
};

const SESION_EXPIRADA: AccionResultado = {
  ok: false,
  error: "Tu sesión expiró. Vuelve a ingresar.",
};

function refrescar(ordenId: string) {
  revalidatePath(`/ordenes/${ordenId}`);
  revalidatePath("/ordenes");
  revalidatePath("/inventario"); // el trigger movió stock
}

// ---------------------------------------------------------------------
// Buscador de ítems de inventario
// ---------------------------------------------------------------------

export async function buscarInventario(consulta: string): Promise<ItemBuscado[]> {
  const q = consulta.replace(/[%_,()*\\]/g, " ").trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("inventario")
    .select("id, codigo, nombre, tipo_unidad, stock_actual, precio_venta, costo_compra")
    .or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%`)
    .order("nombre")
    .limit(8);

  return data ?? [];
}

// ---------------------------------------------------------------------
// Agregar repuesto a la orden
// ---------------------------------------------------------------------

/**
 * El descuento de stock y el snapshot de costo/precio los hace el trigger
 * trg_orden_repuestos_stock en la misma transacción del INSERT.
 */
export async function agregarRepuesto(datos: {
  ordenId: string;
  inventarioId: string;
  cantidad: number;
}): Promise<AccionResultado> {
  const { ordenId, inventarioId, cantidad } = datos;

  if (!esUuid(ordenId) || !esUuid(inventarioId)) {
    return { ok: false, error: "Datos inválidos." };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, error: "Ingresa una cantidad mayor a 0." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return SESION_EXPIRADA;

  const { data: item } = await supabase
    .from("inventario")
    .select("tipo_unidad, nombre")
    .eq("id", inventarioId)
    .maybeSingle();
  if (!item) return { ok: false, error: "El ítem de inventario no existe." };

  if (!admiteDecimales(item.tipo_unidad) && !Number.isInteger(cantidad)) {
    return { ok: false, error: `"${item.nombre}" se maneja por unidades enteras.` };
  }

  const { error } = await supabase.from("orden_repuestos").insert({
    orden_id: ordenId,
    inventario_id: inventarioId,
    cantidad_usada: Math.round(cantidad * 1000) / 1000,
  });

  if (error) return { ok: false, error: mensajeDeError(error) };

  refrescar(ordenId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Quitar repuesto de la orden (el trigger devuelve el stock)
// ---------------------------------------------------------------------

export async function eliminarRepuesto(datos: {
  ordenId: string;
  lineaId: string;
}): Promise<AccionResultado> {
  const { ordenId, lineaId } = datos;
  if (!esUuid(ordenId) || !esUuid(lineaId)) {
    return { ok: false, error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return SESION_EXPIRADA;

  const { data, error } = await supabase
    .from("orden_repuestos")
    .delete()
    .eq("id", lineaId)
    .eq("orden_id", ordenId)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) {
    // RLS: solo el admin puede borrar; sin permiso, Postgres devuelve 0 filas.
    return {
      ok: false,
      error: "No se pudo quitar el repuesto. Solo el administrador puede eliminar líneas.",
    };
  }

  refrescar(ordenId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Recalcular total_cobrado = mano de obra + repuestos (a precio de venta)
// ---------------------------------------------------------------------

export async function recalcularTotal(ordenId: string): Promise<AccionResultado> {
  if (!esUuid(ordenId)) return { ok: false, error: "Orden inválida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return SESION_EXPIRADA;

  const [{ data: orden, error: errOrden }, { data: lineas, error: errLineas }] =
    await Promise.all([
      supabase.from("ordenes_servicio").select("mano_obra").eq("id", ordenId).maybeSingle(),
      supabase
        .from("orden_repuestos")
        .select("cantidad_usada, precio_unitario")
        .eq("orden_id", ordenId),
    ]);

  if (errOrden) return { ok: false, error: mensajeDeError(errOrden) };
  if (errLineas) return { ok: false, error: mensajeDeError(errLineas) };
  if (!orden) return { ok: false, error: "La orden no existe." };

  const repuestos = (lineas ?? []).reduce(
    (suma, l) => suma + l.cantidad_usada * l.precio_unitario,
    0
  );
  const total = redondearDinero(orden.mano_obra + repuestos);

  const { data: actualizada, error } = await supabase
    .from("ordenes_servicio")
    .update({ total_cobrado: total })
    .eq("id", ordenId)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!actualizada || actualizada.length === 0) {
    return { ok: false, error: "No se pudo actualizar el total (¿permisos?)." };
  }

  refrescar(ordenId);
  return { ok: true, mensaje: "Total actualizado." };
}
