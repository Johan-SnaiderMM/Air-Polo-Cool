import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoOrden } from "@/types/database";
import {
  construirMensaje,
  soloDigitos,
  urlPublicaOrden,
  type PlantillaWhatsApp,
} from "@/lib/whatsapp";
import { formatearFechaDate } from "@/lib/ordenes";

export type EnvioResultado = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------

type Proveedor = "evolution" | "waha";

type Config = {
  proveedor: Proveedor;
  url: string;
  apiKey: string;
  instancia: string;
};

function leerConfig(): Config | null {
  const url = process.env.WHATSAPP_API_URL?.trim();
  const apiKey = process.env.WHATSAPP_API_KEY?.trim();
  const instancia = process.env.WHATSAPP_INSTANCE?.trim();
  const proveedor = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() ?? "evolution";

  if (!url || !apiKey || !instancia) return null;
  if (proveedor !== "evolution" && proveedor !== "waha") return null;
  return { proveedor, url: url.replace(/\/+$/, ""), apiKey, instancia };
}

export function envioAutomaticoConfigurado(): boolean {
  return leerConfig() !== null;
}

/** Envío al cambiar de estado: requiere proveedor configurado Y WHATSAPP_AUTO_ENVIO=true. */
export function envioAutomaticoActivo(): boolean {
  return envioAutomaticoConfigurado() && process.env.WHATSAPP_AUTO_ENVIO === "true";
}

// ---------------------------------------------------------------------
// Envío (Evolution API / WAHA)
// ---------------------------------------------------------------------

/**
 * Despacha un texto por WhatsApp. `telefonoE164` con formato +573001234567.
 *  - Evolution: POST {url}/message/sendText/{instancia}  (header apikey)
 *  - WAHA:      POST {url}/api/sendText                  (header X-Api-Key)
 */
export async function enviarWhatsApp(
  telefonoE164: string,
  texto: string
): Promise<EnvioResultado> {
  const config = leerConfig();
  if (!config) {
    return { ok: false, error: "El envío automático de WhatsApp no está configurado." };
  }

  const numero = soloDigitos(telefonoE164);
  const peticion: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, string>;
  } =
    config.proveedor === "evolution"
      ? {
          url: `${config.url}/message/sendText/${encodeURIComponent(config.instancia)}`,
          headers: { apikey: config.apiKey },
          body: { number: numero, text: texto },
        }
      : {
          url: `${config.url}/api/sendText`,
          headers: { "X-Api-Key": config.apiKey },
          body: { session: config.instancia, chatId: `${numero}@c.us`, text: texto },
        };

  try {
    const respuesta = await fetch(peticion.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...peticion.headers },
      body: JSON.stringify(peticion.body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!respuesta.ok) {
      const detalle = (await respuesta.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        error: `El servidor de WhatsApp respondió ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
      };
    }
    return { ok: true };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "error desconocido";
    return { ok: false, error: `No se pudo contactar el servidor de WhatsApp (${motivo}).` };
  }
}

// ---------------------------------------------------------------------
// Contexto de una orden -> mensaje
// ---------------------------------------------------------------------

/** Origen público (https://dominio). Prioriza NEXT_PUBLIC_SITE_URL. */
export async function origenPublico(): Promise<string> {
  const fijo = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fijo) return fijo.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ContextoOrden = {
  estado: EstadoOrden;
  telefono: string;
  mensajes: Record<PlantillaWhatsApp, string>;
  urlPublica: string;
};

/** Carga los datos de la orden con la sesión del usuario (RLS) y arma las 3 plantillas. */
export async function cargarContextoOrden(
  supabase: SupabaseClient<Database>,
  ordenId: string
): Promise<ContextoOrden | null> {
  const { data: orden } = await supabase
    .from("ordenes_servicio")
    .select(
      "estado, token_publico, total_cobrado, fecha_fin_garantia, vehiculos(placa, marca, modelo, anio, clientes(nombre, telefono))"
    )
    .eq("id", ordenId)
    .maybeSingle();

  const v = orden?.vehiculos;
  const cliente = v?.clientes;
  if (!orden || !v || !cliente) return null;

  const urlPublica = urlPublicaOrden(await origenPublico(), orden.token_publico);
  const datos = {
    cliente: cliente.nombre,
    vehiculo: `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}`,
    placa: v.placa,
    urlPublica,
    totalCobrado: orden.total_cobrado,
    garantiaHasta: orden.fecha_fin_garantia
      ? formatearFechaDate(orden.fecha_fin_garantia)
      : null,
  };

  return {
    estado: orden.estado,
    telefono: cliente.telefono,
    urlPublica,
    mensajes: {
      recepcion: construirMensaje("recepcion", datos),
      listo: construirMensaje("listo", datos),
      entregado: construirMensaje("entregado", datos),
    },
  };
}
