"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { autorONull } from "@/lib/autor";
import { validar } from "@/lib/esquemas/comunes";
import { cotizacionFormSchema, seleccionVehiculoSchema } from "@/lib/esquemas/cotizacion";
import { mensajeDeError } from "@/lib/errores";
import type { DatosVehiculoOrden } from "@/lib/offline/operaciones";
import { asegurarVehiculo } from "@/lib/servidor/operaciones";
import { esUuid } from "@/lib/ordenes";
import type { EstadoCotizacion } from "@/types/database";
import { jsonODescartar, texto } from "@/lib/formularios";
import { exigirSesion, obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

export type CotizacionFormState = { error?: string };
export type AccionCotizacion = { ok: true; ordenId?: string } | { ok: false; error: string };

// Las cotizaciones requieren conexión (se emiten desde el escritorio del taller, no en campo).

const ESTADOS_MANUALES: EstadoCotizacion[] = ["borrador", "enviada", "aprobada", "rechazada"];

/** Crea o actualiza una cotización con todos sus ítems. */
export async function guardarCotizacion(
  _prev: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  const { supabase } = await exigirSesion();

  const cotizacionId = texto(formData, "cotizacion_id");
  const editando = cotizacionId !== "";
  if (editando && !esUuid(cotizacionId)) return { error: "Cotización inválida." };

  // ---- Campos e ítems (reglas en src/lib/esquemas/cotizacion.ts) ----
  const form = validar(cotizacionFormSchema, {
    items: jsonODescartar(texto(formData, "items") || "[]"),
    mano_obra: texto(formData, "mano_obra"),
    vigencia_dias: texto(formData, "vigencia_dias"),
    notas: texto(formData, "notas"),
    autor: texto(formData, "autor"),
  });
  if (!form.ok) return { error: form.error };
  const { items, mano_obra: manoObra, vigencia_dias: vigencia, notas, autor } = form.valor;

  // ---- Vehículo (solo al crear) ----
  let vehiculoId = "";
  if (!editando) {
    const sel = validar(seleccionVehiculoSchema, jsonODescartar(texto(formData, "vehiculo")));
    if (!sel.ok) return { error: sel.error };

    // Los ids del vehículo y cliente nuevos se generan aquí; asegurarVehiculo revalida y es idempotente.
    const datos: DatosVehiculoOrden = sel.valor.nuevo
      ? { ...sel.valor, id: randomUUID(), cliente_id: randomUUID() }
      : sel.valor;

    const r = await asegurarVehiculo(supabase, datos);
    if (!r.ok) return { error: r.res.ok ? "No se pudo registrar el vehículo." : r.res.error };
    vehiculoId = r.id;
  }

  // ---- Cotización ----
  let id = cotizacionId;
  if (editando) {
    const { data: actual } = await supabase.from("cotizaciones").select("estado").eq("id", id).maybeSingle();
    if (!actual) return { error: "La cotización no existe." };
    if (actual.estado === "convertida") return { error: "La cotización ya fue convertida en orden y no se puede editar." };

    const { error } = await supabase
      .from("cotizaciones")
      .update({ mano_obra: manoObra, vigencia_dias: vigencia, notas })
      .eq("id", id);
    if (error) return { error: mensajeDeError(error) };
  } else {
    const { data, error } = await supabase
      .from("cotizaciones")
      .insert({ vehiculo_id: vehiculoId, mano_obra: manoObra, vigencia_dias: vigencia, notas, autor })
      .select("id")
      .single();
    if (error || !data) return { error: mensajeDeError(error ?? { message: "No se pudo crear la cotización." }) };
    id = data.id;
  }

  // ---- Ítems: se reemplazan; si el nuevo insert falla, se restauran los anteriores ----
  const { data: anteriores } = editando
    ? await supabase.from("cotizacion_items").select("*").eq("cotizacion_id", id)
    : { data: [] };

  if (editando) {
    const { error } = await supabase.from("cotizacion_items").delete().eq("cotizacion_id", id);
    if (error) return { error: mensajeDeError(error) };
  }

  if (items.length > 0) {
    const { error } = await supabase
      .from("cotizacion_items")
      .insert(items.map((i) => ({ ...i, cotizacion_id: id })));
    if (error) {
      if (editando && anteriores && anteriores.length > 0) {
        await supabase.from("cotizacion_items").insert(anteriores);
      } else if (!editando) {
        await supabase.from("cotizaciones").delete().eq("id", id);
      }
      return { error: mensajeDeError(error) };
    }
  }

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${id}`);
  redirect(`/cotizaciones/${id}`);
}

/** Cambia el estado manual: enviada / aprobada / rechazada / borrador. */
export async function cambiarEstadoCotizacion(datos: {
  id: string;
  estado: EstadoCotizacion;
}): Promise<AccionCotizacion> {
  if (!esUuid(datos.id) || !ESTADOS_MANUALES.includes(datos.estado)) return { ok: false, error: "Datos inválidos." };
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data: actual } = await supabase.from("cotizaciones").select("estado").eq("id", datos.id).maybeSingle();
  if (!actual) return { ok: false, error: "La cotización no existe." };
  if (actual.estado === "convertida") {
    return { ok: false, error: "La cotización ya fue convertida en orden." };
  }

  const { error } = await supabase.from("cotizaciones").update({ estado: datos.estado }).eq("id", datos.id);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${datos.id}`);
  return { ok: true };
}

/** Convierte la cotización en una orden de trabajo (atómico, en la base de datos). */
export async function convertirCotizacion(datos: { id: string; autor: string }): Promise<AccionCotizacion> {
  if (!esUuid(datos.id)) return { ok: false, error: "Cotización inválida." };
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data, error } = await supabase.rpc("convertir_cotizacion", {
    p_id: datos.id,
    p_autor: autorONull(datos.autor),
  });
  if (error || !data) return { ok: false, error: mensajeDeError(error ?? { message: "No se pudo convertir." }) };

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${datos.id}`);
  revalidatePath("/ordenes");
  revalidatePath("/");
  return { ok: true, ordenId: data };
}
