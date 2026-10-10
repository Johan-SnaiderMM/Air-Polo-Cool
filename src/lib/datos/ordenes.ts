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
import { redondearDinero } from "@/lib/inventario";
import {
  armarComprobante,
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
  /** Con el filtro «Deben»: suma de lo que deben las órdenes listadas (0 sin ese filtro). */
  totalDeben: number;
  error: string | null;
};

/** Con «Deben»: tope de órdenes con saldo que se piden (sus ids viajan en la URL de la consulta siguiente). */
export const LIMITE_DEBEN = 100;

export async function listarOrdenes(
  supabase: ClienteServidor,
  filtros: { q: string; estado?: EstadoOrden; limite: number; soloDeben?: boolean }
): Promise<ListaOrdenes> {
  // Los saldos no dependen de la búsqueda: se piden a la vez que la lista.
  const saldosPendientes = supabase.from("v_saldo_ordenes").select("orden_id, saldo").gt("saldo", 0).limit(1000);

  // «Deben»: solo las órdenes con saldo por cobrar (la misma definición de la pantalla Por cobrar: no
  // canceladas, con total y saldo > 0). Las más antiguas primero, que son las que hay que cobrar ya.
  let idsConSaldo: string[] | null = null;
  if (filtros.soloDeben) {
    const { data: cartera, error: errorCartera } = await supabase
      .from("v_cartera")
      .select("orden_id")
      .order("fecha_entrega", { ascending: true, nullsFirst: false })
      .limit(LIMITE_DEBEN);
    if (errorCartera) return { ordenes: [], saldoDe: new Map(), totalDeben: 0, error: errorCartera.message };
    idsConSaldo = (cartera ?? []).flatMap((c) => (c.orden_id ? [c.orden_id] : []));
  }

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
  const hayCandidatas = (ids === null || ids.length > 0) && (idsConSaldo === null || idsConSaldo.length > 0);
  if (hayCandidatas) {
    let consulta = supabase
      .from("ordenes_servicio")
      .select(SELECT_ORDEN_RESUMEN)
      .order("fecha_ingreso", { ascending: !!idsConSaldo })
      .limit(filtros.limite);
    if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
    if (ids) consulta = consulta.in("vehiculo_id", ids);
    if (idsConSaldo) consulta = consulta.in("id", idsConSaldo);
    const { data, error: errorConsulta } = await consulta;
    if (errorConsulta) error = errorConsulta.message;
    ordenes = data ?? [];
  }

  const { data: saldos } = await saldosPendientes;
  const saldoDe = new Map(
    (saldos ?? []).flatMap((x) => (x.orden_id && x.saldo !== null ? [[x.orden_id, x.saldo] as const] : []))
  );

  const totalDeben = filtros.soloDeben ? ordenes.reduce((s, o) => s + (saldoDe.get(o.id) ?? 0), 0) : 0;
  return { ordenes, saldoDe, totalDeben, error };
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
    .select("id, nombre, tipo, cantidad_usada, costo_unitario, precio_unitario, inventario(nombre, codigo, tipo_unidad)")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Repuestos comprados aparte para esta orden: los egresos de categoría «repuesto» que se registran al subir
 * la foto del repuesto instalado. Si la fase 11 aún no está ejecutada la categoría no existe y la consulta
 * falla: se cuenta como 0 en vez de romper la pantalla.
 */
async function consultarRepuestosAparte(supabase: ClienteServidor, id: string): Promise<number> {
  const { data, error } = await supabase
    .from("gastos_caja_menor")
    .select("monto")
    .eq("orden_id", id)
    .eq("categoria", "repuesto")
    .eq("anulado", false);
  if (error) return 0;
  return redondearDinero((data ?? []).reduce((s, g) => s + g.monto, 0));
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
  /** Solo repuestos (los «otros cargos» van en `cargos`). */
  lineas: LineaRepuesto[];
  /** Otros cargos al cliente: gasolina, flete, parqueadero… */
  cargos: LineaRepuesto[];
  repuestosPrecio: number;
  repuestosCosto: number;
  /** Lo que se cobra y lo que costaron los otros cargos. */
  cargosPrecio: number;
  cargosCosto: number;
  /** Egresos de «repuesto» comprados aparte para esta orden (no están en el inventario). */
  repuestosAparte: number;
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
  const [orden, filasEvidencias, filasRepuestos, filasPagos, repuestosAparte, sesion, contexto] = await Promise.all([
    consultarOrden(supabase, id),
    consultarEvidencias(supabase, id),
    consultarRepuestos(supabase, id),
    consultarPagos(supabase, id),
    consultarRepuestosAparte(supabase, id),
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

  const filasDe = (tipo: "repuesto" | "cargo") => filasRepuestos.filter((f) => (f.tipo ?? "repuesto") === tipo);
  const repuestos = totalesRepuestos(filasDe("repuesto"));
  const cargos = totalesRepuestos(filasDe("cargo"));
  return {
    orden,
    lineas: armarLineas(filasDe("repuesto")),
    cargos: armarLineas(filasDe("cargo")),
    repuestosPrecio: repuestos.precio,
    repuestosCosto: repuestos.costo,
    cargosPrecio: cargos.precio,
    cargosCosto: cargos.costo,
    repuestosAparte,
    pagos: armarPagos(filasPagos, urlsPagos),
    saldoPendiente: saldoPendiente(orden.total_cobrado, filasPagos),
    historial: lineasHistorial(orden.notas),
    evidencias: armarEvidencias(filasEvidencias, urlsFotos),
    esAdmin: sesion.data.user?.app_metadata?.rol === "admin",
    bloqueada: orden.estado === "entregado" || orden.estado === "cancelado",
    contexto,
  };
}

// ---------------------------------------------------------------------
// Comprobante imprimible (orden y garantía)
// ---------------------------------------------------------------------

async function consultarOrdenComprobante(supabase: ClienteServidor, id: string) {
  const { data } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, vehiculos(placa, marca, modelo, anio, tipo_gas_sugerido, carga_estandar_gramos, clientes(nombre, telefono, documento))"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type OrdenComprobante = NonNullable<Awaited<ReturnType<typeof consultarOrdenComprobante>>>;

/** La orden con sus cifras para imprimir; null si no existe. Las tres consultas van a la vez. */
export async function cargarComprobanteOrden(supabase: ClienteServidor, id: string) {
  const [orden, repuestos, pagos] = await Promise.all([
    consultarOrdenComprobante(supabase, id),
    supabase
      .from("orden_repuestos")
      .select("nombre, cantidad_usada, precio_unitario, inventario(nombre, tipo_unidad)")
      .eq("orden_id", id)
      .order("created_at"),
    supabase.from("pagos_orden").select("monto, es_devolucion").eq("orden_id", id).eq("anulado", false),
  ]);
  if (!orden) return null;
  return { orden, ...armarComprobante(orden, repuestos.data ?? [], pagos.data ?? []) };
}
