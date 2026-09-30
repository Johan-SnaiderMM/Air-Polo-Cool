"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { autorONull } from "@/lib/autor";
import { validarItems, VIGENCIAS_DIAS, type ItemCotizacion } from "@/lib/cotizaciones";
import { mensajeDeError } from "@/lib/errores";
import type { DatosVehiculoOrden } from "@/lib/offline/operaciones";
import { asegurarVehiculo } from "@/lib/servidor/operaciones";
import { esUuid, normalizarPlaca, normalizarTelefono } from "@/lib/ordenes";
import type { EstadoCotizacion } from "@/types/database";

export type CotizacionFormState = { error?: string };
export type AccionCotizacion = { ok: true; ordenId?: string } | { ok: false; error: string };

// Las cotizaciones requieren conexión (se emiten desde el escritorio del taller, no en campo).

const ESTADOS_MANUALES: EstadoCotizacion[] = ["borrador", "enviada", "aprobada", "rechazada"];

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

type VehiculoForm =
  | { modo: "existente"; vehiculo: { id: string } }
  | {
      modo: "nuevo";
      datos: {
        cliente_nombre: string;
        cliente_telefono: string;
        placa: string;
        marca: string;
        modelo: string;
        anio: string;
      };
    };

/** Crea o actualiza una cotización con todos sus ítems. */
export async function guardarCotizacion(
  _prev: CotizacionFormState,
  formData: FormData
): Promise<CotizacionFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const cotizacionId = texto(formData, "cotizacion_id");
  const editando = cotizacionId !== "";
  if (editando && !esUuid(cotizacionId)) return { error: "Cotización inválida." };

  // ---- Ítems ----
  let crudos: unknown;
  try {
    crudos = JSON.parse(texto(formData, "items") || "[]");
  } catch {
    return { error: "Los ítems no tienen un formato válido." };
  }
  const val = validarItems(crudos);
  if (!val.ok) return { error: val.error };
  const items: ItemCotizacion[] = val.items;

  const manoObra = Number(texto(formData, "mano_obra") || "0");
  if (!Number.isFinite(manoObra) || manoObra < 0 || manoObra > 9_999_999_999) {
    return { error: "La mano de obra debe ser un valor mayor o igual a 0." };
  }
  if (items.length === 0 && manoObra === 0) {
    return { error: "Agrega al menos un ítem o la mano de obra." };
  }
  const vigencia = Number(texto(formData, "vigencia_dias") || "15");
  if (!(VIGENCIAS_DIAS as readonly number[]).includes(vigencia)) return { error: "Vigencia inválida." };
  const notas = texto(formData, "notas").slice(0, 1000) || null;
  const autor = autorONull(texto(formData, "autor"));

  // ---- Vehículo (solo al crear) ----
  let vehiculoId = "";
  if (!editando) {
    let sel: VehiculoForm;
    try {
      sel = JSON.parse(texto(formData, "vehiculo")) as VehiculoForm;
    } catch {
      return { error: "Selecciona un vehículo o registra uno nuevo." };
    }

    let datos: DatosVehiculoOrden;
    if (sel.modo === "existente" && esUuid(String(sel.vehiculo?.id))) {
      datos = { nuevo: false, id: sel.vehiculo.id };
    } else if (sel.modo === "nuevo") {
      const d = sel.datos;
      const anio = d.anio.trim() === "" ? null : Number(d.anio);
      if (anio !== null && !Number.isInteger(anio)) return { error: "El modelo (año) no es válido." };
      datos = {
        nuevo: true,
        id: randomUUID(),
        cliente_id: randomUUID(),
        cliente_nombre: d.cliente_nombre.trim(),
        cliente_telefono: normalizarTelefono(d.cliente_telefono) ?? "",
        placa: normalizarPlaca(d.placa),
        marca: d.marca.trim(),
        modelo: d.modelo.trim(),
        anio,
      };
    } else {
      return { error: "Selecciona un vehículo o registra uno nuevo." };
    }

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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

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
