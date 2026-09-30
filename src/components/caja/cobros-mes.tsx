import Link from "next/link";
import { Dinero } from "@/components/ui/dinero";
import { MEDIO_PAGO_LABEL, type TotalesMedio } from "@/lib/caja";
import { formatearFechaCorta } from "@/lib/ordenes";
import type { MedioPago } from "@/types/database";

export type CobroVista = {
  id: string;
  ordenId: string;
  fecha: string;
  placa: string | null;
  cliente: string | null;
  medio: MedioPago;
  monto: number;
  esDevolucion: boolean;
  referencia: string | null;
};

const MEDIOS_VISIBLES: MedioPago[] = ["efectivo", "transferencia"];

/**
 * Cobros del mes por medio de pago. No hay "saldo de caja": solo cómo entró la plata
 * (efectivo, transferencia…) y el detalle de cada cobro con su orden.
 */
export function CobrosMes({ totales, cobros }: { totales: TotalesMedio; cobros: CobroVista[] }) {
  const otros = totales.tarjeta + totales.otro;
  const filas: { etiqueta: string; valor: number }[] = [
    ...MEDIOS_VISIBLES.map((m) => ({ etiqueta: MEDIO_PAGO_LABEL[m], valor: totales[m] })),
    ...(otros !== 0 ? [{ etiqueta: "Tarjeta / otros", valor: otros }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-ink p-6 text-paper">
        <p className="text-[13px] text-stone-400">Cobrado en el mes</p>
        <p className="mt-2 text-[34px] leading-none font-medium tracking-tight">
          <Dinero valor={totales.total} />
        </p>
        <p className="mt-2 text-[12px] text-stone-500">Neto de devoluciones</p>
      </div>

      <div className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-baseline justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[15px] font-medium">{f.etiqueta}</p>
              <p className="font-mono text-[12px] text-stone-500 tabular-nums">
                {totales.total > 0 ? Math.round((f.valor / totales.total) * 100) : 0} %
              </p>
            </div>
            <Dinero valor={f.valor} className="text-[19px]" />
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
          Detalle de cobros
        </h3>
        {cobros.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            Aún no hay cobros este mes.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
            {cobros.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/ordenes/${c.ordenId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors active:bg-stone-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px]">
                      <span className="font-mono font-semibold tracking-wider">{c.placa ?? "—"}</span>
                      {c.cliente ? <span className="text-stone-500"> · {c.cliente}</span> : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[12px] text-stone-500">
                      {formatearFechaCorta(`${c.fecha}T12:00:00-05:00`)}
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          c.medio === "efectivo" ? "bg-sage-100 text-sage-800" : "bg-accent-100 text-accent-700"
                        }`}
                      >
                        {MEDIO_PAGO_LABEL[c.medio]}
                      </span>
                      {c.esDevolucion && <span className="text-brick-700">Devolución</span>}
                      {c.referencia && <span className="truncate">Ref. {c.referencia}</span>}
                    </p>
                  </div>
                  <Dinero
                    valor={c.esDevolucion ? -c.monto : c.monto}
                    className={`shrink-0 text-[16px] ${c.esDevolucion ? "text-brick-600" : ""}`}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
