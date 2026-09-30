"use server";

import { revalidatePath } from "next/cache";
import { mensajeDeError } from "@/lib/errores";
import { admiteDecimales, esTipoUnidad } from "@/lib/inventario";
import { numeroOpcional, texto } from "@/lib/formularios";
import { exigirSesion } from "@/utils/supabase/sesion";

export type InventarioFormState = { error?: string; ok?: string };

const noNegativo = (n: number | null) => n !== null && !Number.isNaN(n) && n >= 0;

// ---------------------------------------------------------------------
// Nuevo repuesto / insumo
// ---------------------------------------------------------------------

export async function crearItem(
  _prev: InventarioFormState,
  formData: FormData
): Promise<InventarioFormState> {
  const { supabase } = await exigirSesion();

  const codigo = texto(formData, "codigo");
  const nombre = texto(formData, "nombre");
  const tipoUnidad = texto(formData, "tipo_unidad") || "unidad";

  if (!codigo) return { error: "Ingresa el código del ítem." };
  if (!nombre) return { error: "Ingresa el nombre del ítem." };
  if (!esTipoUnidad(tipoUnidad)) return { error: "Unidad de medida inválida." };

  const stockActual = numeroOpcional(texto(formData, "stock_actual")) ?? 0;
  const stockMinimo = numeroOpcional(texto(formData, "stock_minimo")) ?? 0;
  const costoCompra = numeroOpcional(texto(formData, "costo_compra")) ?? 0;
  const precioVenta = numeroOpcional(texto(formData, "precio_venta")) ?? 0;

  if (!noNegativo(stockActual) || !noNegativo(stockMinimo)) {
    return { error: "El stock debe ser un número mayor o igual a 0." };
  }
  if (!noNegativo(costoCompra) || !noNegativo(precioVenta)) {
    return { error: "Los precios deben ser valores mayores o iguales a 0." };
  }
  if (
    !admiteDecimales(tipoUnidad) &&
    (!Number.isInteger(stockActual) || !Number.isInteger(stockMinimo))
  ) {
    return { error: "Las unidades físicas deben ser cantidades enteras." };
  }

  const { error } = await supabase.from("inventario").insert({
    codigo,
    nombre,
    descripcion: texto(formData, "descripcion") || null,
    tipo_unidad: tipoUnidad,
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    costo_compra: costoCompra,
    precio_venta: precioVenta,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un ítem con el código "${codigo}".` };
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

  const id = texto(formData, "inventario_id");
  const cantidad = numeroOpcional(texto(formData, "cantidad"));
  const costoNuevo = numeroOpcional(texto(formData, "costo_compra"));

  if (!id) return { error: "Ítem inválido." };
  if (cantidad === null || Number.isNaN(cantidad) || cantidad <= 0) {
    return { error: "Ingresa una cantidad mayor a 0." };
  }
  if (costoNuevo !== null && !noNegativo(costoNuevo)) {
    return { error: "El costo de compra debe ser mayor o igual a 0." };
  }

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

  const id = texto(formData, "inventario_id");
  const codigo = texto(formData, "codigo");
  const nombre = texto(formData, "nombre");

  if (!id) return { error: "Ítem inválido." };
  if (!codigo) return { error: "Ingresa el código del ítem." };
  if (!nombre) return { error: "Ingresa el nombre del ítem." };

  const stockMinimo = numeroOpcional(texto(formData, "stock_minimo")) ?? 0;
  const costoCompra = numeroOpcional(texto(formData, "costo_compra")) ?? 0;
  const precioVenta = numeroOpcional(texto(formData, "precio_venta")) ?? 0;

  if (!noNegativo(stockMinimo)) {
    return { error: "El stock mínimo debe ser un número mayor o igual a 0." };
  }
  if (!noNegativo(costoCompra) || !noNegativo(precioVenta)) {
    return { error: "Los precios deben ser valores mayores o iguales a 0." };
  }

  const { data: actual } = await supabase
    .from("inventario")
    .select("tipo_unidad")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "El ítem ya no existe." };
  if (!admiteDecimales(actual.tipo_unidad) && !Number.isInteger(stockMinimo)) {
    return { error: "Las unidades físicas deben ser cantidades enteras." };
  }

  const { data, error } = await supabase
    .from("inventario")
    .update({
      codigo,
      nombre,
      descripcion: texto(formData, "descripcion") || null,
      stock_minimo: stockMinimo,
      costo_compra: costoCompra,
      precio_venta: precioVenta,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe otro ítem con el código "${codigo}".` };
    }
    return { error: mensajeDeError(error) };
  }
  if (!data || data.length === 0) return { error: "No se pudo actualizar el ítem." };

  revalidatePath("/inventario");
  return { ok: "Ítem actualizado." };
}
