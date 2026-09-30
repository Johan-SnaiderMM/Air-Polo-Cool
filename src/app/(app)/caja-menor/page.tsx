import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { BalanceMensual } from "@/components/caja/balance-mensual";
import { CobrosMes } from "@/components/caja/cobros-mes";
import { GastoForm } from "@/components/caja/gasto-form";
import { GraficoCategorias } from "@/components/caja/grafico-categorias";
import { ListaGastos } from "@/components/caja/lista-gastos";
import { RentabilidadOrdenes } from "@/components/caja/rentabilidad-ordenes";
import { SelectorMes, hrefCaja, type VistaCaja } from "@/components/caja/selector-mes";
import { Dinero } from "@/components/ui/dinero";
import { etiquetaMes, mesActual, normalizarMes } from "@/lib/caja";
import { cargarBalanceMes, cargarCobrosMes, cargarGastosMes } from "@/lib/datos/caja";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export const metadata: Metadata = { title: "Caja" };

const LIMITE_GASTOS = 500;

const PESTANAS: { id: VistaCaja; label: string }[] = [
  { id: "gastos", label: "Gastos" },
  { id: "cobros", label: "Cobros" },
  { id: "balance", label: "Balance" },
];

function esVista(v: string | undefined): v is VistaCaja {
  return v === "cobros" || v === "balance" || v === "gastos";
}

function AvisoMigracion() {
  return (
    <p role="alert" className="flex items-start gap-3 rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Falta ejecutar la migración de la <strong>fase 4</strong> (supabase/migrations) en Supabase (SQL Editor). Hasta entonces esta pantalla
        no puede leer las tablas nuevas de caja.
      </span>
    </p>
  );
}

function ErrorCarga({ texto }: { texto: string }) {
  return (
    <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
      {texto}
    </p>
  );
}

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">{children}</h3>
);

// ---------------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------------

/** COBROS: lo cobrado en el mes por medio de pago (efectivo / transferencia). */
async function PestanaCobros({ supabase, mes }: { supabase: ClienteServidor; mes: string }) {
  const { totales, cobros, error, errorMigracion } = await cargarCobrosMes(supabase, mes);
  if (errorMigracion) return <AvisoMigracion />;
  return (
    <>
      <CobrosMes totales={totales} cobros={cobros} />
      {error && <ErrorCarga texto={`No se pudieron cargar los cobros: ${error}`} />}
    </>
  );
}

/** BALANCE: base cobrado, gráfica por categoría, rentabilidad y exportación. */
async function PestanaBalance({ supabase, mes }: { supabase: ClienteServidor; mes: string }) {
  const b = await cargarBalanceMes(supabase, mes);
  if (b.errorMigracion) return <AvisoMigracion />;
  return (
    <>
      <BalanceMensual actual={b.actual} anteriores={b.anteriores} mes={mes} porCobrar={b.porCobrar} />

      <section>
        <Titulo>Gastos por categoría</Titulo>
        <GraficoCategorias
          actual={b.totalesActual}
          anterior={b.totalesAnterior}
          etiquetaAnterior={etiquetaMes(b.mesAnterior).split(" ")[0]}
        />
      </section>

      <section>
        <Titulo>Rentabilidad por orden</Titulo>
        <RentabilidadOrdenes filas={b.rentabilidad} />
        <p className="mt-2 px-1 text-[12px] text-stone-500">
          Cobrado − costo de repuestos − gastos asignados a la orden. Asigna un gasto a una orden al registrarlo.
        </p>
      </section>
    </>
  );
}

/** GASTOS: registro express + historial. */
async function PestanaGastos({
  supabase,
  mes,
  mostrarAnulados,
}: {
  supabase: ClienteServidor;
  mes: string;
  mostrarAnulados: boolean;
}) {
  const { gastos, error, errorMigracion } = await cargarGastosMes(supabase, mes, {
    incluirAnulados: mostrarAnulados,
    limite: LIMITE_GASTOS,
  });
  if (errorMigracion) return <AvisoMigracion />;

  const vigentes = gastos.filter((g) => !g.anulado);
  const total = vigentes.reduce((s, g) => s + g.monto, 0);
  const hayAnulados = gastos.some((g) => g.anulado);

  return (
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

      {error && <ErrorCarga texto={`No se pudieron cargar los gastos: ${error}`} />}

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

      <SelectorMes mes={mes} vista={vista} extra={mostrarAnulados && vista === "gastos" ? { anulados: "1" } : undefined} />

      {vista === "cobros" ? (
        <PestanaCobros supabase={supabase} mes={mes} />
      ) : vista === "balance" ? (
        <PestanaBalance supabase={supabase} mes={mes} />
      ) : (
        <PestanaGastos supabase={supabase} mes={mes} mostrarAnulados={mostrarAnulados} />
      )}
    </section>
  );
}
