"use client";

import { useEffect, useState } from "react";
import { Bookmark, Pencil, Plus, X } from "lucide-react";
import { guardarCache, leerCache } from "@/lib/offline/almacen";
import { CLAVE_PLANTILLAS, MAX_PLANTILLAS, plantillasValidas, type PlantillaGasto } from "@/lib/plantillas-gasto";
import { formatearMoneda } from "@/lib/ordenes";
import type { CategoriaGasto } from "@/types/database";

type Props = {
  /** Un toque: registra el gasto de la plantilla de inmediato. */
  onUsar: (p: PlantillaGasto) => void;
  /** Datos del formulario actual, si son suficientes para guardarlos como plantilla. */
  actual: { monto: number; categoria: CategoriaGasto; descripcion: string } | null;
  deshabilitado?: boolean;
};

export function PlantillasRapidas({ onUsar, actual, deshabilitado }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaGasto[]>([]);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void leerCache<unknown>(CLAVE_PLANTILLAS).then((c) => {
      if (vivo) setPlantillas(c ? plantillasValidas(c.valor) : plantillasValidas(null));
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function persistir(lista: PlantillaGasto[]) {
    setPlantillas(lista);
    try {
      await guardarCache(CLAVE_PLANTILLAS, lista);
    } catch {
      /* sin almacenamiento local: la plantilla dura hasta recargar */
    }
  }

  function guardarActual() {
    if (!actual) return;
    const nombre = actual.descripcion.trim() || "Gasto rápido";
    void persistir(
      [
        ...plantillas,
        {
          id: crypto.randomUUID(),
          nombre: nombre.slice(0, 40),
          monto: actual.monto,
          categoria: actual.categoria,
          descripcion: actual.descripcion.trim() || null,
        },
      ].slice(0, MAX_PLANTILLAS)
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
          <Bookmark className="size-3.5" aria-hidden /> Rápidos
        </p>
        {plantillas.length > 0 && (
          <button
            type="button"
            onClick={() => setEditando((e) => !e)}
            className="flex items-center gap-1 text-[12px] text-stone-500 active:text-ink"
          >
            <Pencil className="size-3" aria-hidden /> {editando ? "Listo" : "Editar"}
          </button>
        )}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {plantillas.map((p) => (
          <div key={p.id} className="relative shrink-0">
            <button
              type="button"
              disabled={deshabilitado || editando}
              onClick={() => onUsar(p)}
              className="flex h-10 items-center gap-2 rounded-full border border-stone-200/80 bg-white px-3.5 text-[13px] text-ink transition-colors active:bg-stone-100 disabled:opacity-60"
            >
              <span className="font-medium">{p.nombre}</span>
              <span className="font-mono text-stone-500 tabular-nums">{formatearMoneda(p.monto)}</span>
            </button>
            {editando && (
              <button
                type="button"
                aria-label={`Quitar plantilla ${p.nombre}`}
                onClick={() => void persistir(plantillas.filter((x) => x.id !== p.id))}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white"
              >
                <X className="size-3" strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        ))}

        {actual && plantillas.length < MAX_PLANTILLAS && !editando && (
          <button
            type="button"
            onClick={guardarActual}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-stone-300 px-3.5 text-[13px] text-stone-500 active:bg-stone-100"
          >
            <Plus className="size-3.5" aria-hidden /> Guardar este
          </button>
        )}
      </div>
    </div>
  );
}
