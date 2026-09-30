"use client";

import { useCallback, useState } from "react";
import { SelectorCategoria } from "@/components/caja/selector-categoria";
import { SelectorOrden } from "@/components/caja/selector-orden";
import { PosMonto } from "@/components/ui/pos-monto";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { hoyBogota } from "@/lib/caja";
import type { OrdenLocal } from "@/lib/offline/snapshot";
import type { CategoriaGasto } from "@/types/database";

/**
 * Campos de un gasto COMPARTIDOS por el registro express (GastoForm) y la edición (GastoDrawer):
 * monto estilo POS → categoría → nota → fecha → orden asociada. Cada formulario decide qué hacer
 * al enviar; aquí solo están los campos y su estado, para que no se desincronicen.
 */
export type ValoresGasto = {
  /** Solo dígitos (el formato con miles se aplica al mostrar). */
  digitos: string;
  categoria: CategoriaGasto | null;
  descripcion: string;
  /** YYYY-MM-DD */
  fecha: string;
  orden: OrdenLocal | null;
};

export const valoresGastoVacios = (): ValoresGasto => ({
  digitos: "",
  categoria: null,
  descripcion: "",
  fecha: hoyBogota(),
  orden: null,
});

export const montoDe = (v: ValoresGasto) => Number(v.digitos || "0");

export type CambiarGasto = <K extends keyof ValoresGasto>(campo: K, valor: ValoresGasto[K]) => void;

export function useValoresGasto(inicial: () => ValoresGasto) {
  const [valores, setValores] = useState<ValoresGasto>(inicial);
  const cambiar = useCallback<CambiarGasto>((campo, valor) => setValores((p) => ({ ...p, [campo]: valor })), []);
  return { valores, cambiar, reiniciar: setValores };
}

export function CamposGasto({
  valores,
  onCambio,
  idMonto,
  tamanoMonto = "grande",
  notaEtiqueta,
  accionNota,
  separacion = "space-y-3.5",
}: {
  valores: ValoresGasto;
  onCambio: CambiarGasto;
  idMonto: string;
  tamanoMonto?: "grande" | "normal";
  /** Etiqueta accesible y texto de ayuda del campo de nota. */
  notaEtiqueta: string;
  /** Control a la derecha de la nota (p. ej. el botón del recibo). */
  accionNota?: React.ReactNode;
  separacion?: string;
}) {
  return (
    <div className={separacion}>
      <PosMonto id={idMonto} etiqueta="Monto" digitos={valores.digitos} onChange={(d) => onCambio("digitos", d)} tamano={tamanoMonto} />

      <SelectorCategoria value={valores.categoria} onChange={(c) => onCambio("categoria", c)} />

      <div className="flex items-stretch gap-2">
        <input
          aria-label={notaEtiqueta}
          value={valores.descripcion}
          onChange={(e) => onCambio("descripcion", e.target.value)}
          maxLength={300}
          placeholder={notaEtiqueta}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none placeholder:text-stone-400 focus:border-stone-400"
        />
        {accionNota}
      </div>

      <div className="space-y-2.5">
        <SelectorFecha value={valores.fecha} onChange={(f) => onCambio("fecha", f)} />
        <SelectorOrden value={valores.orden} onChange={(o) => onCambio("orden", o)} />
      </div>
    </div>
  );
}
