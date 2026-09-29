"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { mensajeDeError } from "@/lib/errores";
import { esCategoria, hoyBogota } from "@/lib/caja";
import { esUuid } from "@/lib/ordenes";

export type GastoResultado = { ok: true } | { ok: false; error: string };

const BUCKET_FACTURAS = "facturas-gastos";
const MAX_BYTES_COMPROBANTE = 3 * 1024 * 1024; // igual que file_size_limit del bucket
const MIMES: Record<string, "webp" | "jpg"> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
const MAX_MONTO = 9_999_999_999; // numeric(12,2) admite hasta 9 999 999 999,99

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

// ---------------------------------------------------------------------
// Registro express de gasto
// ---------------------------------------------------------------------

export async function registrarGasto(formData: FormData): Promise<GastoResultado> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

  const monto = Number(texto(formData, "monto").replace(",", "."));
  const categoria = texto(formData, "categoria");

  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "Ingresa un monto mayor a 0." };
  }
  if (monto > MAX_MONTO) return { ok: false, error: "El monto es demasiado grande." };
  if (!esCategoria(categoria)) return { ok: false, error: "Selecciona una categoría." };

  const descripcion = texto(formData, "descripcion").slice(0, 300) || null;
  const fecha = hoyBogota();

  // ---- Comprobante opcional ----
  let ruta: string | null = null;
  const archivo = formData.get("comprobante");
  if (archivo instanceof File && archivo.size > 0) {
    const extension = MIMES[archivo.type];
    if (!extension) return { ok: false, error: "Formato de imagen no permitido." };
    if (archivo.size > MAX_BYTES_COMPROBANTE) {
      return { ok: false, error: "La imagen supera los 3 MB." };
    }

    // Convención de rutas del bucket: <yyyy-mm>/<uuid>.<ext>
    ruta = `${fecha.slice(0, 7)}/${randomUUID()}.${extension}`;
    const { error: errSubida } = await supabase.storage
      .from(BUCKET_FACTURAS)
      .upload(ruta, Buffer.from(await archivo.arrayBuffer()), {
        contentType: archivo.type,
        upsert: false,
      });
    if (errSubida) {
      return { ok: false, error: `No se pudo subir el comprobante: ${errSubida.message}` };
    }
  }

  const { error } = await supabase.from("gastos_caja_menor").insert({
    fecha,
    categoria,
    monto: Math.round(monto * 100) / 100,
    descripcion,
    comprobante_url: ruta,
  });

  if (error) {
    // Sin registro no hay forma de encontrar el archivo: se retira para no dejar huérfanos.
    if (ruta) await supabase.storage.from(BUCKET_FACTURAS).remove([ruta]);
    return { ok: false, error: mensajeDeError(error) };
  }

  revalidatePath("/caja-menor");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Eliminar gasto (solo admin por RLS)
// ---------------------------------------------------------------------

export async function eliminarGasto(id: string): Promise<GastoResultado> {
  if (!esUuid(id)) return { ok: false, error: "Gasto inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };

  const { data: gasto } = await supabase
    .from("gastos_caja_menor")
    .select("comprobante_url")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("gastos_caja_menor")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data || data.length === 0) {
    // RLS: solo el admin puede borrar; sin permiso, Postgres devuelve 0 filas.
    return { ok: false, error: "No se pudo eliminar. Solo el administrador puede borrar gastos." };
  }

  if (gasto?.comprobante_url) {
    await supabase.storage.from(BUCKET_FACTURAS).remove([gasto.comprobante_url]);
  }

  revalidatePath("/caja-menor");
  return { ok: true };
}
