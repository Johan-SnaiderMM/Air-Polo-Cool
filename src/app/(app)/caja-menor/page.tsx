import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { mesActual, normalizarMes, rangoMes } from "@/lib/caja";
import { GastoForm } from "@/components/caja/gasto-form";
import { ListaGastos, type GastoVista } from "@/components/caja/lista-gastos";
import { SelectorMes, hrefCaja } from "@/components/caja/selector-mes";
import { BalanceMensual, type FilaBalance } from "@/components/caja/balance-mensual";
import type { Views } from "@/types/database";

import { Dinero } from "@/components/ui/dinero";
export const metadata: Metadata = { title: "Caja menor" };

const BUCKET_FACTURAS = "facturas-gastos";
const VIGENCIA_URL_SEGUNDOS = 60 * 60;
const LIMITE_GASTOS = 500;

function aFila(r: Views<"v_balance_mensual">): FilaBalance | null {
  if (!r.mes) return null;
  return {
    mes: r.mes.slice(0, 7),
    ingresos: r.ingresos ?? 0,
    costoRepuestos: r.costo_repuestos ?? 0,
    gastosCajaMenor: r.gastos_caja_menor ?? 0,
    utilidadReal: r.utilidad_real ?? 0,
  };
}

export default async function CajaMenorPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string }>;
}) {
  const { vista: vistaCruda, mes: mesCrudo } = await searchParams;
  const vista = vistaCruda === "balance" ? "balance" : "gastos";
  const mes = normalizarMes(mesCrudo);

  const supabase = await createClient();
  const pestanas = [
    { id: "gastos" as const, label: "Gastos" },
    { id: "balance" as const, label: "Balance" },
  ];

  let contenido: React.ReactNode;

  if (vista === "balance") {
    const [{ data: filaMes, error }, { data: filas }] = await Promise.all([
      supabase
        .from("v_balance_mensual")
        .select("*")
        .eq("mes", `${mes}-01`)
        .maybeSingle(),
      supabase
        .from("v_balance_mensual")
        .select("*")
        .order("mes", { ascending: false })
        .limit(12),
    ]);

    const actual: FilaBalance = (filaMes && aFila(filaMes)) || {
      mes,
      ingresos: 0,
      costoRepuestos: 0,
      gastosCajaMenor: 0,
      utilidadReal: 0,
    };
    const historial = (filas ?? []).flatMap((r) => {
      const f = aFila(r);
      return f ? [f] : [];
    });

    contenido = (
      <>
        {error && (
          <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
            No se pudo cargar el balance: {error.message}
          </p>
        )}
        <BalanceMensual actual={actual} historial={historial} mes={mes} />
      </>
    );
  } else {
    const { desde, hasta } = rangoMes(mes);
    const [{ data, error }, { data: sesion }] = await Promise.all([
      supabase
        .from("gastos_caja_menor")
        .select("id, fecha, categoria, descripcion, monto, comprobante_url")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(LIMITE_GASTOS),
      supabase.auth.getUser(),
    ]);

    const filas = data ?? [];

    // Bucket privado: se firman URLs temporales de los comprobantes.
    const rutas = filas.flatMap((g) => (g.comprobante_url ? [g.comprobante_url] : []));
    const firmadas = rutas.length
      ? await supabase.storage
          .from(BUCKET_FACTURAS)
          .createSignedUrls(rutas, VIGENCIA_URL_SEGUNDOS)
      : { data: [] };
    const urlPorRuta = new Map(
      (firmadas.data ?? []).flatMap((s) =>
        s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : []
      )
    );

    const gastos: GastoVista[] = filas.map((g) => ({
      id: g.id,
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      comprobanteUrl: g.comprobante_url ? (urlPorRuta.get(g.comprobante_url) ?? null) : null,
    }));
    const total = gastos.reduce((s, g) => s + g.monto, 0);
    const esAdmin = sesion.user?.app_metadata?.rol === "admin";

    contenido = (
      <>
        {mes === mesActual() && <GastoForm />}

        <div className="rounded-2xl bg-ink p-4 text-white">
          <p className="text-sm opacity-80">Gastos de caja menor del mes</p>
          <p className="text-3xl font-semibold"><Dinero valor={total} /></p>
          <p className="text-xs opacity-70">
            {gastos.length} {gastos.length === 1 ? "registro" : "registros"}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
            No se pudieron cargar los gastos: {error.message}
          </p>
        )}

        <ListaGastos gastos={gastos} puedeEliminar={esAdmin} />

        {gastos.length === LIMITE_GASTOS && (
          <p className="text-center text-xs text-stone-500">
            Mostrando los últimos {LIMITE_GASTOS} gastos del mes.
          </p>
        )}
      </>
    );
  }

  return (
    <section className="space-y-4">
      <nav aria-label="Vista de caja menor" className="grid grid-cols-2 gap-2">
        {pestanas.map((p) => (
          <Link
            key={p.id}
            href={hrefCaja(p.id, mes)}
            replace
            aria-current={vista === p.id ? "true" : undefined}
            className={`flex h-12 items-center justify-center rounded-xl border text-sm font-semibold ${
              vista === p.id
                ? "border-ink bg-ink text-white"
                : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <SelectorMes mes={mes} vista={vista} />

      {contenido}
    </section>
  );
}
