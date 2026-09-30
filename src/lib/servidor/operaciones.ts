import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { esErrorDeMigracion, mensajeDeError } from "@/lib/errores";
import {
  esErrorTransitorio,
  type DatosVehiculoOrden,
  type Operacion,
} from "@/lib/offline/operaciones";
import { validar } from "@/lib/esquemas/comunes";
import { camposVehiculoNuevoSchema } from "@/lib/esquemas/vehiculo";
import { BUCKET_EVIDENCIAS, BUCKET_FACTURAS } from "@/lib/almacenamiento";

type Supabase = SupabaseClient<Database>;

export type ResultadoOperacion =
  | { ok: true; duplicado?: boolean }
  | { ok: false; error: string; permanente: boolean; sesion?: boolean };

const MAX_BYTES_IMAGEN = 3 * 1024 * 1024;
const MIME_EXT: Record<string, "webp" | "jpg"> = { "image/webp": "webp", "image/jpeg": "jpg" };

const fallo = (error: string, permanente = true): ResultadoOperacion => ({ ok: false, error, permanente });

type ErrorDb = { code?: string; message: string; hint?: string | null };

/** Convierte un error de base de datos en resultado (transitorio si es de conexión). */
function falloDb(error: ErrorDb): ResultadoOperacion {
  return fallo(mensajeDeError(error), !esErrorTransitorio(error.code));
}

/** Valida y devuelve la extensión de la imagen adjunta. */
function validarImagen(archivo: File | null): { ok: true; ext: "webp" | "jpg"; archivo: File } | { ok: false; res: ResultadoOperacion } {
  if (!archivo || archivo.size === 0) return { ok: false, res: fallo("Falta la imagen adjunta.") };
  const ext = MIME_EXT[archivo.type];
  if (!ext) return { ok: false, res: fallo("Formato de imagen no permitido (usa WebP o JPEG).") };
  if (archivo.size > MAX_BYTES_IMAGEN) return { ok: false, res: fallo("La imagen supera los 3 MB.") };
  return { ok: true, ext, archivo };
}

async function subir(supabase: Supabase, bucket: string, ruta: string, archivo: File) {
  return supabase.storage
    .from(bucket)
    .upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, upsert: true });
}

// ---------------------------------------------------------------------
// Alta de vehículo (y cliente) — compartida con cotizaciones
// ---------------------------------------------------------------------

export async function asegurarVehiculo(
  supabase: Supabase,
  v: DatosVehiculoOrden
): Promise<{ ok: true; id: string } | { ok: false; res: ResultadoOperacion }> {
  if (!v.nuevo) {
    const { data } = await supabase.from("vehiculos").select("id").eq("id", v.id).maybeSingle();
    return data ? { ok: true, id: v.id } : { ok: false, res: fallo("El vehículo ya no existe.") };
  }

  // Reglas compartidas con el formulario del teléfono (el servidor nunca confía en la cola).
  const datos = validar(camposVehiculoNuevoSchema, v);
  if (!datos.ok) return { ok: false, res: fallo(datos.error) };
  const { cliente_nombre, cliente_telefono: telefono, placa, marca, modelo, anio } = datos.valor;

  // ¿Ya se creó en un intento anterior? (idempotencia)
  const { data: mismo } = await supabase.from("vehiculos").select("id").eq("id", v.id).maybeSingle();
  if (mismo) return { ok: true, id: v.id };

  const { data: conPlaca } = await supabase.from("vehiculos").select("id").eq("placa", placa).maybeSingle();
  if (conPlaca) {
    return {
      ok: false,
      res: fallo(`La placa ${placa} ya está registrada. Abre ese vehículo y crea la orden desde su historial.`),
    };
  }

  // Cliente: por id (reintento), por teléfono (mismo dueño, varios vehículos) o nuevo.
  let clienteId = v.cliente_id;
  const { data: clientePorId } = await supabase.from("clientes").select("id").eq("id", v.cliente_id).maybeSingle();
  if (!clientePorId) {
    const { data: clientePorTel } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefono", telefono)
      .limit(1)
      .maybeSingle();
    if (clientePorTel) {
      clienteId = clientePorTel.id;
    } else {
      const { error } = await supabase
        .from("clientes")
        .insert({ id: v.cliente_id, nombre: cliente_nombre, telefono });
      if (error) return { ok: false, res: falloDb(error) };
    }
  }

  const { error } = await supabase.from("vehiculos").insert({
    id: v.id,
    cliente_id: clienteId,
    placa,
    marca,
    modelo,
    anio,
  });
  if (error) return { ok: false, res: falloDb(error) };
  return { ok: true, id: v.id };
}

// ---------------------------------------------------------------------
// Ejecución de una operación (idempotente por id)
// ---------------------------------------------------------------------

