"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { autorONull } from "@/lib/autor";
import { filtroVehiculos } from "@/lib/consultas";
import { mensajeDeError } from "@/lib/errores";
import {
  cargarContextoOrden,
  enviarWhatsApp,
  envioAutomaticoActivo,
} from "@/lib/notificaciones";
import { agregarHistorial, armarLineaHistorial } from "@/lib/historial-estado";
import { pertenenciasONull } from "@/lib/offline/operaciones";
import { esEstado, esUuid } from "@/lib/ordenes";
import type { EstadoOrden, Json } from "@/types/database";
import { BUCKET_EVIDENCIAS } from "@/lib/almacenamiento";
import { texto } from "@/lib/formularios";
import { validar } from "@/lib/esquemas/comunes";
import { camposOrdenSchema } from "@/lib/esquemas/orden";
import { mesesMantenimiento } from "@/lib/datos/mapeo";
import { exigirSesion, obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

// La CREACIÓN de órdenes y la subida de fotos pasan por la cola offline
// (src/app/(app)/sync/actions.ts). Aquí quedan la búsqueda, la edición y el borrado
// de fotos, que requieren conexión.

export type VehiculoResultado = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  cliente: string;
};

export type OrdenFormState = { error?: string; ok?: string };
export type SubidaResultado = { ok: true } | { ok: false; error: string };

/**
 * Aviso automático al pasar a Listo / Entregado (opt-in: WHATSAPP_AUTO_ENVIO=true).
 * Un fallo del servidor de WhatsApp nunca revierte el guardado. Devuelve null si no aplica.
 */
