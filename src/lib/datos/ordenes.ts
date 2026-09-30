/**
 * Acceso a datos de órdenes. Cada función recibe el cliente de Supabase (con la sesión del usuario,
 * así que aplica RLS) y devuelve modelos ya listos para la vista, con tipos propios: las páginas no
 * hacen consultas ni `as`. Todo lo que no depende de otra cosa se pide EN PARALELO.
 */
import type { OrdenResumen } from "@/components/ordenes/orden-card";
import type { EvidenciaVista } from "@/components/ordenes/galeria-evidencias";
import type { PagoVista } from "@/components/ordenes/pagos-orden";
import type { LineaRepuesto } from "@/components/ordenes/repuestos-orden";
import { BUCKET_EVIDENCIAS, BUCKET_FACTURAS, VIGENCIA_URL_INTERNA_SEGUNDOS } from "@/lib/almacenamiento";
import { filtroVehiculos } from "@/lib/consultas";
import {
  armarEvidencias,
  armarLineas,
  armarPagos,
  saldoPendiente,
  totalesRepuestos,
} from "@/lib/datos/mapeo";
import { firmarRutas } from "@/lib/datos/firmar";
import { lineasHistorial } from "@/lib/historial-estado";
import { cargarContextoOrden, type ContextoOrden } from "@/lib/notificaciones";
import type { EstadoOrden } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

// ---------------------------------------------------------------------
// Lista de órdenes
// ---------------------------------------------------------------------

/** Columnas de una tarjeta de orden (lista y «Listos para entregar» del inicio). */
export const SELECT_ORDEN_RESUMEN =
  "id, estado, fecha_ingreso, total_cobrado, mantenimiento_meses, vehiculos(placa, marca, modelo, anio, clientes(nombre))";

export type ListaOrdenes = {
  ordenes: OrdenResumen[];
  /** Saldo por cobrar de cada orden que aún debe algo (id → saldo). */
  saldoDe: Map<string, number>;
  error: string | null;
};

export async function listarOrdenes(
  supabase: ClienteServidor,
  filtros: { q: string; estado?: EstadoOrden; limite: number }
): Promise<ListaOrdenes> {
  // Los saldos no dependen de la búsqueda: se piden a la vez que la lista.
  const saldosPendientes = supabase.from("v_saldo_ordenes").select("orden_id, saldo").gt("saldo", 0).limit(1000);

  let ids: string[] | null = null; // null = sin filtro de texto
  if (filtros.q) {
    const filtro = await filtroVehiculos(supabase, filtros.q);
    if (filtro) {
      const { data } = await supabase
        .from("vehiculos")
        .select("id")
        .or(filtro)
        .limit(100); // tope: los ids viajan en la URL de la consulta siguiente
      ids = (data ?? []).map((v) => v.id);
    } else {
      ids = [];
    }
  }

  let ordenes: OrdenResumen[] = [];
  let error: string | null = null;
  if (ids === null || ids.length > 0) {
    let consulta = supabase
      .from("ordenes_servicio")
      .select(SELECT_ORDEN_RESUMEN)
      .order("fecha_ingreso", { ascending: false })
      .limit(filtros.limite);
    if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
    if (ids) consulta = consulta.in("vehiculo_id", ids);
    const { data, error: errorConsulta } = await consulta;
    if (errorConsulta) error = errorConsulta.message;
    ordenes = data ?? [];
  }

  const { data: saldos } = await saldosPendientes;
  const saldoDe = new Map(
    (saldos ?? []).flatMap((x) => (x.orden_id && x.saldo !== null ? [[x.orden_id, x.saldo] as const] : []))
  );

  return { ordenes, saldoDe, error };
}

// ---------------------------------------------------------------------
// Detalle de una orden
// ---------------------------------------------------------------------

