"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerSnapshot } from "@/app/(app)/sync/actions";
import { guardarCache, leerCache } from "@/lib/offline/almacen";
import { CLAVE_SNAPSHOT, type Snapshot } from "@/lib/offline/snapshot";

const SNAPSHOT_MAX_EDAD_MS = 10 * 60_000;

/**
 * Datos de referencia (vehículos y órdenes) para trabajar sin conexión. Al arrancar carga la
 * copia guardada en el teléfono y, si es vieja o no existe, pide una nueva al servidor.
 */
export function useSnapshot(marcarRed: (caida: boolean) => void) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const refrescarSnapshot = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const nuevo = await obtenerSnapshot();
      if (nuevo) {
        await guardarCache(CLAVE_SNAPSHOT, nuevo);
        setSnapshot(nuevo);
        marcarRed(false);
      }
    } catch {
      /* sin red: se conserva el snapshot anterior */
    }
  }, [marcarRed]);

  useEffect(() => {
    void (async () => {
      const guardado = await leerCache<Snapshot>(CLAVE_SNAPSHOT);
      if (guardado) setSnapshot(guardado.valor);
      if (!guardado || Date.now() - guardado.guardado > SNAPSHOT_MAX_EDAD_MS) void refrescarSnapshot();
    })();
  }, [refrescarSnapshot]);

  return { snapshot, refrescarSnapshot };
}
