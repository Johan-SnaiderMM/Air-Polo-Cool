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
import { OPCIONES_GARANTIA, esEstado, esUuid } from "@/lib/ordenes";
import type { EstadoOrden, Json } from "@/types/database";
import { BUCKET_EVIDENCIAS } from "@/lib/almacenamiento";
import { numeroOpcional, texto } from "@/lib/formularios";
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

  // ---- Campos de la orden ----
  const kilometraje = numeroOpcional(texto(formData, "kilometraje"));
  if (
    kilometraje !== null &&
    (Number.isNaN(kilometraje) || kilometraje < 0 || !Number.isInteger(kilometraje))
  ) {
    return { error: "El kilometraje debe ser un número entero mayor o igual a 0." };
  }

  const manoObra = numeroOpcional(texto(formData, "mano_obra")) ?? 0;
  const totalCobrado = numeroOpcional(texto(formData, "total_cobrado")) ?? 0;
  if (Number.isNaN(manoObra) || manoObra < 0) {
    return { error: "La mano de obra debe ser un valor mayor o igual a 0." };
  }
  if (Number.isNaN(totalCobrado) || totalCobrado < 0) {
    return { error: "El total cobrado debe ser un valor mayor o igual a 0." };
  }

  const diasGarantia = Number(texto(formData, "dias_garantia") || "0");
  if (!OPCIONES_GARANTIA.some((o) => o.dias === diasGarantia)) {
    return { error: "Selecciona un plazo de garantía válido." };
  }

  const estado = texto(formData, "estado") || "recibido";
  if (!esEstado(estado)) return { error: "Estado inválido." };

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
  const meses = Number(texto(formData, "mantenimiento_meses") || "0");
  const mantenimientoMeses = meses === 3 || meses === 6 || meses === 12 ? meses : null;

  const { data: previa } = await supabase.from("ordenes_servicio").select("estado").eq("id", ordenId).maybeSingle();

  const { data, error } = await supabase
    .from("ordenes_servicio")
    .update({
      kilometraje,
      diagnostico_inicial: texto(formData, "diagnostico_inicial") || null,
      trabajos_a_realizar: texto(formData, "trabajos_a_realizar") || null,
      mano_obra: manoObra,
      total_cobrado: totalCobrado,
      dias_garantia: diasGarantia,
      estado,
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
