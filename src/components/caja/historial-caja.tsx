"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Ban, Printer } from "lucide-react";
import { anularCierre, anularMovimientoCaja } from "@/app/(app)/caja-menor/actions";
import { Dinero } from "@/components/ui/dinero";
import { FormularioAnulacion } from "@/components/ui/dialogo-motivo";
import { Drawer } from "@/components/ui/drawer";
import { useSync } from "@/components/sync/sync-provider";
import { RESULTADO_LABEL } from "@/lib/arqueo";
import { inicialAutor } from "@/lib/autor";
import { etiquetaDia } from "@/lib/caja";
import type { Autor, ResultadoCierre, TipoMovCaja } from "@/types/database";

export type CierreVista = {
  id: string;
  fecha: string;
  saldoSistema: number;
  conteoFisico: number;
  diferencia: number;
  resultado: ResultadoCierre;
  autor: Autor | null;
  notas: string | null;
  anulado: boolean;
  anuladoMotivo: string | null;
};

export type MovimientoVista = {
  id: string;
  fecha: string;
  tipo: TipoMovCaja;
  monto: number;
  notas: string | null;
  autor: Autor | null;
  anulado: boolean;
  anuladoMotivo: string | null;
  /** Ajuste generado por un arqueo: no se anula suelto. */
  deArqueo: boolean;
};

const TIPO_LABEL: Record<TipoMovCaja, string> = {
  fondo_inicial: "Fondo inicial",
  reposicion: "Reposición",
  retiro: "Retiro",
  ajuste_sobrante: "Ajuste por sobrante",
  ajuste_faltante: "Ajuste por faltante",
};
const ES_ENTRADA: Record<TipoMovCaja, boolean> = {
  fondo_inicial: true,
  reposicion: true,
  retiro: false,
  ajuste_sobrante: true,
  ajuste_faltante: false,
};
const ESTILO_RESULTADO: Record<ResultadoCierre, string> = {
  cuadrado: "bg-sage-100 text-sage-800",
  faltante: "bg-brick-100 text-brick-700",
  sobrante: "bg-ochre-100 text-ochre-800",
};

type Anulando = { tipo: "cierre" | "movimiento"; id: string; texto: string } | null;

const numero = new Intl.NumberFormat("es-CO");

/** Cierres y movimientos recientes de la caja, con anulación auditada (nada se borra). */
export function HistorialCaja({
  cierres,
  movimientos,
}: {
  cierres: CierreVista[];
  movimientos: MovimientoVista[];
}) {
  const { online } = useSync();
  const [anulando, setAnulando] = useState<Anulando>(null);
  const cerrar = useCallback(() => setAnulando(null), []);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
          Cierres recientes
        </h3>
        {cierres.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
            Aún no hay cierres de caja.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {cierres.map((c) => (
              <li key={c.id} className="space-y-1 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[15px] font-medium ${c.anulado ? "text-stone-400 line-through" : ""}`}>
                    {etiquetaDia(c.fecha)}
                  </p>
                  {c.anulado ? (
                    <span className="rounded-full bg-brick-50 px-2 py-0.5 text-[11px] font-medium text-brick-700">
                      Anulado
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ESTILO_RESULTADO[c.resultado]}`}
                    >
                      {RESULTADO_LABEL[c.resultado]}
                      {c.diferencia !== 0 && ` · ${c.diferencia > 0 ? "+" : ""}${numero.format(c.diferencia)}`}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-stone-500">
                  Sistema <Dinero valor={c.saldoSistema} /> · Conteo <Dinero valor={c.conteoFisico} /> ·{" "}
                  <span title={c.autor ?? ""}>{inicialAutor(c.autor)}</span>
                </p>
                {c.notas && <p className="text-[13px] text-stone-600">{c.notas}</p>}
                {c.anulado && c.anuladoMotivo && (
                  <p className="text-[13px] text-brick-700">Motivo: {c.anuladoMotivo}</p>
                )}
                {!c.anulado && (
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/caja-menor/cierre/${c.id}`}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-300/70 px-3 text-[13px] font-medium active:bg-stone-100"
                    >
                      <Printer className="size-3.5" aria-hidden /> Comprobante
                    </Link>
                    <button
                      type="button"
                      disabled={!online}
                      onClick={() => setAnulando({ tipo: "cierre", id: c.id, texto: `Cierre del ${c.fecha}` })}
                      className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-stone-500 active:bg-stone-100 disabled:opacity-40"
                    >
                      <Ban className="size-3.5" aria-hidden /> Anular
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
          Movimientos de efectivo
        </h3>
        {movimientos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
            Sin movimientos. Registra el fondo inicial para empezar.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] font-medium ${m.anulado ? "text-stone-400 line-through" : ""}`}>
                    {TIPO_LABEL[m.tipo]}
                  </p>
                  <p className="truncate text-[13px] text-stone-500">
                    {etiquetaDia(m.fecha)} · {inicialAutor(m.autor)}
                    {m.notas ? ` · ${m.notas}` : ""}
                    {m.anulado && m.anuladoMotivo ? ` · Anulado: ${m.anuladoMotivo}` : ""}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-[15px] ${
                    m.anulado ? "text-stone-400 line-through" : ES_ENTRADA[m.tipo] ? "" : "text-brick-700"
                  }`}
                >
                  {ES_ENTRADA[m.tipo] ? "+" : "−"}
                  <Dinero valor={m.monto} />
                </p>
                {!m.anulado && !m.deArqueo && (
                  <button
                    type="button"
                    disabled={!online}
                    aria-label="Anular movimiento"
                    onClick={() => setAnulando({ tipo: "movimiento", id: m.id, texto: TIPO_LABEL[m.tipo] })}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:text-brick-600 active:text-brick-600 disabled:opacity-40"
                  >
                    <Ban className="size-4" strokeWidth={1.5} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {anulando && (
        <Drawer titulo={`Anular: ${anulando.texto}`} onClose={cerrar}>
          <FormularioAnulacion
            advertencia={
              anulando.tipo === "cierre"
                ? "El cierre queda anulado (con su ajuste) y podrás rehacerlo. El saldo vuelve al valor anterior al arqueo."
                : "El movimiento queda anulado con su motivo y deja de contar en el saldo."
            }
            onConfirmar={(motivo) =>
              anulando.tipo === "cierre"
                ? anularCierre({ id: anulando.id, motivo })
                : anularMovimientoCaja({ id: anulando.id, motivo })
            }
            onListo={cerrar}
          />
        </Drawer>
      )}
    </div>
  );
}
