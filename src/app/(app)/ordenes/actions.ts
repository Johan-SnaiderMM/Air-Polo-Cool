"use server";

import { randomUUID } from "node:crypto";
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
import {
  OPCIONES_GARANTIA,
  esEstado,
  esTipoEvidencia,
  esUuid,
  normalizarPlaca,
  normalizarTelefono,
} from "@/lib/ordenes";
import type { TablesInsert } from "@/types/database";

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

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
const MAX_BYTES_FOTO = 2 * 1024 * 1024; // igual que file_size_limit del bucket
const MIMES_FOTO: Record<string, "webp" | "jpg"> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

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

export async function buscarVehiculos(
  consulta: string
): Promise<VehiculoResultado[]> {
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
// Crear / editar orden
// ---------------------------------------------------------------------

export async function guardarOrden(
  _prev: OrdenFormState,
  formData: FormData
): Promise<OrdenFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const ordenId = texto(formData, "orden_id");
  const editando = ordenId !== "";
  if (editando && !esUuid(ordenId)) return { error: "Orden inválida." };

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

  const estadoCrudo = texto(formData, "estado") || "recibido";
  if (!esEstado(estadoCrudo)) return { error: "Estado inválido." };

  const campos = {
    kilometraje,
    diagnostico_inicial: texto(formData, "diagnostico_inicial") || null,
    trabajos_a_realizar: texto(formData, "trabajos_a_realizar") || null,
    mano_obra: manoObra,
    total_cobrado: totalCobrado,
    dias_garantia: diasGarantia,
    estado: estadoCrudo,
  };

  // ---- Edición ----
  if (editando) {
    const { data: previa } = await supabase
      .from("ordenes_servicio")
      .select("estado")
      .eq("id", ordenId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update({
        ...campos,
        // La garantía corre desde la entrega: si se revierte el estado, se limpia.
        ...(estadoCrudo === "entregado" ? {} : { fecha_entrega: null }),
      })
      .eq("id", ordenId)
      .select("id");

    if (error) return { error: mensajeDeError(error) };
    if (!data || data.length === 0) {
      return { error: "No se pudo actualizar la orden (¿existe y tienes permisos?)." };
    }

    revalidatePath("/ordenes");
    revalidatePath(`/ordenes/${ordenId}`);

    // Aviso automático al pasar a Listo / Entregado (opt-in: WHATSAPP_AUTO_ENVIO=true).
    // Un fallo del servidor de WhatsApp nunca revierte el guardado.
    const cambioDeEstado = previa?.estado !== estadoCrudo;
    if (
      cambioDeEstado &&
      (estadoCrudo === "listo" || estadoCrudo === "entregado") &&
      envioAutomaticoActivo()
    ) {
      const contexto = await cargarContextoOrden(supabase, ordenId);
      if (contexto) {
        const r = await enviarWhatsApp(contexto.telefono, contexto.mensajes[estadoCrudo]);
        return {
          ok: r.ok
            ? "Cambios guardados. WhatsApp enviado al cliente."
            : `Cambios guardados, pero no se pudo enviar el WhatsApp: ${r.error}`,
        };
      }
    }

    return { ok: "Cambios guardados." };
  }

  // ---- Creación: resolver vehículo (existente o nuevo) ----
  let vehiculoId = texto(formData, "vehiculo_id");

  if (texto(formData, "modo_vehiculo") === "nuevo") {
    const nombre = texto(formData, "cliente_nombre");
    const telefono = normalizarTelefono(texto(formData, "cliente_telefono"));
    const placa = normalizarPlaca(texto(formData, "placa"));
    const marca = texto(formData, "marca");
    const modelo = texto(formData, "modelo");
    const anio = numeroOpcional(texto(formData, "anio"));

    if (!nombre) return { error: "Ingresa el nombre del cliente." };
    if (!telefono) {
      return {
        error:
          "WhatsApp inválido. Usa 10 dígitos (300 123 4567) o el formato internacional (+57…).",
      };
    }
    if (!/^[A-Z0-9]{5,8}$/.test(placa)) {
      return { error: "La placa debe tener entre 5 y 8 letras/números." };
    }
    if (!marca || !modelo) return { error: "Ingresa la marca y el modelo." };
    if (
      anio !== null &&
      (Number.isNaN(anio) || !Number.isInteger(anio) || anio < 1950 || anio > 2100)
    ) {
      return { error: "El año debe estar entre 1950 y 2100." };
    }

    const { data: existente } = await supabase
      .from("vehiculos")
      .select("id")
      .eq("placa", placa)
      .maybeSingle();
    if (existente) {
      return { error: `La placa ${placa} ya está registrada: búscala y selecciónala.` };
    }

    // Reutiliza el cliente si ya existe ese WhatsApp (un cliente, varios vehículos).
    let clienteId: string;
    let clienteCreado = false;
    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefono", telefono)
      .limit(1)
      .maybeSingle();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: cliente, error } = await supabase
        .from("clientes")
        .insert({ nombre, telefono })
        .select("id")
        .single();
      if (error || !cliente) {
        return { error: mensajeDeError(error ?? { message: "No se pudo crear el cliente." }) };
      }
      clienteId = cliente.id;
      clienteCreado = true;
    }

    const { data: vehiculo, error: errVehiculo } = await supabase
      .from("vehiculos")
      .insert({ cliente_id: clienteId, placa, marca, modelo, anio })
      .select("id")
      .single();

    if (errVehiculo || !vehiculo) {
      // Mejor esfuerzo: no dejar un cliente huérfano (solo admin puede borrar).
      if (clienteCreado) await supabase.from("clientes").delete().eq("id", clienteId);
      return {
        error: mensajeDeError(errVehiculo ?? { message: "No se pudo crear el vehículo." }),
      };
    }
    vehiculoId = vehiculo.id;
  }

  if (!vehiculoId || !esUuid(vehiculoId)) {
    return { error: "Selecciona un vehículo o registra uno nuevo." };
  }

  const nueva: TablesInsert<"ordenes_servicio"> = {
    vehiculo_id: vehiculoId,
    ...campos,
  };
  const { data: orden, error: errOrden } = await supabase
    .from("ordenes_servicio")
    .insert(nueva)
    .select("id")
    .single();

  if (errOrden || !orden) {
    return { error: mensajeDeError(errOrden ?? { message: "No se pudo crear la orden." }) };
  }

  revalidatePath("/ordenes");
  // Se abre la orden para poder adjuntar las fotos de ingreso de inmediato.
  redirect(`/ordenes/${orden.id}`);
}

