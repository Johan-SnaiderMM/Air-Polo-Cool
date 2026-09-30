"use client";

import { useCallback, useState } from "react";
import { ShieldCheck, Snowflake } from "lucide-react";
import {
  PERTENENCIAS_VACIAS,
  PertenenciasChecklist,
} from "@/components/ordenes/pertenencias-checklist";
import { SelectorEstado } from "@/components/ordenes/selector-estado";
import { SelectorMantenimiento } from "@/components/ordenes/selector-mantenimiento";
import { Colapsable } from "@/components/ui/colapsable";
import { resumenNotasTecnicas, resumenPertenencias } from "@/lib/pertenencias";
import { OPCIONES_GARANTIA, calcularFinGarantia, formatearFechaDate } from "@/lib/ordenes";
import type { OrdenFormValores } from "@/lib/orden-nueva";

/**
 * Piezas COMPARTIDAS por «crear orden» y «editar orden». Cada formulario decide qué hacer al
 * enviar; aquí solo están los campos, su estado y el botón, para que no se desincronicen.
 */

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const TEXTAREA =
  "w-full rounded-xl border border-stone-300/70 bg-white px-4 py-3 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";
export const LEYENDA = "mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase";

export type CambiarValor = <K extends keyof OrdenFormValores>(campo: K, valor: OrdenFormValores[K]) => void;

/** Estado de los campos del formulario y su setter por campo. */
export function useValoresOrden(inicial: OrdenFormValores) {
  const [valores, setValores] = useState<OrdenFormValores>(inicial);
  const cambiar = useCallback<CambiarValor>((campo, valor) => setValores((prev) => ({ ...prev, [campo]: valor })), []);
  return { valores, cambiar, reiniciar: setValores };
}

export function esListoOEntregado(valores: OrdenFormValores): boolean {
  return valores.estado === "listo" || valores.estado === "entregado";
}

export function CamposOrden({
  valores: v,
  onCambio,
  fechaEntrega,
}: {
  valores: OrdenFormValores;
  onCambio: CambiarValor;
  /** ISO de la entrega si la orden ya fue entregada (solo al editar). */
  fechaEntrega: string | null;
}) {
  const entregaEfectiva = v.estado === "entregado" ? fechaEntrega : null;
  const fin = calcularFinGarantia(entregaEfectiva, v.dias_garantia);

  return (
    <>
      <fieldset className="space-y-4">
        <legend className={LEYENDA}>Recepción</legend>

        <div>
          <label htmlFor="estado" className={LABEL}>
            Estado
          </label>
          <SelectorEstado id="estado" name="estado" value={v.estado} onChange={(e) => onCambio("estado", e)} />
        </div>

        <div>
          <label htmlFor="kilometraje" className={LABEL}>
            Kilometraje
          </label>
          <input
            id="kilometraje"
            name="kilometraje"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="km al ingreso"
            value={v.kilometraje}
            onChange={(e) => onCambio("kilometraje", e.target.value)}
            className={INPUT}
          />
        </div>

        <Colapsable titulo="Notas técnicas" resumen={resumenNotasTecnicas(v.diagnostico_inicial, v.trabajos_a_realizar)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="diagnostico_inicial" className={LABEL}>
                Diagnóstico inicial
              </label>
              <textarea
                id="diagnostico_inicial"
                name="diagnostico_inicial"
                rows={4}
                placeholder="Fugas detectadas, presiones, escaneo…"
                value={v.diagnostico_inicial}
                onChange={(e) => onCambio("diagnostico_inicial", e.target.value)}
                className={TEXTAREA}
              />
            </div>

            <div>
              <label htmlFor="trabajos_a_realizar" className={LABEL}>
                Trabajos a realizar
              </label>
              <textarea
                id="trabajos_a_realizar"
                name="trabajos_a_realizar"
                rows={4}
                placeholder="Cambio de compresor, vacío y recarga R134a…"
                value={v.trabajos_a_realizar}
                onChange={(e) => onCambio("trabajos_a_realizar", e.target.value)}
                className={TEXTAREA}
              />
            </div>
          </div>
        </Colapsable>
      </fieldset>

      <Colapsable titulo="Pertenencias al ingreso" resumen={resumenPertenencias(v.pertenencias)}>
        {v.pertenencias === null ? (
          <button
            type="button"
            onClick={() => onCambio("pertenencias", PERTENENCIAS_VACIAS)}
            className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-[14px] font-medium text-stone-600 active:bg-stone-100"
          >
            Registrar pertenencias del vehículo
          </button>
        ) : (
          <PertenenciasChecklist value={v.pertenencias} onChange={(p) => onCambio("pertenencias", p)} />
        )}
      </Colapsable>

      <fieldset className="space-y-4">
        <legend className={LEYENDA}>Cobro y garantía</legend>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mano_obra" className={LABEL}>
              Mano de obra ($)
            </label>
            <input
              id="mano_obra"
              name="mano_obra"
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              placeholder="0"
              value={v.mano_obra}
              onChange={(e) => onCambio("mano_obra", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="total_cobrado" className={LABEL}>
              Total a cobrar ($)
            </label>
            <input
              id="total_cobrado"
              name="total_cobrado"
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              placeholder="0"
              value={v.total_cobrado}
              onChange={(e) => onCambio("total_cobrado", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="dias_garantia" className={LABEL}>
            Garantía
          </label>
          <select
            id="dias_garantia"
            name="dias_garantia"
            value={v.dias_garantia}
            onChange={(e) => onCambio("dias_garantia", Number(e.target.value))}
            className={INPUT}
          >
            {OPCIONES_GARANTIA.map((o) => (
              <option key={o.dias} value={o.dias}>
                {o.label}
              </option>
            ))}
          </select>

          {v.dias_garantia > 0 && fin && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {entregaEfectiva ? (
                  <>
                    Vence el <strong>{formatearFechaDate(fin)}</strong>.
                  </>
                ) : (
                  <>
                    Si se entrega hoy, vence el <strong>{formatearFechaDate(fin)}</strong>. La garantía se cuenta
                    desde la entrega.
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      </fieldset>

      {esListoOEntregado(v) && (
        <SelectorMantenimiento
          value={v.mantenimiento_meses}
          onChange={(m) => onCambio("mantenimiento_meses", m)}
          destacar
        />
      )}
    </>
  );
}

export function MensajeForm({ tipo, texto }: { tipo: "error" | "ok"; texto: string }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${tipo === "error" ? "bg-brick-50 text-brick-700" : "bg-sage-50 text-sage-800"}`}
    >
      {texto}
    </p>
  );
}

export function BotonEnviar({ pendiente, texto }: { pendiente: boolean; texto: string }) {
  return (
    <button
      type="submit"
      disabled={pendiente}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white transition-colors active:bg-ink-soft disabled:opacity-60"
    >
      {pendiente && <Snowflake className="size-5 animate-copo" aria-hidden />}
      {pendiente ? "Guardando…" : texto}
    </button>
  );
}
