import { Dinero } from "@/components/ui/dinero";

/**
 * Saldo disponible de la caja física (efectivo). Tarjeta carbón con la cifra en mono
 * y, debajo, lo que se movió HOY: entradas, cobros en efectivo, gastos y retiros.
 */
export function SaldoCajaCard({
  saldo,
  hoy,
  cerradaHoy,
}: {
  saldo: number;
  hoy: { entradas: number; cobrosEfectivo: number; gastos: number; salidas: number };
  cerradaHoy: boolean;
}) {
  const filas: { etiqueta: string; valor: number; signo: "+" | "−" }[] = [
    { etiqueta: "Entradas (fondo / reposición)", valor: hoy.entradas, signo: "+" },
    { etiqueta: "Cobros en efectivo", valor: hoy.cobrosEfectivo, signo: "+" },
    { etiqueta: "Gastos", valor: hoy.gastos, signo: "−" },
    { etiqueta: "Retiros", valor: hoy.salidas, signo: "−" },
  ];

  return (
    <div className="rounded-2xl bg-ink p-6 text-paper">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-stone-400">Saldo disponible en caja</p>
        {cerradaHoy && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-ice-300">Cerrada hoy</span>
        )}
      </div>
      <p className={`mt-2 text-[34px] leading-none font-medium tracking-tight ${saldo < 0 ? "text-brick-300" : ""}`}>
        <Dinero valor={saldo} />
      </p>

      <dl className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-[13px]">
        <dt className="mb-1 text-[11px] tracking-[0.08em] text-stone-500 uppercase">Hoy</dt>
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-baseline justify-between gap-3">
            <dd className="text-stone-400">{f.etiqueta}</dd>
            <dd className="font-mono text-stone-200 tabular-nums">
              {f.signo}
              <Dinero valor={f.valor} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[12px] text-stone-500">
        Las transferencias y pagos con tarjeta cuentan en el balance, pero no en la caja física.
      </p>
    </div>
  );
}
