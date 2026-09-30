"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { validarOperacion } from "@/lib/offline/operaciones";
import { ejecutarOperacion, type ResultadoOperacion } from "@/lib/servidor/operaciones";
import type { OrdenLocal, Snapshot, VehiculoLocal } from "@/lib/offline/snapshot";

/**
 * Punto de entrada ÚNICO de escritura para lo que puede hacerse sin conexión.
 * Lo llama el navegador tanto en línea (directo) como al vaciar la cola offline:
 * misma validación y misma idempotencia en ambos casos.
 *
 * FormData: `op` (JSON de la operación) y, si aplica, `archivo` (imagen comprimida).
 */
export async function procesarOperacion(formData: FormData): Promise<ResultadoOperacion> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      ok: false,
      error: "Tu sesión expiró. Inicia sesión para sincronizar.",
      permanente: false,
      sesion: true,
    };
  }

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("op") ?? ""));
  } catch {
    return { ok: false, error: "Operación ilegible.", permanente: true };
  }
  const validada = validarOperacion(crudo);
  if (!validada.ok) return { ok: false, error: validada.error, permanente: true };

  const adjunto = formData.get("archivo");
  const archivo = adjunto instanceof File ? adjunto : null;

  let resultado: ResultadoOperacion;
  try {
    resultado = await ejecutarOperacion(supabase, validada.valor, archivo);
  } catch (e) {
    // Excepción inesperada (p. ej. corte de red hacia Supabase): se reintenta luego.
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error inesperado al procesar la operación.",
      permanente: false,
    };
  }

  if (resultado.ok) {
    const op = validada.valor;
    switch (op.tipo) {
      case "gasto.crear":
        revalidatePath("/caja-menor");
        break;
      case "pago.crear":
        revalidatePath(`/ordenes/${op.datos.orden_id}`);
        revalidatePath("/cartera");
        revalidatePath("/caja-menor");
        revalidatePath("/");
        break;
      case "evidencia.subir":
        revalidatePath(`/ordenes/${op.datos.orden_id}`);
        break;
      case "orden.crear":
        revalidatePath("/ordenes");
        revalidatePath("/");
        revalidatePath("/vehiculos");
        break;
    }
  }
  return resultado;
}

const LIMITE_VEHICULOS = 2000;
const LIMITE_ORDENES = 300;

/** Datos de referencia para trabajar sin conexión (se guardan en IndexedDB). */
export async function obtenerSnapshot(): Promise<Snapshot | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [vehiculos, ordenes, saldos] = await Promise.all([
    supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo, anio, cliente_id, clientes(nombre, telefono)")
      .order("created_at", { ascending: false })
      .limit(LIMITE_VEHICULOS),
    supabase
      .from("ordenes_servicio")
      .select("id, estado, total_cobrado, vehiculos(placa, marca, modelo, clientes(nombre))")
      .neq("estado", "cancelado")
      .order("created_at", { ascending: false })
      .limit(LIMITE_ORDENES),
    supabase.from("v_saldo_ordenes").select("orden_id, saldo").gt("saldo", 0).limit(1000),
  ]);

  if (vehiculos.error || ordenes.error) return null;

  const saldoPorOrden = new Map<string, number>(
    (saldos.data ?? []).flatMap((s) => (s.orden_id && s.saldo !== null ? [[s.orden_id, s.saldo] as const] : []))
  );

  const listaVehiculos: VehiculoLocal[] = (vehiculos.data ?? []).map((v) => ({
    id: v.id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    cliente_id: v.cliente_id,
    cliente: v.clientes?.nombre ?? "",
    telefono: v.clientes?.telefono ?? "",
  }));

  const listaOrdenes: OrdenLocal[] = (ordenes.data ?? []).map((o) => ({
    id: o.id,
    placa: o.vehiculos?.placa ?? "",
    marca: o.vehiculos?.marca ?? "",
    modelo: o.vehiculos?.modelo ?? "",
    cliente: o.vehiculos?.clientes?.nombre ?? "",
    estado: o.estado,
    total_cobrado: o.total_cobrado,
    saldo: saldoPorOrden.get(o.id) ?? 0,
  }));

  return { generado: new Date().toISOString(), vehiculos: listaVehiculos, ordenes: listaOrdenes };
}
