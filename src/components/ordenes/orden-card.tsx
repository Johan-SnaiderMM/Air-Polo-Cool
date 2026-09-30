import Link from "next/link";
import { CambiarEstado } from "@/components/ordenes/cambiar-estado";
import { Dinero } from "@/components/ui/dinero";
import { formatearFechaCorta } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

export type OrdenResumen = {
  id: string;
  estado: EstadoOrden;
  fecha_ingreso: string;
  total_cobrado: number;
  /** Próximo mantenimiento ya elegido (para precargarlo al cambiar de estado). */
  mantenimiento_meses?: number | null;
  vehiculos: {
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
    clientes: { nombre: string } | null;
  } | null;
};

/**
 * Tarjeta de orden: la placa y el estado (botón que abre el cambio rápido) arriba, el vehículo
 * como título y una línea inferior con cliente · fecha e importe. Toda la tarjeta abre el
 * detalle (enlace "estirado" sobre el título); el botón de estado queda por encima y NO va
 * anidado dentro del enlace.
 */
export function OrdenCard({ orden, saldo = 0 }: { orden: OrdenResumen; saldo?: number }) {
  const v = orden.vehiculos;
  const titulo = v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : "Vehículo";
  const meses = orden.mantenimiento_meses;

  return (
    <div className="relative rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors has-[a:active]:bg-stone-50">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[15px] font-semibold tracking-[0.12em] text-ink">
          {v?.placa ?? "—"}
        </span>
        <CambiarEstado
          ordenId={orden.id}
          estado={orden.estado}
          placa={v?.placa ?? "—"}
          vehiculo={titulo}
          saldo={saldo}
          mantenimientoMeses={meses === 3 || meses === 6 || meses === 12 ? meses : null}
        />
      </div>

      <p className="mt-3 truncate text-[17px] leading-snug font-medium tracking-tight">
        <Link
          href={`/ordenes/${orden.id}`}
          className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ink/40"
        >
          {titulo}
        </Link>
      </p>

      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-stone-500">
          {v?.clientes?.nombre ?? "Sin cliente"} · {formatearFechaCorta(orden.fecha_ingreso)}
        </p>
        <Dinero valor={orden.total_cobrado} className="shrink-0 text-[15px] font-medium" />
      </div>

      {saldo > 0 && orden.estado !== "cancelado" && (
        <p className="mt-2 flex items-center justify-between rounded-lg bg-ochre-50 px-3 py-1.5 text-[12px] text-ochre-800">
          <span>Saldo por cobrar</span>
          <Dinero valor={saldo} className="font-medium" />
        </p>
      )}
    </div>
  );
}
