"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { mensajeDeError } from "@/lib/errores";
import { esUuid, normalizarPlaca, normalizarTelefono } from "@/lib/ordenes";
import type { TipoGasSugerido } from "@/types/database";

export type EdicionState = { error?: string; ok?: string };

const GASES: TipoGasSugerido[] = ["R134a", "R1234yf", "otro"];

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
// Vehículo
// ---------------------------------------------------------------------

export async function editarVehiculo(
  _prev: EdicionState,
  formData: FormData
): Promise<EdicionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const id = texto(formData, "vehiculo_id");
  if (!esUuid(id)) return { error: "Vehículo inválido." };

  const placa = normalizarPlaca(texto(formData, "placa"));
  const marca = texto(formData, "marca");
  const modelo = texto(formData, "modelo");
  const anio = numeroOpcional(texto(formData, "anio"));
  const gas = texto(formData, "tipo_gas_sugerido");
  const carga = numeroOpcional(texto(formData, "carga_estandar_gramos"));

  if (!/^[A-Z0-9]{5,8}$/.test(placa)) {
    return { error: "La placa debe tener entre 5 y 8 letras/números." };
  }
  if (!marca || !modelo) return { error: "Ingresa la marca y la línea." };
  if (
    anio !== null &&
    (Number.isNaN(anio) || !Number.isInteger(anio) || anio < 1950 || anio > 2100)
  ) {
    return { error: "El modelo (año) debe estar entre 1950 y 2100." };
  }
  if (gas !== "" && !GASES.includes(gas as TipoGasSugerido)) {
    return { error: "Tipo de refrigerante inválido." };
  }
  if (carga !== null && (Number.isNaN(carga) || carga <= 0 || carga >= 100000)) {
    return { error: "La carga estándar debe ser un valor en gramos mayor a 0." };
  }

  const { data, error } = await supabase
    .from("vehiculos")
    .update({
      placa,
      marca,
      modelo,
      anio,
      tipo_gas_sugerido: gas === "" ? null : (gas as TipoGasSugerido),
      carga_estandar_gramos: carga,
    })
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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const id = texto(formData, "cliente_id");
  const vehiculoId = texto(formData, "vehiculo_id"); // solo para refrescar la pantalla
  if (!esUuid(id)) return { error: "Cliente inválido." };

  const nombre = texto(formData, "nombre");
  const telefono = normalizarTelefono(texto(formData, "telefono"));
  const documento = texto(formData, "documento") || null;

  if (!nombre) return { error: "Ingresa el nombre del cliente." };
  if (!telefono) {
    return {
      error:
        "WhatsApp inválido. Usa 10 dígitos (300 123 4567) o el formato internacional (+57…).",
    };
  }

  const { data, error } = await supabase
    .from("clientes")
    .update({ nombre, telefono, documento })
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
