"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { procesarOperacion } from "@/app/(app)/sync/actions";
import {
  EVENTO_COLA,
  actualizarItem,
  eliminarItem,
  encolarOperacion,
  leerBlob,
  listarCola,
  pedirPersistencia,
  type ItemCola,
} from "@/lib/offline/almacen";
import { armarFormularioOperacion } from "@/lib/offline/envio";
import type { Operacion } from "@/lib/offline/operaciones";
import { vaciarCola } from "@/lib/offline/sincronizador";
import type { ResultadoOperacion } from "@/lib/servidor/operaciones";

export type ResultadoRegistro =
  | { estado: "sincronizado" }
  | { estado: "en_cola" }
  | { estado: "error"; error: string };

const INTERVALO_SYNC_MS = 30_000;

function enviar(op: Operacion, archivo?: Blob | null): Promise<ResultadoOperacion> {
  return procesarOperacion(armarFormularioOperacion(op, archivo));
}

/**
 * Cola de sincronización: registrar (directo si hay red, si no a la cola), vaciarla cuando vuelve
 * la conexión y reintentar o descartar lo que falló. La lógica de vaciado está en
 * lib/offline/sincronizador.ts (pura y probada); aquí solo se conecta con React y la red.
 */
export function useCola({
  marcarRed,
  redCaidaRef,
  refrescarSnapshot,
}: {
  marcarRed: (caida: boolean) => void;
  redCaidaRef: MutableRefObject<boolean>;
  refrescarSnapshot: () => Promise<void>;
}) {
  const router = useRouter();
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const exclusion = useRef<Promise<unknown>>(Promise.resolve());

  /** Serializa registrar/sincronizar para no enviar dos veces ni desordenar la cola. */
  const enExclusion = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const p = exclusion.current.then(fn, fn);
    exclusion.current = p.catch(() => undefined);
    return p;
  }, []);

  const refrescarCola = useCallback(async () => {
    try {
      setCola(await listarCola());
    } catch (e) {
      // Sin almacenamiento local la cola parece vacía: se deja constancia para poder diagnosticarlo.
      console.warn("[sync] No se pudo leer la cola local:", e);
      setCola([]);
    }
  }, []);

  const sincronizar = useCallback(
    () =>
      enExclusion(async () => {
        if (!navigator.onLine) return;
        if ((await listarCola()).every((i) => i.estado !== "pendiente")) return;

        setSincronizando(true);
        try {
          const r = await vaciarCola({
            listar: listarCola,
            leerBlob,
            enviar,
            eliminar: eliminarItem,
            actualizar: actualizarItem,
          });
          marcarRed(r.parada === "red");
          if (r.parada === "sesion") setSesionExpirada(true);
          else if (r.enviadas > 0) setSesionExpirada(false);
          if (r.enviadas > 0) {
            router.refresh();
            void refrescarSnapshot();
          }
        } finally {
          setSincronizando(false);
        }
      }),
    [enExclusion, marcarRed, refrescarSnapshot, router]
  );

  /**
   * Si hay red y la cola está vacía envía directo (y devuelve el error real si el servidor lo
   * rechaza); si no, guarda la operación en el teléfono y la sincroniza cuando vuelva la conexión.
   */
  const registrar = useCallback(
    (op: Operacion, archivo?: Blob | null) =>
      enExclusion<ResultadoRegistro>(async () => {
        const hayPendientes = (await listarCola()).some((i) => i.estado === "pendiente");
        if (navigator.onLine && !redCaidaRef.current && !hayPendientes) {
          try {
            const r = await enviar(op, archivo);
            marcarRed(false);
            if (r.ok) {
              router.refresh();
              return { estado: "sincronizado" };
            }
            if (r.sesion) setSesionExpirada(true);
            else if (r.permanente) return { estado: "error", error: r.error };
            // error transitorio o sesión: cae a la cola
          } catch {
            marcarRed(true);
          }
        }
        try {
          await encolarOperacion(op, archivo);
        } catch (e) {
          return {
            estado: "error",
            error:
              e instanceof Error
                ? `No se pudo guardar en el teléfono: ${e.message}`
                : "No se pudo guardar en el teléfono.",
          };
        }
        setTimeout(() => void sincronizar(), 0);
        return { estado: "en_cola" };
      }),
    [enExclusion, marcarRed, redCaidaRef, router, sincronizar]
  );

  const reintentarFallida = useCallback(
    async (seq: number) => {
      await actualizarItem(seq, { estado: "pendiente", error: null });
      await sincronizar();
    },
    [sincronizar]
  );

  const descartar = useCallback(async (seq: number) => {
    await eliminarItem(seq);
  }, []);

  // ---- arranque y disparadores de sincronización ----
  useEffect(() => {
    void pedirPersistencia();
    void (async () => setCola(await listarCola().catch(() => [])))();
    window.addEventListener(EVENTO_COLA, refrescarCola);
    return () => window.removeEventListener(EVENTO_COLA, refrescarCola);
  }, [refrescarCola]);

  useEffect(() => {
    const alVolverLaRed = () => {
      marcarRed(false);
      void sincronizar();
      void refrescarSnapshot();
    };
    window.addEventListener("online", alVolverLaRed);
    if (navigator.onLine) void sincronizar(); // arranque: vacía lo que haya quedado en cola
    return () => window.removeEventListener("online", alVolverLaRed);
  }, [marcarRed, sincronizar, refrescarSnapshot]);

  useEffect(() => {
    const id = setInterval(() => void sincronizar(), INTERVALO_SYNC_MS);
    return () => clearInterval(id);
  }, [sincronizar]);

  return { cola, sincronizando, sesionExpirada, registrar, sincronizar, reintentarFallida, descartar };
}
