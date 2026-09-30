/**
 * Acceso a datos de la pantalla de Caja (gastos, cobros y balance del mes). Cada pestaña tiene su
 * cargador; todas las consultas de una pestaña que no dependen entre sí van en paralelo. Un error
 * de «falta ejecutar la migración» se devuelve como bandera para que la pantalla lo explique.
 */
import type { FilaBalance } from "@/components/caja/balance-mensual";
import type { CobroVista } from "@/components/caja/cobros-mes";
import { totalesVacios, type TotalesCategoria } from "@/components/caja/grafico-categorias";
import type { GastoVista } from "@/components/caja/lista-gastos";
import type { FilaRentabilidad } from "@/components/caja/rentabilidad-ordenes";
import { BUCKET_FACTURAS, VIGENCIA_URL_INTERNA_SEGUNDOS } from "@/lib/almacenamiento";
import { mesAnterior, rangoMes, totalesPorMedio, type TotalesMedio } from "@/lib/caja";
import { edicionesHistorial } from "@/lib/datos/mapeo";
import { firmarRutas } from "@/lib/datos/firmar";
import { esErrorDeMigracion } from "@/lib/errores";
import type { ClienteServidor } from "@/utils/supabase/sesion";

// ---------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------

export type CargaGastos = {
  gastos: GastoVista[];
  error: string | null;
  errorMigracion: boolean;
};

export async function cargarGastosMes(
  supabase: ClienteServidor,
  mes: string,
  opciones: { incluirAnulados: boolean; limite: number }
): Promise<CargaGastos> {
  const { desde, hasta } = rangoMes(mes);
  let consulta = supabase
    .from("gastos_caja_menor")
    .select(
      "id, fecha, categoria, descripcion, monto, comprobante_url, autor, orden_id, anulado, anulado_motivo, anulado_autor, historial, ordenes_servicio(vehiculos(placa))"
    )
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opciones.limite);
  if (!opciones.incluirAnulados) consulta = consulta.eq("anulado", false);

  const { data, error } = await consulta;
  const filas = data ?? [];

  // Bucket privado: URLs temporales de los comprobantes.
  const urls = await firmarRutas(
    supabase,
    BUCKET_FACTURAS,
    filas.flatMap((g) => (g.comprobante_url ? [g.comprobante_url] : [])),
    VIGENCIA_URL_INTERNA_SEGUNDOS
  );

  return {
    gastos: filas.map((g) => ({
      id: g.id,
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      comprobanteUrl: g.comprobante_url ? (urls.get(g.comprobante_url) ?? null) : null,
      autor: g.autor,
      ordenId: g.orden_id,
      placa: g.ordenes_servicio?.vehiculos?.placa ?? null,
      anulado: g.anulado,
      anuladoMotivo: g.anulado_motivo,
      anuladoAutor: g.anulado_autor,
      historial: edicionesHistorial(g.historial),
    })),
    error: error?.message ?? null,
    errorMigracion: esErrorDeMigracion(error),
  };
}

// ---------------------------------------------------------------------
// Cobros por medio de pago
// ---------------------------------------------------------------------

export type CargaCobros = {
  totales: TotalesMedio;
  /** Los cobros más recientes (detalle); los totales cuentan todos los del mes. */
  cobros: CobroVista[];
  error: string | null;
  errorMigracion: boolean;
};

export async function cargarCobrosMes(
  supabase: ClienteServidor,
  mes: string,
  limiteDetalle = 100
): Promise<CargaCobros> {
  const { desde, hasta } = rangoMes(mes);
  const { data, error } = await supabase
    .from("pagos_orden")
    .select(
      "id, orden_id, fecha, monto, medio, es_devolucion, referencia, anulado, ordenes_servicio(vehiculos(placa, clientes(nombre)))"
    )
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .eq("anulado", false)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const pagos = data ?? [];
  return {
    totales: totalesPorMedio(pagos),
    cobros: pagos.slice(0, limiteDetalle).map((p) => ({
      id: p.id,
      ordenId: p.orden_id,
      fecha: p.fecha,
      placa: p.ordenes_servicio?.vehiculos?.placa ?? null,
      cliente: p.ordenes_servicio?.vehiculos?.clientes?.nombre ?? null,
      medio: p.medio,
      monto: p.monto,
      esDevolucion: p.es_devolucion,
      referencia: p.referencia,
    })),
    error: error?.message ?? null,
    errorMigracion: esErrorDeMigracion(error),
  };
}

