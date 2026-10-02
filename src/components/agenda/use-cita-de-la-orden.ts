"use client";

import { useCallback, useEffect, useState } from "react";
import { citasDelVehiculo } from "@/app/(app)/agenda/actions";
import { useSync } from "@/components/sync/sync-provider";
import { eleccionPorDefecto, type CitaDeVehiculo } from "@/lib/agenda";

/** Cuánto se espera la respuesta de la agenda antes de seguir sin ella (no debe frenar el ingreso). */
const ESPERA_MAX_MS = 6000;

type Cargado = { vehiculoId: string; citas: CitaDeVehiculo[]; eleccion: string | undefined };

/**
 * Al recibir un vehículo ya registrado, consulta si tiene citas pendientes (hoy y próximos 7 días) y
 * guarda qué respondió el usuario: la cita de hoy (o la de la que se llegó) viene elegida; las de los
 * próximos días hay que preguntarlas. Sin conexión o si la agenda no responde, no hay citas y el
 * ingreso sigue sin ellas: crear la orden nunca depende de la agenda.
 */
export function useCitaDeLaOrden(vehiculoId: string | null, citaInicial: string | null) {
  const { online } = useSync();
  const [cargado, setCargado] = useState<Cargado | null>(null);

  useEffect(() => {
    if (!vehiculoId) return;
    let vigente = true;
    const sinCitas = { ok: false as const };
    const consulta = online
      ? Promise.race([
          citasDelVehiculo({ vehiculoId, incluirId: citaInicial }),
          new Promise<typeof sinCitas>((resolver) => setTimeout(() => resolver(sinCitas), ESPERA_MAX_MS)),
        ])
      : Promise.resolve(sinCitas);

    consulta
      .catch(() => sinCitas)
      .then((r) => {
        if (!vigente) return;
        const citas = r.ok ? r.citas : [];
        setCargado({ vehiculoId, citas, eleccion: eleccionPorDefecto(citas, citaInicial) });
      });
    return () => {
      vigente = false;
    };
  }, [vehiculoId, citaInicial, online]);

  // Lo cargado para OTRO vehículo (se cambió la selección) no cuenta.
  const actual = cargado && cargado.vehiculoId === vehiculoId ? cargado : null;
  const elegir = useCallback((eleccion: string) => setCargado((c) => (c ? { ...c, eleccion } : c)), []);

  return {
    citas: actual?.citas ?? [],
    eleccion: actual?.eleccion,
    elegir,
    /** Hay un vehículo elegido y la agenda aún no respondió. */
    cargando: vehiculoId !== null && actual === null,
  };
}
