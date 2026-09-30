import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { hoyBogota, mesActual, mesAnterior, normalizarMes, rangoMes } from "@/lib/caja";
import { AccionesCaja } from "@/components/caja/acciones-caja";
import { BalanceMensual, type FilaBalance } from "@/components/caja/balance-mensual";
import { GastoForm } from "@/components/caja/gasto-form";
import {
  GraficoCategorias,
  totalesVacios,
  type TotalesCategoria,
} from "@/components/caja/grafico-categorias";
import {
  HistorialCaja,
  type CierreVista,
  type MovimientoVista,
} from "@/components/caja/historial-caja";
import { ListaGastos, type EdicionHistorial, type GastoVista } from "@/components/caja/lista-gastos";
import { RentabilidadOrdenes, type FilaRentabilidad } from "@/components/caja/rentabilidad-ordenes";
import { SaldoCajaCard } from "@/components/caja/saldo-caja-card";
import { SelectorMes, hrefCaja, type VistaCaja } from "@/components/caja/selector-mes";
import { Dinero } from "@/components/ui/dinero";
import { etiquetaMes } from "@/lib/caja";

export const metadata: Metadata = { title: "Caja" };

const BUCKET_FACTURAS = "facturas-gastos";
const VIGENCIA_URL_SEGUNDOS = 60 * 60;
const LIMITE_GASTOS = 500;

/** Códigos de PostgREST/Postgres que indican que falta ejecutar una migración SQL. */
const CODIGOS_MIGRACION = new Set(["PGRST205", "PGRST202", "PGRST204", "42P01", "42703"]);

const PESTANAS: { id: VistaCaja; label: string }[] = [
  { id: "gastos", label: "Gastos" },
  { id: "caja", label: "Caja" },
  { id: "balance", label: "Balance" },
];

function esVista(v: string | undefined): v is VistaCaja {
  return v === "caja" || v === "balance" || v === "gastos";
}

function AvisoMigracion() {
  return (
    <p role="alert" className="flex items-start gap-3 rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Falta ejecutar <strong>polo_air_cool_fase4.sql</strong> en Supabase (SQL Editor). Hasta entonces esta pantalla
        no puede leer las tablas nuevas de caja.
      </span>
    </p>
  );
}

