"use client";

import { Check, CircleAlert } from "lucide-react";
import type { Pertenencias } from "@/types/database";

export const PERTENENCIAS_VACIAS: Pertenencias = {
  carroceria: "sin_danos",
  llanta_repuesto: false,
  herramientas: false,
  documentos: false,
  objetos_valor: "",
  notas: "",
};

const CARROCERIA: { id: Pertenencias["carroceria"]; label: string }[] = [
  { id: "sin_danos", label: "Sin daños" },
  { id: "rayones", label: "Rayones" },
  { id: "golpes", label: "Golpes" },
];

const ELEMENTOS: { clave: "llanta_repuesto" | "herramientas" | "documentos"; label: string }[] = [
  { clave: "llanta_repuesto", label: "Llanta de repuesto" },
  { clave: "herramientas", label: "Herramientas / gato" },
  { clave: "documentos", label: "Documentos" },
];

const ETIQUETA = "mb-1.5 block text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase";

/**
 * Checklist táctil de pertenencias al recibir el vehículo: estado de carrocería,
 * llanta de repuesto, herramientas/gato, documentos y objetos de valor.
 * Un chip marcado significa "el vehículo lo trae".
 */
export function PertenenciasChecklist({
  value,
  onChange,
}: {
  value: Pertenencias;
  onChange: (p: Pertenencias) => void;
}) {
  const set = (cambio: Partial<Pertenencias>) => onChange({ ...value, ...cambio });

  return (
    <div className="space-y-4">
      <div>
        <span className={ETIQUETA}>Estado de la carrocería</span>
        <div role="radiogroup" aria-label="Estado de la carrocería" className="grid grid-cols-3 gap-2">
          {CARROCERIA.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value.carroceria === c.id}
              onClick={() => set({ carroceria: c.id })}
              className={`h-12 rounded-xl border-[1.5px] text-[14px] transition-colors ${
                value.carroceria === c.id
                  ? c.id === "sin_danos"
                    ? "border-ink bg-stone-100 font-medium text-ink"
                    : "border-ochre-500 bg-ochre-50 font-medium text-ochre-800"
                  : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={ETIQUETA}>El vehículo trae</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ELEMENTOS.map((e) => {
            const activo = value[e.clave];
            return (
              <button
                key={e.clave}
                type="button"
                aria-pressed={activo}
                onClick={() => set({ [e.clave]: !activo })}
                className={`flex h-12 items-center gap-3 rounded-xl border-[1.5px] px-4 text-left text-[14px] transition-colors ${
                  activo
                    ? "border-ink bg-stone-100 font-medium text-ink"
                    : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    activo ? "border-ink bg-ink text-white" : "border-stone-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {activo && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="objetos_valor" className={ETIQUETA}>
          Objetos de valor
        </label>
        <input
          id="objetos_valor"
          value={value.objetos_valor}
          onChange={(e) => set({ objetos_valor: e.target.value })}
          maxLength={300}
          placeholder="Ej: gafas, celular, cargador (o ninguno)"
          className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
        />
        {value.objetos_valor.trim() !== "" && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ochre-700">
            <CircleAlert className="size-3.5" aria-hidden /> Queda registrado en la orden y en el comprobante.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notas_pertenencias" className={ETIQUETA}>
          Observaciones
        </label>
        <input
          id="notas_pertenencias"
          value={value.notas}
          onChange={(e) => set({ notas: e.target.value })}
          maxLength={500}
          placeholder="Ej: rayón en puerta izquierda"
          className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
        />
      </div>
    </div>
  );
}
