"use server";

import { revalidatePath } from "next/cache";
import { validar } from "@/lib/esquemas/comunes";
import { ajustarStockSchema, crearItemSchema, editarItemSchema } from "@/lib/esquemas/inventario";
import { mensajeDeError } from "@/lib/errores";
import { admiteDecimales } from "@/lib/inventario";
import { texto } from "@/lib/formularios";
import { exigirSesion } from "@/utils/supabase/sesion";

export type InventarioFormState = { error?: string; ok?: string };

/** Los campos de un formulario de inventario, como texto (las reglas están en esquemas/inventario.ts). */
function campos(formData: FormData, nombres: string[]): Record<string, string> {
  return Object.fromEntries(nombres.map((n) => [n, texto(formData, n)]));
}

// ---------------------------------------------------------------------
// Nuevo repuesto / insumo
// ---------------------------------------------------------------------

export async function crearItem(
  _prev: InventarioFormState,
  formData: FormData
): Promise<InventarioFormState> {
  const { supabase } = await exigirSesion();

  const item = validar(
    crearItemSchema,
    campos(formData, ["codigo", "nombre", "tipo_unidad", "stock_actual", "stock_minimo", "costo_compra", "precio_venta", "descripcion"])
  );
  if (!item.ok) return { error: item.error };

  const { error } = await supabase.from("inventario").insert(item.valor);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un ítem con el código "${item.valor.codigo}".` };
    }
    return { error: mensajeDeError(error) };
  }

  revalidatePath("/inventario");
  return { ok: "Ítem registrado." };
}

// ---------------------------------------------------------------------
// Ajuste rápido de existencias (compra / reposición)
// ---------------------------------------------------------------------

const MAX_REINTENTOS = 3;

export async function ajustarStock(
  _prev: InventarioFormState,
  formData: FormData
): Promise<InventarioFormState> {
  const { supabase } = await exigirSesion();

  const ajuste = validar(ajustarStockSchema, campos(formData, ["inventario_id", "cantidad", "costo_compra"]));
  if (!ajuste.ok) return { error: ajuste.error };
  const { inventario_id: id, cantidad, costo_compra: costoNuevo } = ajuste.valor;

  // Lectura + escritura condicionada al stock leído (concurrencia optimista):
  // si otra orden descontó stock entre medias, se relee y se reintenta,
  // así una reposición nunca pisa un descuento del trigger.
  for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
    const { data: item, error: errLectura } = await supabase
      .from("inventario")
      .select("stock_actual, tipo_unidad")
      .eq("id", id)
      .maybeSingle();

    if (errLectura) return { error: mensajeDeError(errLectura) };
    if (!item) return { error: "El ítem ya no existe." };
    if (!admiteDecimales(item.tipo_unidad) && !Number.isInteger(cantidad)) {
      return { error: "Este ítem se maneja por unidades enteras." };
    }

    const nuevoStock = Math.round((item.stock_actual + cantidad) * 1000) / 1000;
    const { data: actualizado, error } = await supabase
      .from("inventario")
      .update({
        stock_actual: nuevoStock,
        ...(costoNuevo !== null ? { costo_compra: costoNuevo } : {}),
      })
      .eq("id", id)
      .eq("stock_actual", item.stock_actual)
      .select("id");

    if (error) return { error: mensajeDeError(error) };
    if (actualizado && actualizado.length > 0) {
      revalidatePath("/inventario");
      return { ok: "Existencias actualizadas." };
    }
  }

  return { error: "El inventario cambió mientras se guardaba. Intenta de nuevo." };
}

// ---------------------------------------------------------------------
// Editar ítem (datos maestros; el stock solo cambia con reposición o consumo)
// ---------------------------------------------------------------------

export async function editarItem(
  _prev: InventarioFormState,
  formData: FormData
): Promise<InventarioFormState> {
  const { supabase } = await exigirSesion();

  const item = validar(
    editarItemSchema,
    campos(formData, ["inventario_id", "codigo", "nombre", "stock_minimo", "costo_compra", "precio_venta", "descripcion"])
  );
  if (!item.ok) return { error: item.error };
  const { inventario_id: id, ...datos } = item.valor;

  const { data: actual } = await supabase
    .from("inventario")
    .select("tipo_unidad")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "El ítem ya no existe." };
  if (!admiteDecimales(actual.tipo_unidad) && !Number.isInteger(datos.stock_minimo)) {
    return { error: "Las unidades físicas deben ser cantidades enteras." };
  }

  const { data, error } = await supabase.from("inventario").update(datos).eq("id", id).select("id");

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe otro ítem con el código "${datos.codigo}".` };
    }
    return { error: mensajeDeError(error) };
  }
  if (!data || data.length === 0) return { error: "No se pudo actualizar el ítem." };

  revalidatePath("/inventario");
  return { ok: "Ítem actualizado." };
}