async function avisarPorWhatsApp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ordenId: string,
  estadoAnterior: EstadoOrden | undefined,
  estado: EstadoOrden
): Promise<{ ok: true } | { ok: false; error: string } | null> {
  if (estadoAnterior === estado) return null;
  if ((estado !== "listo" && estado !== "entregado") || !envioAutomaticoActivo()) return null;
  const contexto = await cargarContextoOrden(supabase, ordenId);
  if (!contexto) return null;
  const r = await enviarWhatsApp(contexto.telefono, contexto.mensajes[estado]);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ---------------------------------------------------------------------
// Búsqueda de vehículos (selector del formulario)
// ---------------------------------------------------------------------

export async function buscarVehiculos(consulta: string): Promise<VehiculoResultado[]> {
  const q = consulta.trim();
  if (q.length < 2) return [];

  const { supabase, user } = await obtenerSesion();
  if (!user) return [];

  const filtro = await filtroVehiculos(supabase, q);
  if (!filtro) return [];

  const { data } = await supabase
    .from("vehiculos")
    .select("id, placa, marca, modelo, anio, clientes(nombre)")
    .or(filtro)
    .order("placa")
    .limit(8);

  return (data ?? []).map((v) => ({
    id: v.id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    cliente: v.clientes?.nombre ?? "",
  }));
}

// ---------------------------------------------------------------------
// Editar orden
// ---------------------------------------------------------------------

export async function guardarOrden(_prev: OrdenFormState, formData: FormData): Promise<OrdenFormState> {
  const { supabase } = await exigirSesion();

  const ordenId = texto(formData, "orden_id");
  if (!esUuid(ordenId)) return { error: "Orden inválida." };

  // ---- Campos de la orden (mismas reglas que «crear orden» en el teléfono) ----
  const campos = validar(camposOrdenSchema, {
    kilometraje: texto(formData, "kilometraje"),
    mano_obra: texto(formData, "mano_obra"),
    total_cobrado: texto(formData, "total_cobrado"),
    dias_garantia: Number(texto(formData, "dias_garantia") || "0"),
    estado: texto(formData, "estado") || "recibido",
    diagnostico_inicial: texto(formData, "diagnostico_inicial"),
    trabajos_a_realizar: texto(formData, "trabajos_a_realizar"),
  });
  if (!campos.ok) return { error: campos.error };
  const { estado } = campos.valor;

  // Pertenencias (checklist) y próximo mantenimiento preventivo.
  let pertenencias: Json | null = null;
  const crudaPertenencias = texto(formData, "pertenencias");
  if (crudaPertenencias) {
    try {
      const p = pertenenciasONull(JSON.parse(crudaPertenencias));
      pertenencias = p ? (JSON.parse(JSON.stringify(p)) as Json) : null;
    } catch {
      return { error: "Las pertenencias no tienen un formato válido." };
    }
  }
  const mantenimientoMeses = mesesMantenimiento(Number(texto(formData, "mantenimiento_meses") || "0"));

  const { data: previa } = await supabase.from("ordenes_servicio").select("estado").eq("id", ordenId).maybeSingle();

  const { data, error } = await supabase
    .from("ordenes_servicio")
    .update({
      ...campos.valor,
      pertenencias,
      mantenimiento_meses: mantenimientoMeses,
      // La garantía corre desde la entrega: si se revierte el estado, se limpia.
      ...(estado === "entregado" ? {} : { fecha_entrega: null }),
    })
    .eq("id", ordenId)
    .select("id");

  if (error) return { error: mensajeDeError(error) };
  if (!data || data.length === 0) {
    return { error: "No se pudo actualizar la orden (¿existe y tienes permisos?)." };
  }

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${ordenId}`);
  revalidatePath("/garantias");
  revalidatePath("/");

  const aviso = await avisarPorWhatsApp(supabase, ordenId, previa?.estado, estado);
  if (aviso) {
    return {
      ok: aviso.ok
        ? "Cambios guardados. WhatsApp enviado al cliente."
        : `Cambios guardados, pero no se pudo enviar el WhatsApp: ${aviso.error}`,
    };
  }

  return { ok: "Cambios guardados." };
}

// ---------------------------------------------------------------------
// Eliminar evidencia (solo admin por RLS)
// ---------------------------------------------------------------------

export async function eliminarEvidencia(datos: {
  ordenId: string;
  evidenciaId: string;
}): Promise<SubidaResultado> {
  const { ordenId, evidenciaId } = datos;
  if (!esUuid(ordenId) || !esUuid(evidenciaId)) return { ok: false, error: "Datos inválidos." };

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data: fila } = await supabase
    .from("evidencias_fotograficas")
    .select("url_imagen")
    .eq("id", evidenciaId)
    .eq("orden_id", ordenId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("evidencias_fotograficas")
    .delete()
    .eq("id", evidenciaId)
    .eq("orden_id", ordenId)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) {
    // RLS: solo el admin puede borrar; sin permiso, Postgres devuelve 0 filas.
    return { ok: false, error: "No se pudo eliminar. Solo el administrador puede borrar fotos." };
  }

  if (fila?.url_imagen) {
    await supabase.storage.from(BUCKET_EVIDENCIAS).remove([fila.url_imagen]);
  }

  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Eliminar una orden recién recibida (solo admin por RLS)
// ---------------------------------------------------------------------

/**
 * Borra una orden que sigue en «Recibido» y no tiene pagos: sirve para un ingreso creado por error o
 * duplicado. Sus fotos y repuestos se van con ella (los repuestos devuelven el stock). Cualquier otra
 * orden se conserva: si no va a continuar, se marca como cancelada.
 */
export async function eliminarOrden(datos: { ordenId: string }): Promise<SubidaResultado> {
  const { ordenId } = datos;
  if (!esUuid(ordenId)) return { ok: false, error: "Datos inválidos." };

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data: orden } = await supabase.from("ordenes_servicio").select("estado").eq("id", ordenId).maybeSingle();
  if (!orden) return { ok: false, error: "La orden ya no existe." };
  if (orden.estado !== "recibido") {
    return { ok: false, error: "Solo se pueden eliminar órdenes en estado Recibido. Las demás se cancelan." };
  }

  // Un registro de dinero no desaparece con la orden (ni siquiera uno anulado).
  const { count } = await supabase.from("pagos_orden").select("id", { count: "exact", head: true }).eq("orden_id", ordenId);
  if (count) return { ok: false, error: "La orden tiene pagos registrados: no se puede eliminar. Cancélala en su lugar." };

  const { data: fotos } = await supabase.from("evidencias_fotograficas").select("url_imagen").eq("orden_id", ordenId);

  const { data, error } = await supabase.from("ordenes_servicio").delete().eq("id", ordenId).eq("estado", "recibido").select("id");
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) {
    // RLS: solo el admin puede borrar; sin permiso, Postgres devuelve 0 filas.
    return { ok: false, error: "No se pudo eliminar. Solo el administrador puede borrar órdenes." };
  }

  const rutas = (fotos ?? []).map((f) => f.url_imagen);
  if (rutas.length > 0) await supabase.storage.from(BUCKET_EVIDENCIAS).remove(rutas);

  revalidatePath("/ordenes");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Liga (o desliga con `null`) una foto de repuesto retirado / instalado a un repuesto de la orden.
 * Sirve para asignar las fotos anteriores a la fase 5 o corregir una mal asignada.
 */
export async function asignarFotoARepuesto(datos: {
  ordenId: string;
  evidenciaId: string;
  ordenRepuestoId: string | null;
}): Promise<SubidaResultado> {
  const { ordenId, evidenciaId, ordenRepuestoId } = datos;
  if (!esUuid(ordenId) || !esUuid(evidenciaId) || (ordenRepuestoId !== null && !esUuid(ordenRepuestoId))) {
    return { ok: false, error: "Datos inválidos." };
  }

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data, error } = await supabase
    .from("evidencias_fotograficas")
    .update({ orden_repuesto_id: ordenRepuestoId })
    .eq("id", evidenciaId)
    .eq("orden_id", ordenId)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) return { ok: false, error: "No se encontró la foto." };

  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Cambio rápido de estado (desde la tarjeta de la orden)
// ---------------------------------------------------------------------

export type CambioEstadoResultado =
  | { ok: true; aviso?: string }
  | { ok: false; error: string };

/**
 * Cambia SOLO el estado de una orden y deja constancia en su bitácora (líneas al final de `notas`:
 * momento, autor, transición y observación). Al pasar a Listo / Entregado guarda el próximo
 * mantenimiento elegido; si se sale de esos estados, lo limpia. Requiere conexión.
 */
export async function cambiarEstadoOrden(datos: {
  ordenId: string;
  estado: string;
  nota: string;
  mantenimientoMeses: number | null;
  autor: string | null;
}): Promise<CambioEstadoResultado> {
  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  if (!esUuid(datos.ordenId)) return { ok: false, error: "Orden inválida." };
  if (!esEstado(datos.estado)) return { ok: false, error: "Estado inválido." };
  const estado = datos.estado;

  const nota = datos.nota.replace(/\s+/g, " ").trim().slice(0, 200);
  if (estado === "cancelado" && nota.length < 3) {
    return { ok: false, error: "Escribe el motivo de la cancelación." };
  }

  const { data: previa } = await supabase
    .from("ordenes_servicio")
    .select("estado, notas")
    .eq("id", datos.ordenId)
    .maybeSingle();
  if (!previa) return { ok: false, error: "La orden no existe o no tienes permisos." };
  if (previa.estado === estado) return { ok: false, error: "La orden ya está en ese estado." };

  const listoOEntregado = estado === "listo" || estado === "entregado";
  const meses = datos.mantenimientoMeses;
  const mantenimientoMeses = listoOEntregado && (meses === 3 || meses === 6 || meses === 12) ? meses : null;

  const linea = armarLineaHistorial({
    momento: new Date(),
    autor: autorONull(datos.autor),
    de: previa.estado,
    a: estado,
    nota,
  });

  const { data, error } = await supabase
    .from("ordenes_servicio")
    .update({
      estado,
      mantenimiento_meses: mantenimientoMeses,
      notas: agregarHistorial(previa.notas, linea),
      // La garantía corre desde la entrega: si se revierte el estado, se limpia.
      ...(estado === "entregado" ? {} : { fecha_entrega: null }),
    })
    .eq("id", datos.ordenId)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) return { ok: false, error: "No se pudo actualizar la orden." };

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${datos.ordenId}`);
  revalidatePath("/garantias");
  revalidatePath("/cartera");
  revalidatePath("/");

  const aviso = await avisarPorWhatsApp(supabase, datos.ordenId, previa.estado, estado);
  if (!aviso) return { ok: true };
  return {
    ok: true,
    aviso: aviso.ok ? "WhatsApp enviado al cliente." : `No se pudo enviar el WhatsApp: ${aviso.error}`,
  };
}
