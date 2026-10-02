"use client";

import { CalendarClock } from "lucide-react";
import { ELECCION_APARTE, TIPO_CITA_LABEL, type CitaDeVehiculo } from "@/lib/agenda";

function Opcion({
  valor,
  elegido,
  onElegir,
  titulo,
  detalle,
}: {
  valor: string;
  elegido: boolean;
  onElegir: (valor: string) => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 ${
        elegido ? "border-ink ring-1 ring-ink" : "border-stone-300/70 active:bg-stone-50"
      }`}
    >
      <input
        type="radio"
        name="cita-de-la-orden"
        value={valor}
        checked={elegido}
        onChange={() => onElegir(valor)}
        className="mt-1 size-4 accent-ink"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{titulo}</span>
        <span className="block text-[13px] text-stone-500">{detalle}</span>
      </span>
    </label>
  );
}

/**
 * Pregunta, al recibir un vehículo que tiene citas pendientes, si este ingreso es de una de ellas.
 * La de hoy viene elegida (se cierra sola al guardar la orden); las de los próximos días hay que
 * responderlas: «sí» la marca como cumplida aunque el cliente haya venido antes, «no» la deja agendada.
 */
export function CitaDeLaOrden({
  citas,
  eleccion,
  onElegir,
}: {
  citas: CitaDeVehiculo[];
  eleccion: string | undefined;
  onElegir: (valor: string) => void;
}) {
  const hayHoy = citas.some((c) => c.esHoy);
  return (
    <fieldset className="space-y-3 rounded-2xl border border-ochre-300 bg-ochre-50 p-4">
      <legend className="sr-only">Cita de este ingreso</legend>
      <div>
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ochre-800">
          <CalendarClock className="size-4" aria-hidden />
          {citas.length === 1 ? "Este vehículo tiene una cita en la agenda" : "Este vehículo tiene citas en la agenda"}
        </p>
        <p className="mt-0.5 text-[13px] text-ochre-800">
          {hayHoy ? "Hoy tiene cita: se marcará como cumplida al guardar la orden." : "¿Este ingreso es de la cita programada?"}
        </p>
      </div>

      <div role="radiogroup" className="space-y-2">
        {citas.map((c) => (
          <Opcion
            key={c.id}
            valor={c.id}
            elegido={eleccion === c.id}
            onElegir={onElegir}
            titulo={`Sí, es la cita de ${c.etiquetaDia.toLowerCase()} · ${c.horaTexto}`}
            detalle={
              c.esHoy
                ? `${TIPO_CITA_LABEL[c.tipo]} · se marca como cumplida al guardar`
                : `${TIPO_CITA_LABEL[c.tipo]} · si el cliente vino antes, se marca como cumplida`
            }
          />
        ))}
        <Opcion
          valor={ELECCION_APARTE}
          elegido={eleccion === ELECCION_APARTE}
          onElegir={onElegir}
          titulo="No, es un ingreso aparte"
          detalle="La cita sigue agendada"
        />
      </div>
    </fieldset>
  );
}
