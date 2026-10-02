import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Dinero } from "@/components/ui/dinero";

export type FilaRentabilidad = {
  ordenId: string;
  placa: string;
  cliente: string;
  cobrado: number;
  costoRepuestos: number;
  gastosDirectos: number;
  utilidadReal: number;
};

/**
 * Rentabilidad neta real por orden/vehículo:
 *   cobrado − costo de repuestos − gastos directos asignados a la orden.
 */
export function RentabilidadOrdenes({ filas }: { filas: FilaRentabilidad[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
        Aún no hay órdenes entregadas este mes.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
      {filas.map((f) => {
        const costos = f.costoRepuestos + f.gastosDirectos;
        const margen = f.cobrado > 0 ? Math.round((f.utilidadReal / f.cobrado) * 100) : null;
        return (
          <li key={f.ordenId}>
            <Link
              href={`/ordenes/${f.ordenId}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-stone-50"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="rounded border border-stone-300/70 bg-stone-100 px-1.5 font-mono text-[12px] font-semibold tracking-wider">
                    {f.placa}
                  </span>
                  <span className="truncate text-[13px] text-stone-500">{f.cliente}</span>
                </p>
                <p className="mt-1 text-[12px] text-stone-500">
                  Cobrado <Dinero valor={f.cobrado} /> − costos <Dinero valor={costos} />
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[15px] ${f.utilidadReal < 0 ? "text-brick-600" : ""}`}>
                  <Dinero valor={f.utilidadReal} />
                </p>
                {margen !== null && <p className="text-[11px] text-stone-500">{margen} %</p>}
              </div>
              <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