export default async function CajaMenorPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string; anulados?: string }>;
}) {
  const sp = await searchParams;
  const vista: VistaCaja = esVista(sp.vista) ? sp.vista : "gastos";
  const mes = normalizarMes(sp.mes);
  const mostrarAnulados = sp.anulados === "1";
  const supabase = await createClient();

  let contenido: React.ReactNode;

  // =====================================================================
  // CAJA: saldo, arqueo y movimientos
  // =====================================================================
  if (vista === "caja") {
    const hoy = hoyBogota();
    const [saldo, dia, cierres, movs] = await Promise.all([
      supabase.rpc("fn_saldo_caja"),
      supabase.from("v_caja_diaria").select("*").eq("fecha", hoy).maybeSingle(),
      supabase
        .from("cierres_caja")
        .select("id, fecha, saldo_sistema, conteo_fisico, diferencia, resultado, autor, notas, anulado, anulado_motivo")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("caja_movimientos")
        .select("id, fecha, tipo, monto, notas, autor, anulado, anulado_motivo, cierre_id")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const errorMigracion = [saldo.error, cierres.error, movs.error].some(
      (e) => e?.code && CODIGOS_MIGRACION.has(e.code)
    );

    const cierreVista: CierreVista[] = (cierres.data ?? []).map((c) => ({
      id: c.id,
      fecha: c.fecha,
      saldoSistema: c.saldo_sistema,
      conteoFisico: c.conteo_fisico,
      diferencia: c.diferencia,
      resultado: c.resultado,
      autor: c.autor,
      notas: c.notas,
      anulado: c.anulado,
      anuladoMotivo: c.anulado_motivo,
    }));
    const movVista: MovimientoVista[] = (movs.data ?? []).map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: m.monto,
      notas: m.notas,
      autor: m.autor,
      anulado: m.anulado,
      anuladoMotivo: m.anulado_motivo,
      deArqueo: m.cierre_id !== null,
    }));
    const saldoActual = Number(saldo.data ?? 0);
    const cerradaHoy = cierreVista.some((c) => c.fecha === hoy && !c.anulado);

    contenido = errorMigracion ? (
      <AvisoMigracion />
    ) : (
      <>
        <SaldoCajaCard
          saldo={saldoActual}
          cerradaHoy={cerradaHoy}
          hoy={{
            entradas: dia.data?.entradas ?? 0,
            cobrosEfectivo: dia.data?.cobros_efectivo ?? 0,
            gastos: dia.data?.gastos ?? 0,
            salidas: dia.data?.salidas ?? 0,
          }}
        />
        <AccionesCaja saldo={saldoActual} cerradaHoy={cerradaHoy} />
        <HistorialCaja cierres={cierreVista} movimientos={movVista} />
      </>
    );
  }

  // =====================================================================
  // BALANCE: base cobrado, gráfica, rentabilidad y exportación
  // =====================================================================
  else if (vista === "balance") {
    const { desde, hasta } = rangoMes(mes);
    const prev = mesAnterior(mes);
    const { desde: desdePrev } = rangoMes(prev);

    const [filaMes, anteriores, cartera, gastos, rentab] = await Promise.all([
      supabase.from("v_balance_real").select("*").eq("mes", `${mes}-01`).maybeSingle(),
      supabase.from("v_balance_real").select("*").lt("mes", `${mes}-01`).order("mes", { ascending: false }).limit(12),
      supabase.from("v_cartera").select("saldo").limit(1000),
      supabase
        .from("gastos_caja_menor")
        .select("fecha, categoria, monto")
        .eq("anulado", false)
        .gte("fecha", desdePrev)
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

    const errorMigracion = [filaMes.error, cartera.error, rentab.error].some(
      (e) => e?.code && CODIGOS_MIGRACION.has(e.code)
    );

    const aFila = (r: NonNullable<typeof filaMes.data>): FilaBalance => ({
      mes: (r.mes ?? "").slice(0, 7),
      facturado: r.facturado ?? 0,
      cobrado: r.cobrado ?? 0,
      costoRepuestos: r.costo_repuestos ?? 0,
      gastos: r.gastos ?? 0,
      utilidadReal: r.utilidad_real ?? 0,
    });

    const actual: FilaBalance = filaMes.data
      ? aFila(filaMes.data)
      : { mes, facturado: 0, cobrado: 0, costoRepuestos: 0, gastos: 0, utilidadReal: 0 };
    const anterioresFilas = (anteriores.data ?? []).map(aFila);

    const totalCartera = (cartera.data ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0);

    const totalesActual: TotalesCategoria = totalesVacios();
    const totalesAnterior: TotalesCategoria = totalesVacios();
    for (const g of gastos.data ?? []) {
      (g.fecha >= desde ? totalesActual : totalesAnterior)[g.categoria] += g.monto;
    }

    const filasRentab: FilaRentabilidad[] = (rentab.data ?? []).flatMap((r) =>
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
    );

    contenido = errorMigracion ? (
      <AvisoMigracion />
    ) : (
      <>
        <BalanceMensual
          actual={actual}
          anteriores={anterioresFilas}
          mes={mes}
          porCobrar={{ total: totalCartera, ordenes: (cartera.data ?? []).length }}
        />

        <section>
          <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            Gastos por categoría
          </h3>
          <GraficoCategorias
            actual={totalesActual}
            anterior={totalesAnterior}
            etiquetaAnterior={etiquetaMes(prev).split(" ")[0]}
          />
        </section>

        <section>
          <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            Rentabilidad por orden
          </h3>
          <RentabilidadOrdenes filas={filasRentab} />
          <p className="mt-2 px-1 text-[12px] text-stone-500">
            Cobrado − costo de repuestos − gastos asignados a la orden. Asigna un gasto a una orden al registrarlo.
          </p>
        </section>
      </>
    );
  }

  // =====================================================================
  // GASTOS: registro express + historial
  // =====================================================================
  else {
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
      .limit(LIMITE_GASTOS);
    if (!mostrarAnulados) consulta = consulta.eq("anulado", false);

    const { data, error } = await consulta;
    const filas = data ?? [];
    const errorMigracion = !!error?.code && CODIGOS_MIGRACION.has(error.code);

    // Bucket privado: se firman URLs temporales de los comprobantes.
    const rutas = filas.flatMap((g) => (g.comprobante_url ? [g.comprobante_url] : []));
    const firmadas = rutas.length
      ? await supabase.storage.from(BUCKET_FACTURAS).createSignedUrls(rutas, VIGENCIA_URL_SEGUNDOS)
      : { data: [] };
    const urlPorRuta = new Map(
      (firmadas.data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : []))
    );

    const gastos: GastoVista[] = filas.map((g) => ({
      id: g.id,
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      comprobanteUrl: g.comprobante_url ? (urlPorRuta.get(g.comprobante_url) ?? null) : null,
      autor: g.autor,
      ordenId: g.orden_id,
      placa: g.ordenes_servicio?.vehiculos?.placa ?? null,
      anulado: g.anulado,
      anuladoMotivo: g.anulado_motivo,
      anuladoAutor: g.anulado_autor,
      historial: Array.isArray(g.historial) ? (g.historial as unknown as EdicionHistorial[]) : [],
    }));

    const vigentes = gastos.filter((g) => !g.anulado);
    const total = vigentes.reduce((s, g) => s + g.monto, 0);
    const hayAnulados = gastos.some((g) => g.anulado);

    contenido = errorMigracion ? (
      <AvisoMigracion />
    ) : (
      <>
        {mes === mesActual() && <GastoForm />}

        <div className="rounded-2xl bg-ink p-5 text-paper">
          <p className="text-[13px] text-stone-400">Gastos de caja menor del mes</p>
          <p className="mt-1 text-3xl">
            <Dinero valor={total} />
          </p>
          <p className="mt-1 text-[12px] text-stone-500">
            {vigentes.length} {vigentes.length === 1 ? "registro" : "registros"}
            {mostrarAnulados && hayAnulados ? ` · ${gastos.length - vigentes.length} anulados a la vista` : ""}
          </p>
        </div>

        {error && !errorMigracion && (
          <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
            No se pudieron cargar los gastos: {error.message}
          </p>
        )}

        <ListaGastos gastos={gastos} />

        <div className="text-center">
          <Link
            href={hrefCaja("gastos", mes, mostrarAnulados ? undefined : { anulados: "1" })}
            replace
            className="text-[13px] text-stone-500 underline underline-offset-2"
          >
            {mostrarAnulados ? "Ocultar gastos anulados" : "Mostrar gastos anulados"}
          </Link>
        </div>

        {gastos.length === LIMITE_GASTOS && (
          <p className="text-center text-xs text-stone-500">Mostrando los últimos {LIMITE_GASTOS} gastos del mes.</p>
        )}
      </>
    );
  }

  return (
    <section className="space-y-4">
      <nav aria-label="Vista de caja" className="grid grid-cols-3 gap-2">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={hrefCaja(p.id, mes)}
            replace
            aria-current={vista === p.id ? "true" : undefined}
            className={`flex h-12 items-center justify-center rounded-xl border text-sm font-medium ${
              vista === p.id
                ? "border-ink bg-ink text-white"
                : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {vista !== "caja" && (
        <SelectorMes mes={mes} vista={vista} extra={mostrarAnulados && vista === "gastos" ? { anulados: "1" } : undefined} />
      )}

      {contenido}
    </section>
  );
}



