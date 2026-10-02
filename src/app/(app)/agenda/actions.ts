"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { instanteBogota, type CitaDeVehiculo } from "@/lib/agenda";
import { citasDelVehiculo as consultarCitasDelVehiculo } from "@/lib/datos/agenda";
import { citaFormSchema } from "@/lib/esquemas/cita";
import { validar } from "@/lib/esquemas/comunes";
import { seleccionVehiculoSchema } from "@/lib/esquemas/cotizacion";
import { mensajeDeError } from "@/lib/errores";
import { jsonODescartar, texto } from "@/lib/formularios";
import type { DatosVehiculoOrden } from "@/lib/offline/operaciones";
import { esUuid } from "@/lib/ordenes";
import { asegurarVehiculo } from "@/lib/servidor/operaciones";
import { exigirSesion, obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Acciones de la agenda. Requieren conexión (se agenda desde el mostrador o el escritorio, no en
 * campo). Las reglas de cada dato están en src/lib/esquemas/cita.ts.
 */
export type CitaFormState = { error?: string; ok?: boolean };
export type AccionCita = { ok: true } | { ok: false; error: string };

function refrescar() {
  revalidatePath("/agenda");
  revalidatePath("/");
}

/**
 * Crea una cita (con vehículo existente o nuevo) o reprograma una existente. Al crear, el vehículo
 * llega como lo arma el selector: existente (solo su id) o nuevo con los datos básicos del cliente y
 * el vehículo, que se dan de alta con las mismas reglas que al crear una orden.
 */
export async function guardarCita(_prev: CitaFormState, formData: FormData): Promise<CitaFormState> {
  const { supabase } = await exigirSesion();

  const citaId = texto(formData, "cita_id");
  const editando = citaId !== "";
  if (editando && !esUuid(citaId)) return { error: "Cita inválida." };

  const form = validar(citaFormSchema, {
    fecha: texto(formData, "fecha"),
    hora: texto(formData, "hora"),
    tipo: texto(formData, "tipo"),
    notas: texto(formData, "notas"),
    autor: texto(formData, "autor"),
  });
  if (!form.ok) return { error: form.error };
  const { fecha, hora, tipo, notas, autor } = form.valor;
  const fechaHora = instanteBogota(fecha, hora);

  // ---- Reprogramar ----
  if (editando) {
    const { data: actual } = await supabase.from("citas").select("estado, fecha_hora").eq("id", citaId).maybeSingle();
    if (!actual) return { error: "La cita ya no existe." };
    if (actual.estado !== "pendiente") return { error: "Solo se pueden editar citas pendientes." };

    // Si cambia el momento, el recordatorio anterior ya no aplica: se vuelve a poder avisar.
    const cambioMomento = new Date(actual.fecha_hora).getTime() !== new Date(fechaHora).getTime();
    const { data, error } = await supabase
      .from("citas")
      .update({ fecha_hora: fechaHora, tipo, notas, ...(cambioMomento ? { recordatorio_enviado_at: null } : {}) })
      .eq("id", citaId)
      .eq("estado", "pendiente")
      .select("id");
    if (error) return { error: mensajeDeError(error) };
    if (!data || data.length === 0) return { error: "No se pudo guardar la cita." };

    refrescar();
    return { ok: true };
  }

  // ---- Crear: vehículo ----
  const sel = validar(seleccionVehiculoSchema, jsonODescartar(texto(formData, "vehiculo")));
  if (!sel.ok) return { error: sel.error };

  // Los ids del vehículo y cliente nuevos se generan aquí; asegurarVehiculo revalida y es idempotente.
  const datos: DatosVehiculoOrden = sel.valor.nuevo
    ? { ...sel.valor, id: randomUUID(), cliente_id: randomUUID() }
    : sel.valor;
  const v = await asegurarVehiculo(supabase, datos);
  if (!v.ok) return { error: v.res.ok ? "No se pudo registrar el vehículo." : v.res.error };

  // ---- Crear: cita (sin duplicar la misma a la misma hora) ----
  const { data: repetida } = await supabase
    .from("citas")
    .select("id")
    .eq("vehiculo_id", v.id)
    .eq("fecha_hora", fechaHora)
    .eq("estado", "pendiente")
    .maybeSingle();
  if (repetida) return { error: "Ese vehículo ya tiene una cita a esa hora." };

  const { error } = await supabase.from("citas").insert({ vehiculo_id: v.id, fecha_hora: fechaHora, tipo, notas, autor });
  if (error) return { error: mensajeDeError(error) };

  refrescar();
  return { ok: true };
}

/** Marca una cita pendiente como cumplida (el vehículo llegó) o cancelada. */
export async function cambiarEstadoCita(datos: { id: string; estado: "cumplida" | "cancelada" }): Promise<AccionCita> {
  if (!esUuid(datos.id)) return { ok: false, error: "Cita inválida." };
  if (datos.estado !== "cumplida" && datos.estado !== "cancelada") return { ok: false, error: "Estado inválido." };

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { data, error } = await supabase
    .from("citas")
    .update({ estado: datos.estado })
    .eq("id", datos.id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) return { ok: false, error: "La cita ya no está pendiente." };

  refrescar();
  return { ok: true };
}

/** Anota que ya se le avisó por WhatsApp (se llama al tocar el botón; no es crítico si falla). */
export async function marcarRecordatorio(datos: { id: string }): Promise<AccionCita> {
  if (!esUuid(datos.id)) return { ok: false, error: "Cita inválida." };

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const { error } = await supabase
    .from("citas")
    .update({ recordatorio_enviado_at: new Date().toISOString() })
    .eq("id", datos.id)
    .eq("estado", "pendiente");
  if (error) return { ok: false, error: mensajeDeError(error) };

  revalidatePath("/agenda");
  return { ok: true };
}

/**
 * Citas pendientes de un vehículo (hoy y próximos 7 días) para la pantalla de «Nueva orden»: si hay
 * alguna, el formulario propone la de hoy y pregunta por las de los próximos días. `incluirId` es la
 * cita desde la que se llegó, si viene de la agenda.
 */
export async function citasDelVehiculo(datos: {
  vehiculoId: string;
  incluirId?: string | null;
}): Promise<{ ok: true; citas: CitaDeVehiculo[] } | { ok: false; error: string }> {
  if (!esUuid(datos.vehiculoId)) return { ok: false, error: "Vehículo inválido." };
  const incluirId = datos.incluirId && esUuid(datos.incluirId) ? datos.incluirId : null;

  const { supabase, user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;

  const r = await consultarCitasDelVehiculo(supabase, datos.vehiculoId, incluirId);
  return r.error ? { ok: false, error: r.error } : { ok: true, citas: r.citas };
}
