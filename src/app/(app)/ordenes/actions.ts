"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { filtroVehiculos } from "@/lib/consultas";
import { mensajeDeError } from "@/lib/errores";
import {
  cargarContextoOrden,
  enviarWhatsApp,
  envioAutomaticoActivo,
} from "@/lib/notificaciones";
import { pertenenciasONull } from "@/lib/offline/operaciones";
import { OPCIONES_GARANTIA, esEstado, esUuid } from "@/lib/ordenes";
import type { Json } from "@/types/database";

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

const BUCKET_EVIDENCIAS = "evidencias-ordenes";

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** "" -> null; número válido -> number; cualquier otra cosa -> NaN. */
function numeroOpcional(valor: string): number | null {
  if (valor === "") return null;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------------
// Búsqueda de vehículos (selector del formulario)
// ---------------------------------------------------------------------

export async function buscarVehiculos(consulta: string): Promise<VehiculoResultado[]> {
  const q = consulta.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

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

  // Aviso automático al pasar a Listo / Entregado (opt-in: WHATSAPP_AUTO_ENVIO=true).
  // Un fallo del servidor de WhatsApp nunca revierte el guardado.
  const cambioDeEstado = previa?.estado !== estado;
  if (cambioDeEstado && (estado === "listo" || estado === "entregado") && envioAutomaticoActivo()) {
    const contexto = await cargarContextoOrden(supabase, ordenId);
    if (contexto) {
      const r = await enviarWhatsApp(contexto.telefono, contexto.mensajes[estado]);
      return {
        ok: r.ok
          ? "Cambios guardados. WhatsApp enviado al cliente."
          : `Cambios guardados, pero no se pudo enviar el WhatsApp: ${r.error}`,
      };
    }
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

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

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
