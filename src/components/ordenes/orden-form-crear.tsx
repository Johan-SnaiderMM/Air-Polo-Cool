"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload } from "lucide-react";
import type { VehiculoResultado } from "@/app/(app)/ordenes/actions";
import {
  BotonEnviar,
  CamposOrden,
  LEYENDA,
  MensajeForm,
  useValoresOrden,
} from "@/components/ordenes/orden-campos";
import { VehiculoSelector, type SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { VALORES_NUEVA, armarOrdenNueva } from "@/lib/orden-nueva";

/**
 * CREAR una orden. Funciona sin conexión: los ids se generan en el teléfono y la orden pasa por la
 * cola de sincronización (misma validación e idempotencia que en línea). La validación vive en
 * lib/orden-nueva.ts; aquí solo se recogen los datos y se informa del resultado.
 */
export function OrdenFormCrear({
  vehiculoInicial,
  citaId = null,
}: {
  vehiculoInicial?: VehiculoResultado | null;
  /** Cita de la agenda de la que viene la orden: se cierra cuando la orden se guarda. */
  citaId?: string | null;
}) {
  const router = useRouter();
  const { registrar } = useSync();
  const { autor } = useAutor();

  const { valores, cambiar, reiniciar } = useValoresOrden(VALORES_NUEVA);
  const [vehiculo, setVehiculo] = useState<SeleccionVehiculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCola, setEnCola] = useState(false);
  const [creando, iniciar] = useTransition();

  const alElegirVehiculo = useCallback((s: SeleccionVehiculo | null) => setVehiculo(s), []);

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const r = armarOrdenNueva({ valores, vehiculo, autor, citaId });
    if (!r.ok) return setError(r.error);

    iniciar(async () => {
      const res = await registrar({ tipo: "orden.crear", datos: r.valor });
      if (res.estado === "error") setError(res.error);
      else if (res.estado === "sincronizado") router.push(`/ordenes/${r.valor.id}`);
      else setEnCola(true);
    });
  }

  if (enCola) {
    return (
      <div className="space-y-4 rounded-2xl border border-ochre-300 bg-ochre-50 p-5 text-center">
        <CloudUpload className="mx-auto size-9 text-ochre-700" strokeWidth={1.5} aria-hidden />
        <p className="font-serif text-2xl text-ochre-800">Orden guardada en el teléfono</p>
        <p className="text-sm text-ochre-800">
          No hay conexión: la orden se subirá sola cuando vuelva la red. Las fotos podrás agregarlas cuando esté
          sincronizada.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEnCola(false);
              reiniciar(VALORES_NUEVA);
              setVehiculo(null);
              router.refresh();
            }}
            className="h-12 rounded-xl border border-ochre-300 bg-white text-sm font-medium active:bg-ochre-100"
          >
            Crear otra
          </button>
          <Link
            href="/ordenes"
            className="flex h-12 items-center justify-center rounded-xl bg-ink text-sm font-medium text-white active:bg-ink-soft"
          >
            Ir a órdenes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={crear} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className={LEYENDA}>Vehículo</legend>
        <VehiculoSelector inicial={vehiculoInicial ?? null} onChange={alElegirVehiculo} />
      </fieldset>

      <CamposOrden valores={valores} onCambio={cambiar} fechaEntrega={null} />

      {error && <MensajeForm tipo="error" texto={error} />}
      <BotonEnviar pendiente={creando} texto="Crear orden" />
    </form>
  );
}