// ---------------------------------------------------------------------
// Balance del mes
// ---------------------------------------------------------------------

export type CargaBalance = {
  actual: FilaBalance;
  anteriores: FilaBalance[];
  porCobrar: { total: number; ordenes: number };
  totalesActual: TotalesCategoria;
  totalesAnterior: TotalesCategoria;
  /** Mes anterior (YYYY-MM), para rotular la comparación de gastos. */
  mesAnterior: string;
  rentabilidad: FilaRentabilidad[];
  errorMigracion: boolean;
};

type FilaBalanceReal = {
  mes: string | null;
  facturado: number | null;
  cobrado: number | null;
  costo_repuestos: number | null;
  gastos: number | null;
  utilidad_real: number | null;
};

const aFilaBalance = (r: FilaBalanceReal): FilaBalance => ({
  mes: (r.mes ?? "").slice(0, 7),
  facturado: r.facturado ?? 0,
  cobrado: r.cobrado ?? 0,
  costoRepuestos: r.costo_repuestos ?? 0,
  gastos: r.gastos ?? 0,
  utilidadReal: r.utilidad_real ?? 0,
});

export async function cargarBalanceMes(supabase: ClienteServidor, mes: string): Promise<CargaBalance> {
  const { desde, hasta } = rangoMes(mes);
  const previo = mesAnterior(mes);
  const { desde: desdePrevio } = rangoMes(previo);

  const [filaMes, anteriores, cartera, gastos, rentabilidad] = await Promise.all([
    supabase.from("v_balance_real").select("*").eq("mes", `${mes}-01`).maybeSingle(),
    supabase.from("v_balance_real").select("*").lt("mes", `${mes}-01`).order("mes", { ascending: false }).limit(12),
    supabase.from("v_cartera").select("saldo").limit(1000),
    supabase
      .from("gastos_caja_menor")
      .select("fecha, categoria, monto")
      .eq("anulado", false)
      .gte("fecha", desdePrevio)
      .lt("fecha", hasta),
    supabase
      .from("v_rentabilidad_orden")
      .select("orden_id, placa, cliente, pagado, costo_repuestos, gastos_directos, utilidad_real")
      .eq("estado", "entregado")
      .gte("fecha_entrega", `${desde}T00:00:00-05:00`)
      .lt("fecha_entrega", `${hasta}T00:00:00-05:00`)
      .order("fecha_entrega", { ascending: false })
      .limit(10),
  ]);

  const totalesActual = totalesVacios();
  const totalesAnterior = totalesVacios();
  for (const g of gastos.data ?? []) {
    (g.fecha >= desde ? totalesActual : totalesAnterior)[g.categoria] += g.monto;
  }

  return {
    actual: filaMes.data
      ? aFilaBalance(filaMes.data)
      : { mes, facturado: 0, cobrado: 0, costoRepuestos: 0, gastos: 0, utilidadReal: 0 },
    anteriores: (anteriores.data ?? []).map(aFilaBalance),
    porCobrar: {
      total: (cartera.data ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0),
      ordenes: (cartera.data ?? []).length,
    },
    totalesActual,
    totalesAnterior,
    mesAnterior: previo,
    rentabilidad: (rentabilidad.data ?? []).flatMap((r) =>
      r.orden_id
        ? [
            {
              ordenId: r.orden_id,
              placa: r.placa ?? "",
              cliente: r.cliente ?? "",
              cobrado: r.pagado ?? 0,
              costoRepuestos: r.costo_repuestos ?? 0,
              gastosDirectos: r.gastos_directos ?? 0,
              utilidadReal: r.utilidad_real ?? 0,
            },
          ]
        : []
    ),
    errorMigracion: [filaMes.error, cartera.error, rentabilidad.error].some((e) => esErrorDeMigracion(e)),
  };
}