async function consultarOrden(supabase: ClienteServidor, id: string) {
  const { data } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, vehiculos(placa, marca, modelo, anio, tipo_gas_sugerido, carga_estandar_gramos, clientes(nombre, telefono))"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** `orden_repuesto_id` existe desde la fase 5; si aún no se ejecutó se reintenta sin esa columna. */
async function consultarEvidencias(supabase: ClienteServidor, id: string) {
  const conVinculo = await supabase
    .from("evidencias_fotograficas")
    .select("id, tipo, notas, url_imagen, created_at, orden_repuesto_id")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });
  if (!conVinculo.error) return conVinculo.data;
  const { data } = await supabase
    .from("evidencias_fotograficas")
    .select("id, tipo, notas, url_imagen, created_at")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function consultarRepuestos(supabase: ClienteServidor, id: string) {
  const { data } = await supabase
    .from("orden_repuestos")
    .select("id, cantidad_usada, costo_unitario, precio_unitario, inventario(nombre, codigo, tipo_unidad)")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function consultarPagos(supabase: ClienteServidor, id: string) {
  const { data } = await supabase
    .from("pagos_orden")
    .select("id, fecha, monto, medio, es_devolucion, referencia, notas, autor, anulado, anulado_motivo, comprobante_url")
    .eq("orden_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type OrdenDetalle = NonNullable<Awaited<ReturnType<typeof consultarOrden>>>;

export type DetalleOrden = {
  orden: OrdenDetalle;
  lineas: LineaRepuesto[];
  repuestosPrecio: number;
  repuestosCosto: number;
  pagos: PagoVista[];
  saldoPendiente: number;
  /** Bitácora de cambios de estado, la más reciente primero. */
  historial: string[];
  evidencias: EvidenciaVista[];
  esAdmin: boolean;
  /** Entregada o cancelada: el trigger rechaza cambios de repuestos. */
  bloqueada: boolean;
  /** Mensajes de WhatsApp ya redactados (null si falta el teléfono o el vehículo). */
  contexto: ContextoOrden | null;
};

/**
 * Todo lo que necesita la pantalla de una orden, en dos viajes a la red: primero las seis
 * consultas independientes a la vez y después, también a la vez, las firmas de las fotos y de los
 * comprobantes. Devuelve null si la orden no existe (o no hay permiso).
 */
export async function cargarDetalleOrden(
  supabase: ClienteServidor,
  id: string,
  /** Inyectable para pruebas (usa headers() de Next para armar el enlace público). */
  cargarContexto: (s: ClienteServidor, ordenId: string) => Promise<ContextoOrden | null> = cargarContextoOrden
): Promise<DetalleOrden | null> {
  const [orden, filasEvidencias, filasRepuestos, filasPagos, sesion, contexto] = await Promise.all([
    consultarOrden(supabase, id),
    consultarEvidencias(supabase, id),
    consultarRepuestos(supabase, id),
    consultarPagos(supabase, id),
    supabase.auth.getUser(),
    cargarContexto(supabase, id),
  ]);
  if (!orden) return null;

  // Los buckets son privados: se firman URLs temporales (ambos a la vez).
  const [urlsPagos, urlsFotos] = await Promise.all([
    firmarRutas(
      supabase,
      BUCKET_FACTURAS,
      filasPagos.flatMap((p) => (p.comprobante_url ? [p.comprobante_url] : [])),
      VIGENCIA_URL_INTERNA_SEGUNDOS
    ),
    firmarRutas(
      supabase,
      BUCKET_EVIDENCIAS,
      filasEvidencias.map((f) => f.url_imagen),
      VIGENCIA_URL_INTERNA_SEGUNDOS
    ),
  ]);

  const repuestos = totalesRepuestos(filasRepuestos);
  return {
    orden,
    lineas: armarLineas(filasRepuestos),
    repuestosPrecio: repuestos.precio,
    repuestosCosto: repuestos.costo,
    pagos: armarPagos(filasPagos, urlsPagos),
    saldoPendiente: saldoPendiente(orden.total_cobrado, filasPagos),
    historial: lineasHistorial(orden.notas),
    evidencias: armarEvidencias(filasEvidencias, urlsFotos),
    esAdmin: sesion.data.user?.app_metadata?.rol === "admin",
    bloqueada: orden.estado === "entregado" || orden.estado === "cancelado",
    contexto,
  };
}
