"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import { guardarCita, type CitaFormState } from "@/app/(app)/agenda/actions";
import type { VehiculoResultado } from "@/app/(app)/ordenes/actions";
import { VehiculoSelector, type SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { useAutor } from "@/components/sync/autor-provider";
import { Drawer } from "@/components/ui/drawer";
import { MAX_DIAS_ADELANTE, sumarDias, TIPO_CITA_LABEL, TIPOS_CITA } from "@/lib/agenda";
import { hoyBogota } from "@/lib/caja";
import type { TipoCita } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LEYENDA = "mb-2 block text-sm font-medium";

/** Una cita que se está reprogramando (el vehículo no cambia). */
export type CitaEditable = {
  id: string;
  fecha: string;
  hora: string;
  tipo: TipoCita;
  notas: string | null;
  /** "ABC123 · Chevrolet Spark GT 2018 · Juan Pérez" */
  vehiculoTexto: string;
};

type Props = {
  onClose: () => void;
  /** Si viene, se reprograma esa cita; si no, se crea una nueva. */
  cita?: CitaEditable;
  /** Vehículo ya elegido (por ejemplo, desde «Mantenimientos por programar»). */
  vehiculoInicial?: VehiculoResultado | null;
  tipoInicial?: TipoCita;
  fechaInicial?: string;
};

/**
 * Agendar o reprogramar una cita. Lo mínimo: vehículo (de la lista o uno nuevo con el cliente y lo
 * básico del carro), día, hora, tipo y una nota opcional. Sin pertenencias ni kilometraje: eso se
 * toma cuando el vehículo llega y se crea la orden.
 */
export function FormularioCita({ onClose, cita, vehiculoInicial = null, tipoInicial = "servicio", fechaInicial }: Props) {
  const editando = !!cita;
  const { autor } = useAutor();
  const [estado, accion, pendiente] = useActionState<CitaFormState, FormData>(guardarCita, {});
  const hoy = hoyBogota();
  const manana = sumarDias(hoy, 1);

  const [vehiculo, setVehiculo] = useState<SeleccionVehiculo | null>(null);
  // Una cita atrasada se reprograma: se propone mañana en vez de su día (que ya pasó).
  const [fecha, setFecha] = useState(cita ? (cita.fecha >= hoy ? cita.fecha : manana) : (fechaInicial ?? manana));
  const [tipo, setTipo] = useState<TipoCita>(cita?.tipo ?? tipoInicial);
  const alElegirVehiculo = useCallback((s: SeleccionVehiculo | null) => setVehiculo(s), []);

  // Al guardar, se cierra el panel (la lista ya se refrescó en el servidor).
  useEffect(() => {
    if (estado.ok) onClose();
  }, [estado.ok, onClose]);

  return (
    <Drawer titulo={editando ? "Reprogramar cita" : "Agendar cita"} onClose={onClose}>
      <form action={accion} className="space-y-5">
        {editando && <input type="hidden" name="cita_id" value={cita.id} />}
        <input type="hidden" name="autor" value={autor} />
        <input type="hidden" name="tipo" value={tipo} />
        {!editando && <input type="hidden" name="vehiculo" value={vehiculo ? JSON.stringify(vehiculo) : ""} />}

        <fieldset className="space-y-2">
          <legend className={LEYENDA}>Vehículo</legend>
          {editando ? (
            <p className="rounded-xl bg-stone-100 px-4 py-3 text-[15px]">{cita.vehiculoTexto}</p>
          ) : (
            <VehiculoSelector inicial={vehiculoInicial} onChange={alElegirVehiculo} />
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={LEYENDA}>¿Qué viene a hacer?</legend>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_CITA.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`h-12 rounded-xl border text-[14px] font-semibold ${
                  tipo === t ? "border-ink bg-ink text-white" : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
                }`}
              >
                {TIPO_CITA_LABEL[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={LEYENDA}>Día y hora</legend>
          <div className="flex gap-2">
            {[
              { etiqueta: "Hoy", valor: hoy },
              { etiqueta: "Mañana", valor: manana },
            ].map((d) => (
              <button
                key={d.etiqueta}
                type="button"
                onClick={() => setFecha(d.valor)}
                aria-pressed={fecha === d.valor}
                className={`h-10 rounded-full border px-4 text-[13px] font-semibold ${
                  fecha === d.valor ? "border-ink bg-ink text-white" : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
                }`}
              >
                {d.etiqueta}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <div>
              <label htmlFor="cita-fecha" className="sr-only">
                Día
              </label>
              <input
                id="cita-fecha"
                name="fecha"
                type="date"
                required
                min={hoy}
                max={sumarDias(hoy, MAX_DIAS_ADELANTE)}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="cita-hora" className="sr-only">
                Hora
              </label>
              <input id="cita-hora" name="hora" type="time" required defaultValue={cita?.hora ?? ""} className={INPUT} />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="cita-notas" className={LEYENDA}>
            Nota <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <textarea
            id="cita-notas"
            name="notas"
            rows={2}
            maxLength={500}
            defaultValue={cita?.notas ?? ""}
            placeholder="Ej: revisar fuga de gas"
            className="w-full rounded-xl border border-stone-300/70 bg-white px-4 py-3 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
          />
        </div>

        {estado.error && (
          <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-semibold text-white active:bg-accent-700 disabled:opacity-60"
        >
          {pendiente && <Snowflake className="size-5 animate-copo" aria-hidden />}
          {editando ? "Guardar cambios" : "Agendar cita"}
        </button>
      </form>
    </Drawer>
  );
}
