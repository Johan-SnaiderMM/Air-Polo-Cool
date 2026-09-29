"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { guardarOrden, type OrdenFormState, type VehiculoResultado } from "@/app/(app)/ordenes/actions";
import { VehiculoSelector } from "@/components/ordenes/vehiculo-selector";
import {
  ESTADOS_FLUJO,
  ESTADO_LABEL,
  OPCIONES_GARANTIA,
  calcularFinGarantia,
  formatearFechaDate,
} from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const TEXTAREA =
  "w-full rounded-xl border border-stone-300/70 bg-white px-4 py-3 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

export type OrdenFormValores = {
  kilometraje: string;
  diagnostico_inicial: string;
  trabajos_a_realizar: string;
  mano_obra: string;
  total_cobrado: string;
  dias_garantia: number;
  estado: EstadoOrden;
};

const VALORES_NUEVA: OrdenFormValores = {
  kilometraje: "",
  diagnostico_inicial: "",
  trabajos_a_realizar: "",
  mano_obra: "",
  total_cobrado: "",
  dias_garantia: 0,
  estado: "recibido",
};

type Props =
  | { modo: "crear"; vehiculoInicial?: VehiculoResultado | null }
  | {
      modo: "editar";
      ordenId: string;
      valores: OrdenFormValores;
      /** ISO de la entrega, si ya fue entregada. */
      fechaEntrega: string | null;
    };

export function OrdenForm(props: Props) {
  const editando = props.modo === "editar";
  const [state, action, pending] = useActionState<OrdenFormState, FormData>(
    guardarOrden,
    {}
  );
  const [v, setV] = useState<OrdenFormValores>(
    props.modo === "editar" ? props.valores : VALORES_NUEVA
  );

  function set<K extends keyof OrdenFormValores>(k: K, valor: OrdenFormValores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }));
  }

  const fechaEntrega = props.modo === "editar" ? props.fechaEntrega : null;
  const entregaEfectiva = v.estado === "entregado" ? fechaEntrega : null;
  const fin = calcularFinGarantia(entregaEfectiva, v.dias_garantia);

  return (
    <form action={action} className="space-y-6">
      {props.modo === "editar" && (
        <input type="hidden" name="orden_id" value={props.ordenId} />
      )}

      {!editando && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Vehículo</legend>
          <VehiculoSelector
            inicial={props.modo === "crear" ? (props.vehiculoInicial ?? null) : null}
          />
        </fieldset>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Recepción</legend>

        <div>
          <label htmlFor="estado" className={LABEL}>
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            value={v.estado}
            onChange={(e) => set("estado", e.target.value as EstadoOrden)}
            className={INPUT}
          >
            {ESTADOS_FLUJO.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
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
            onChange={(e) => set("kilometraje", e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="diagnostico_inicial" className={LABEL}>
            Diagnóstico inicial
          </label>
          <textarea
            id="diagnostico_inicial"
            name="diagnostico_inicial"
            rows={4}
            placeholder="Fugas detectadas, presiones, escaneo, pertenencias…"
            value={v.diagnostico_inicial}
            onChange={(e) => set("diagnostico_inicial", e.target.value)}
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
            onChange={(e) => set("trabajos_a_realizar", e.target.value)}
            className={TEXTAREA}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Cobro y garantía</legend>

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
              onChange={(e) => set("mano_obra", e.target.value)}
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
              onChange={(e) => set("total_cobrado", e.target.value)}
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
            onChange={(e) => set("dias_garantia", Number(e.target.value))}
            className={INPUT}
          >
            {OPCIONES_GARANTIA.map((o) => (
              <option key={o.dias} value={o.dias}>
                {o.label}
              </option>
            ))}
          </select>

          {v.dias_garantia > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {fin && entregaEfectiva ? (
                  <>
                    Vence el <strong>{formatearFechaDate(fin)}</strong>.
                  </>
                ) : (
                  <>
                    Si se entrega hoy, vence el{" "}
                    <strong>{formatearFechaDate(fin!)}</strong>. La garantía se
                    cuenta desde la entrega.
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
          {state.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white transition-colors active:bg-ink-soft disabled:opacity-60"
      >
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear orden"}
      </button>
    </form>
  );
}
