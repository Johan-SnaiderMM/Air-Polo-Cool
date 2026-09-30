"use client";

import { CloudUpload } from "lucide-react";
import { useSync } from "@/components/sync/sync-provider";

/**
 * Órdenes creadas SIN conexión que aún no se suben. Aparecen arriba de la lista
 * para que nadie las dé por perdidas ni las cree dos veces.
 */
export function OrdenesPendientes() {
  const { cola } = useSync();
  const ordenes = cola.filter((i) => i.operacion.tipo === "orden.crear");
  if (ordenes.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
        Pendientes de subir
      </p>
      <ul className="space-y-2">
        {ordenes.map((item) => {
          const op = item.operacion;
          if (op.tipo !== "orden.crear") return null;
          const v = op.datos.vehiculo;
          return (
            <li
              key={item.seq}
              className="flex items-center gap-3 rounded-2xl border border-ochre-300 bg-ochre-50 px-4 py-3"
            >
              <CloudUpload className="size-5 shrink-0 text-ochre-700" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ochre-800">
                  {v.nuevo ? `${v.placa.toUpperCase()} · ${v.marca} ${v.modelo}` : "Orden de un vehículo existente"}
                </p>
                <p className="truncate text-[12px] text-ochre-800">
                  {item.estado === "fallida" ? `Requiere revisión: ${item.error ?? "error"}` : "Se sincronizará al volver la conexión"}
                  {v.nuevo ? ` · ${v.cliente_nombre}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