// ---------------------------------------------------------------------
// Evidencia fotográfica
// ---------------------------------------------------------------------

export async function subirEvidencia(
  formData: FormData
): Promise<SubidaResultado> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

  const ordenId = texto(formData, "orden_id");
  const tipo = texto(formData, "tipo");
  const archivo = formData.get("archivo");

  if (!esUuid(ordenId)) return { ok: false, error: "Orden inválida." };
  if (!esTipoEvidencia(tipo)) return { ok: false, error: "Tipo de foto inválido." };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "No se recibió ninguna imagen." };
  }
  const extension = MIMES_FOTO[archivo.type];
  if (!extension) return { ok: false, error: "Formato no permitido (usa WebP o JPEG)." };
  if (archivo.size > MAX_BYTES_FOTO) {
    return { ok: false, error: "La imagen supera los 2 MB." };
  }

  const ruta = `${ordenId}/${randomUUID()}.${extension}`;

  const { error: errSubida } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(ruta, Buffer.from(await archivo.arrayBuffer()), {
      contentType: archivo.type,
      upsert: false,
    });
  if (errSubida) return { ok: false, error: `No se pudo subir la foto: ${errSubida.message}` };

  const notas = texto(formData, "notas") || null;
  const { error: errRegistro } = await supabase
    .from("evidencias_fotograficas")
    .insert({ orden_id: ordenId, url_imagen: ruta, tipo, notas });

  if (errRegistro) {
    // Sin registro no hay forma de encontrar el archivo: se retira para no dejar huérfanos.
    await supabase.storage.from(BUCKET_EVIDENCIAS).remove([ruta]);
    return { ok: false, error: mensajeDeError(errRegistro) };
  }

  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: true };
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
