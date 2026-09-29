import Link from "next/link";
import { EstadoBadge } from "@/components/ordenes/estado-badge";
import { Dinero } from "@/components/ui/dinero";
import { formatearFechaCorta } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

export type OrdenResumen = {
  id: string;
  estado: EstadoOrden;
  fecha_ingreso: string;
  total_cobrado: number;
  vehiculos: {
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
    clientes: { nombre: string } | null;
  } | null;
};

/**
 * Tarjeta de orden: la placa (identificador) y el estado arriba, el vehículo como título,
 * y una línea inferior en gris con cliente · fecha, con el importe en mono a la derecha.
 */
export function OrdenCard({ orden }: { orden: OrdenResumen }) {
  const v = orden.vehiculos;

  return (
    <Link
      href={`/ordenes/${orden.id}`}
      className="block rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors active:bg-stone-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[15px] font-semibold tracking-[0.12em] text-ink">
          {v?.placa ?? "—"}
        </span>
        <EstadoBadge estado={orden.estado} />
      </div>

      <p className="mt-3 truncate text-[17px] leading-snug font-medium tracking-tight">
        {v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : "Vehículo"}
      </p>

      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-stone-500">
          {v?.clientes?.nombre ?? "Sin cliente"} · {formatearFechaCorta(orden.fecha_ingreso)}
        </p>
        <Dinero valor={orden.total_cobrado} className="shrink-0 text-[15px] font-medium" />
      </div>
    </Link>
  );
}
