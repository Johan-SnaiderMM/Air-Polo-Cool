"use client";

import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { CATEGORIAS, CATEGORIA_LABEL } from "@/lib/caja";
import type { CategoriaGasto } from "@/types/database";

/** Cuadrícula compacta: 3 columnas arriba y 2 abajo (icono + nombre, sin subtítulos). */
export function SelectorCategoria({
  value,
  onChange,
}: {
  value: CategoriaGasto | null;
  onChange: (c: CategoriaGasto) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Categoría</legend>
      <div className="grid grid-cols-6 gap-2">
        {CATEGORIAS.map((c, i) => {
          const Icono = CATEGORIA_ICONO[c];
          const activa = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={activa}
              className={`flex h-[60px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] text-[12px] transition-colors ${
                i < 3 ? "col-span-2" : "col-span-3"
              } ${
                activa
                  ? "border-ink bg-stone-100 font-medium text-ink"
                  : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
              }`}
            >
              <Icono className="size-[18px]" strokeWidth={1.5} aria-hidden />
              {CATEGORIA_LABEL[c]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
