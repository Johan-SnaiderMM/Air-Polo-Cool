import { formatearCantidad, redondearDinero } from "@/lib/inventario";
import { formatearMoneda } from "@/lib/ordenes";
import type { TipoUnidad } from "@/types/database";

/**
 * Agrupa las fotos de "repuesto retirado" / "repuesto instalado" por el repuesto al que
 * pertenecen (fase 5). Lo comparten la bitácora interna y el portal del cliente.
 *
 * - `grupos`: un grupo por repuesto que tenga al menos una foto ligada, en el orden de la lista.
 * - `sueltas`: todo lo demás (ingreso, pruebas, fotos de repuesto sin asignar o cuyo repuesto
 *   ya no está en la orden).
 */
export type FotoLigable = {
  tipo: string;
  orden_repuesto_id?: string | null;
};

export type GrupoRepuesto<F, R> = { repuesto: R; retirado: F[]; instalado: F[] };

export function agruparPorRepuesto<F extends FotoLigable, R extends { id?: string }>(
  fotos: F[],
  repuestos: R[]
): { grupos: GrupoRepuesto<F, R>[]; sueltas: F[] } {
  const porId = new Map<string, GrupoRepuesto<F, R>>();
  for (const r of repuestos) {
    if (r.id && !porId.has(r.id)) porId.set(r.id, { repuesto: r, retirado: [], instalado: [] });
  }

  const sueltas: F[] = [];
  for (const f of fotos) {
    const grupo = f.orden_repuesto_id ? porId.get(f.orden_repuesto_id) : undefined;
    if (grupo && f.tipo === "repuesto_viejo") grupo.retirado.push(f);
    else if (grupo && f.tipo === "repuesto_nuevo") grupo.instalado.push(f);
    else sueltas.push(f);
  }

  const grupos = [...porId.values()].filter((g) => g.retirado.length + g.instalado.length > 0);
  return { grupos, sueltas };
}

/**
 * Lo que se le COBRA al cliente por un repuesto (precio de venta, nunca el costo de compra), para mostrarlo
 * bajo la foto del repuesto instalado: «$480.000», o «2 × $35.000 = $70.000» si son varias unidades.
 * Con precio 0 (ya incluido en el total acordado) dice «Incluido en el total».
 */
export function textoPrecioRepuesto(d: { cantidad: number; precioUnitario: number; unidad?: TipoUnidad }): string {
  const total = redondearDinero(d.cantidad * d.precioUnitario);
  if (total <= 0) return "Incluido en el total";
  if (d.cantidad === 1) return formatearMoneda(total);
  return `${formatearCantidad(d.cantidad, d.unidad ?? "unidad")} × ${formatearMoneda(d.precioUnitario)} = ${formatearMoneda(total)}`;
}
