"use client";

import { useCallback, useState } from "react";
import { ArrowDownToLine, Calculator, HandCoins } from "lucide-react";
import { ArqueoDrawer } from "@/components/caja/arqueo-drawer";
import { MovimientoCajaDrawer } from "@/components/caja/movimiento-caja-drawer";
import type { TipoMovManual } from "@/lib/offline/operaciones";

type Panel = { tipo: "movimiento"; inicial: TipoMovManual } | { tipo: "arqueo" } | null;

/** Botones de la pestaña Caja: reponer / fondo / retiro y arqueo. */
export function AccionesCaja({ saldo, cerradaHoy }: { saldo: number; cerradaHoy: boolean }) {
  const [panel, setPanel] = useState<Panel>(null);
  const cerrar = useCallback(() => setPanel(null), []);

  const boton =
    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-stone-200/80 bg-white text-[12px] font-medium text-ink transition-colors active:bg-stone-50";

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={boton} onClick={() => setPanel({ tipo: "movimiento", inicial: "reposicion" })}>
          <HandCoins className="size-[18px]" strokeWidth={1.5} aria-hidden /> Reposición
        </button>
        <button type="button" className={boton} onClick={() => setPanel({ tipo: "movimiento", inicial: "retiro" })}>
          <ArrowDownToLine className="size-[18px]" strokeWidth={1.5} aria-hidden /> Retiro
        </button>
        <button
          type="button"
          className={`${boton} ${cerradaHoy ? "" : "border-ink"}`}
          onClick={() => setPanel({ tipo: "arqueo" })}
        >
          <Calculator className="size-[18px]" strokeWidth={1.5} aria-hidden /> {cerradaHoy ? "Re-cerrar" : "Cerrar caja"}
        </button>
      </div>

      {panel?.tipo === "movimiento" && <MovimientoCajaDrawer tipoInicial={panel.inicial} onClose={cerrar} />}
      {panel?.tipo === "arqueo" && <ArqueoDrawer saldoInicial={saldo} onClose={cerrar} />}
    </>
  );
}