export async function ejecutarOperacion(
  supabase: Supabase,
  op: Operacion,
  archivo: File | null
): Promise<ResultadoOperacion> {
  switch (op.tipo) {
    case "gasto.crear": {
      const d = op.datos;
      let ruta: string | null = null;
      if (op.conArchivo) {
        const img = validarImagen(archivo);
        if (!img.ok) return img.res;
        ruta = `${d.fecha.slice(0, 7)}/${d.id}.${img.ext}`;
        const { error } = await subir(supabase, BUCKET_FACTURAS, ruta, img.archivo);
        if (error) return fallo(`No se pudo subir el recibo: ${error.message}`, false);
      }
      const { error } = await supabase.from("gastos_caja_menor").insert({
        id: d.id,
        fecha: d.fecha,
        categoria: d.categoria,
        monto: d.monto,
        descripcion: d.descripcion,
        orden_id: d.orden_id,
        autor: d.autor,
        comprobante_url: ruta,
      });
      if (error) {
        if (error.code === "23505") return { ok: true, duplicado: true };
        if (ruta) await supabase.storage.from(BUCKET_FACTURAS).remove([ruta]);
        if (error.code === "23503") return fallo("La orden asociada ya no existe.");
        return falloDb(error);
      }
      return { ok: true };
    }

    case "pago.crear": {
      const d = op.datos;
      let ruta: string | null = null;
      if (op.conArchivo) {
        const img = validarImagen(archivo);
        if (!img.ok) return img.res;
        ruta = `pagos/${d.fecha.slice(0, 7)}/${d.id}.${img.ext}`;
        const { error } = await subir(supabase, BUCKET_FACTURAS, ruta, img.archivo);
        if (error) return fallo(`No se pudo subir el comprobante: ${error.message}`, false);
      }
      const { error } = await supabase.from("pagos_orden").insert({
        id: d.id,
        orden_id: d.orden_id,
        fecha: d.fecha,
        monto: d.monto,
        medio: d.medio,
        es_devolucion: d.es_devolucion,
        referencia: d.referencia,
        notas: d.notas,
        autor: d.autor,
        comprobante_url: ruta,
      });
      if (error) {
        if (error.code === "23505") return { ok: true, duplicado: true };
        if (ruta) await supabase.storage.from(BUCKET_FACTURAS).remove([ruta]);
        if (error.code === "23503") return fallo("La orden de este pago ya no existe.");
        return falloDb(error);
      }
      return { ok: true };
    }

    case "evidencia.subir": {
      const d = op.datos;
      const img = validarImagen(archivo);
      if (!img.ok) return img.res;
      const ruta = `${d.orden_id}/${d.id}.${img.ext}`;
      const { error: errSubida } = await subir(supabase, BUCKET_EVIDENCIAS, ruta, img.archivo);
      if (errSubida) return fallo(`No se pudo subir la foto: ${errSubida.message}`, false);
      // Solo se liga si el repuesto sigue siendo de esta orden (pudo quitarse mientras no había red).
      let repuestoId: string | null = null;
      if (d.orden_repuesto_id) {
        const { data: linea } = await supabase
          .from("orden_repuestos")
          .select("id")
          .eq("id", d.orden_repuesto_id)
          .eq("orden_id", d.orden_id)
          .maybeSingle();
        repuestoId = linea?.id ?? null;
      }
      const fila: Database["public"]["Tables"]["evidencias_fotograficas"]["Insert"] = {
        id: d.id,
        orden_id: d.orden_id,
        url_imagen: ruta,
        tipo: d.tipo,
        notas: d.notas,
      };
      const conVinculo = repuestoId ? { ...fila, orden_repuesto_id: repuestoId } : fila;
      let { error } = await supabase.from("evidencias_fotograficas").insert(conVinculo);
      // Si falta ejecutar fase5.sql (columna inexistente) la foto se guarda igual, sin vínculo.
      if (error && repuestoId && esErrorDeMigracion(error)) {
        ({ error } = await supabase.from("evidencias_fotograficas").insert(fila));
      }
      if (error) {
        if (error.code === "23505") return { ok: true, duplicado: true };
        await supabase.storage.from(BUCKET_EVIDENCIAS).remove([ruta]);
        if (error.code === "23503") return fallo("La orden de esta foto no existe (¿se creó sin conexión y falló?).");
        return falloDb(error);
      }
      return { ok: true };
    }

    case "orden.crear": {
      const d = op.datos;
      const { data: ya } = await supabase.from("ordenes_servicio").select("id").eq("id", d.id).maybeSingle();
      if (ya) return { ok: true, duplicado: true };

      const veh = await asegurarVehiculo(supabase, d.vehiculo);
      if (!veh.ok) return veh.res;

      const { error } = await supabase.from("ordenes_servicio").insert({
        id: d.id,
        vehiculo_id: veh.id,
        estado: d.estado,
        kilometraje: d.kilometraje,
        diagnostico_inicial: d.diagnostico_inicial,
        trabajos_a_realizar: d.trabajos_a_realizar,
        mano_obra: d.mano_obra,
        total_cobrado: d.total_cobrado,
        dias_garantia: d.dias_garantia,
        pertenencias: d.pertenencias ? JSON.parse(JSON.stringify(d.pertenencias)) : null,
        mantenimiento_meses: d.mantenimiento_meses,
        autor: d.autor,
      });
      if (error) {
        if (error.code === "23505") return { ok: true, duplicado: true };
        return falloDb(error);
      }
      return { ok: true };
    }
  }
}
