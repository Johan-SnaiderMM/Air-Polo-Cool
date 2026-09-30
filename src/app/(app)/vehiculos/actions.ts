"use server";

import { revalidatePath } from "next/cache";
import { mensajeDeError } from "@/lib/errores";
import { esUuid } from "@/lib/ordenes";
import { validar } from "@/lib/esquemas/comunes";
import { editarClienteSchema, editarVehiculoSchema } from "@/lib/esquemas/vehiculo";
import { texto } from "@/lib/formularios";
import { exigirSesion } from "@/utils/supabase/sesion";

export type EdicionState = { error?: string; ok?: string };

// ---------------------------------------------------------------------
// Vehículo
// ---------------------------------------------------------------------

export async function editarVehiculo(
  _prev: EdicionState,
  formData: FormData
): Promise<EdicionState> {
  const { supabase } = await exigirSesion();

  const v = validar(editarVehiculoSchema, {
    vehiculo_id: texto(formData, "vehiculo_id"),
    placa: texto(formData, "placa"),
    marca: texto(formData, "marca"),
    modelo: texto(formData, "modelo"),
    anio: texto(formData, "anio"),
    tipo_gas_sugerido: texto(formData, "tipo_gas_sugerido"),
    carga_estandar_gramos: texto(formData, "carga_estandar_gramos"),
  });
  if (!v.ok) return { error: v.error };
  const { vehiculo_id: id, placa, ...campos } = v.valor;

  const { data, error } = await supabase
    .from("vehiculos")
    .update({ placa, ...campos })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") return { error: `Ya existe otro vehículo con la placa ${placa}.` };
    return { error: mensajeDeError(error) };
  }
  if (!data || data.length === 0) return { error: "No se pudo actualizar el vehículo." };

  revalidatePath(`/vehiculos/${id}`);
  revalidatePath("/vehiculos");
  revalidatePath("/ordenes");
  return { ok: "Vehículo actualizado." };
}

// ---------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------

export async function editarCliente(
  _prev: EdicionState,
  formData: FormData
): Promise<EdicionState> {
  const { supabase } = await exigirSesion();

  const vehiculoId = texto(formData, "vehiculo_id"); // solo para refrescar la pantalla
  const c = validar(editarClienteSchema, {
    cliente_id: texto(formData, "cliente_id"),
    nombre: texto(formData, "nombre"),
    telefono: texto(formData, "telefono"),
    documento: texto(formData, "documento"),
  });
  if (!c.ok) return { error: c.error };
  const { cliente_id: id, ...campos } = c.valor;

  const { data, error } = await supabase
    .from("clientes")
    .update(campos)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") return { error: "Ya existe otro cliente con ese documento." };
    return { error: mensajeDeError(error) };
  }
  if (!data || data.length === 0) return { error: "No se pudo actualizar el cliente." };

  if (esUuid(vehiculoId)) revalidatePath(`/vehiculos/${vehiculoId}`);
  revalidatePath("/vehiculos");
  revalidatePath("/ordenes");
  return { ok: "Cliente actualizado." };
}
