"use client";

import { useCallback, useState } from "react";
import { BellRing, CalendarPlus, MessageCircle } from "lucide-react";
import { FormularioCita } from "@/components/agenda/formulario-cita";
import { formatearFechaDate } from "@/lib/ordenes";
import type { MantenimientoPorProgramar } from "@/lib/datos/agenda";

/**
 * Mantenimientos preventivos vencidos o próximos que todavía no tienen cita. «Agendar» abre el
 * formulario con el vehículo, el tipo «Mantenimiento» y el día que le toca ya puestos; solo falta la hora.
 */
export function PorProgramar({ filas }: { filas: MantenimientoPorProgramar[] }) {
  const [elegido, setElegido] = useState<MantenimientoPorProgramar | null>(null);
  const cerrar = useCallback(() => setElegido(null), []);

  return (
    <>
      <ul className="space-y-3">
        {filas.map((m) => {
          const vencido = m.dias < 0;
          return (
            <li key={m.vehiculoId} className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2">
                  <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[14px] font-semibold tracking-wider">
                    {m.placa}
                  </span>
                  <span className="truncate text-[14px] text-stone-600">{m.vehiculo}</span>
                </p>
                <span className={`flex shrink-0 items-center gap-1.5 text-[12px] font-medium ${vencido ? "text-brick-700" : "text-ochre-700"}`}>
                  <span className={`size-2 rounded-full ${vencido ? "bg-brick-500" : "bg-ochre-500"}`} aria-hidden />
                  {vencido ? `Venció hace ${Math.abs(m.dias)} d` : m.dias === 0 ? "Hoy" : `En ${m.dias} d`}
                </span>
              </div>

              <div>
                <p className="font-medium">{m.cliente}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
                  <BellRing className="size-3.5" strokeWidth={1.5} aria-hidden />
                  Le toca el {formatearFechaDate(m.proximo)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setElegido(m)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white active:opacity-90"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  Agendar
                </button>
                {m.whatsappHref && (
                  <a
                    href={m.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300/70 text-sm font-medium text-stone-700 active:bg-stone-100"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Avisarle
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {elegido && (
        <FormularioCita
          onClose={cerrar}
          tipoInicial="mantenimiento"
          fechaInicial={elegido.fechaSugerida}
          vehiculoInicial={{
            id: elegido.vehiculoId,
            placa: elegido.placa,
            marca: elegido.marca,
            modelo: elegido.modelo,
            anio: elegido.anio,
            cliente: elegido.cliente,
          }}
        />
      )}
    </>
  );
}
