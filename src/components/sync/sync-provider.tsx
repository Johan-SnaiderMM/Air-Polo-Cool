"use client";

import { createContext, useContext, useMemo } from "react";
import { useCola, type ResultadoRegistro } from "@/components/sync/use-cola";
import { useRed } from "@/components/sync/use-red";
import { useSnapshot } from "@/components/sync/use-snapshot";
import type { ItemCola } from "@/lib/offline/almacen";
import type { Operacion } from "@/lib/offline/operaciones";
import type { Snapshot } from "@/lib/offline/snapshot";

export type { ResultadoRegistro };

type Contexto = {
  /** Conexión efectiva: navegador en línea Y último intento de red exitoso. */
  online: boolean;
  cola: ItemCola[];
  pendientes: number;
  fallidas: number;
  sincronizando: boolean;
  sesionExpirada: boolean;
  snapshot: Snapshot | null;
  /**
   * Registra una operación: si hay red y la cola está vacía la envía directo (y devuelve
   * el error real si el servidor la rechaza); si no, la guarda en el teléfono y la
   * sincroniza cuando vuelva la conexión.
   */
  registrar: (op: Operacion, archivo?: Blob | null) => Promise<ResultadoRegistro>;
  sincronizar: () => Promise<void>;
  reintentarFallida: (seq: number) => Promise<void>;
  descartar: (seq: number) => Promise<void>;
};

const SyncContext = createContext<Contexto | null>(null);

/**
 * Reúne las tres piezas del trabajo sin conexión y las expone por contexto:
 *  - `useRed`: estado de la conexión.
 *  - `useSnapshot`: datos de referencia guardados en el teléfono.
 *  - `useCola`: registrar, sincronizar y reintentar operaciones pendientes.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { online, redCaidaRef, marcarRed } = useRed();
  const { snapshot, refrescarSnapshot } = useSnapshot(marcarRed);
  const { cola, sincronizando, sesionExpirada, registrar, sincronizar, reintentarFallida, descartar } = useCola({
    marcarRed,
    redCaidaRef,
    refrescarSnapshot,
  });

  const valor = useMemo<Contexto>(
    () => ({
      online,
      cola,
      pendientes: cola.filter((i) => i.estado === "pendiente").length,
      fallidas: cola.filter((i) => i.estado === "fallida").length,
      sincronizando,
      sesionExpirada,
      snapshot,
      registrar,
      sincronizar,
      reintentarFallida,
      descartar,
    }),
    [online, cola, sincronizando, sesionExpirada, snapshot, registrar, sincronizar, reintentarFallida, descartar]
  );

  return <SyncContext.Provider value={valor}>{children}</SyncContext.Provider>;
}

export function useSync(): Contexto {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync debe usarse dentro de <SyncProvider>");
  return ctx;
}
