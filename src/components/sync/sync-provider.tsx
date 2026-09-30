"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { obtenerSnapshot, procesarOperacion } from "@/app/(app)/sync/actions";
import {
  EVENTO_COLA,
  actualizarItem,
  eliminarItem,
  encolarOperacion,
  guardarCache,
  leerBlob,
  leerCache,
  listarCola,
  pedirPersistencia,
  type ItemCola,
} from "@/lib/offline/almacen";
import type { Operacion } from "@/lib/offline/operaciones";
import { vaciarCola } from "@/lib/offline/sincronizador";
import { CLAVE_SNAPSHOT, type Snapshot } from "@/lib/offline/snapshot";
import type { ResultadoOperacion } from "@/lib/servidor/operaciones";

export type ResultadoRegistro =
  | { estado: "sincronizado" }
  | { estado: "en_cola" }
  | { estado: "error"; error: string };

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

const INTERVALO_SYNC_MS = 30_000;
const SNAPSHOT_MAX_EDAD_MS = 10 * 60_000;

function suscribirRed(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function extensionDe(blob: Blob): string {
  return blob.type === "image/jpeg" ? "jpg" : "webp";
}

async function enviar(op: Operacion, archivo?: Blob | null): Promise<ResultadoOperacion> {
  const datos = new FormData();
  datos.set("op", JSON.stringify(op));
  if (archivo) {
    datos.set("archivo", new File([archivo], `adjunto.${extensionDe(archivo)}`, { type: archivo.type }));
  }
  return procesarOperacion(datos);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const navegadorEnLinea = useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true
  );
  const [redCaida, setRedCaida] = useState(false);
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const redCaidaRef = useRef(false);
  const exclusion = useRef<Promise<unknown>>(Promise.resolve());

  const marcarRed = useCallback((caida: boolean) => {
    redCaidaRef.current = caida;
    setRedCaida(caida);
  }, []);

  /** Serializa registrar/sincronizar para no enviar dos veces ni desordenar la cola. */
  const enExclusion = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const p = exclusion.current.then(fn, fn);
    exclusion.current = p.catch(() => undefined);
    return p;
  }, []);

  const refrescarCola = useCallback(async () => {
    try {
      setCola(await listarCola());
    } catch {
      setCola([]);
    }
  }, []);

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
    [enExclusion, marcarRed, router, sincronizar]
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

  // ---- efectos de arranque y disparadores de sincronización ----
  useEffect(() => {
    void pedirPersistencia();
    void (async () => {
      setCola(await listarCola().catch(() => []));
      const guardado = await leerCache<Snapshot>(CLAVE_SNAPSHOT);
      if (guardado) setSnapshot(guardado.valor);
      if (!guardado || Date.now() - guardado.guardado > SNAPSHOT_MAX_EDAD_MS) void refrescarSnapshot();
    })();
    window.addEventListener(EVENTO_COLA, refrescarCola);
    return () => window.removeEventListener(EVENTO_COLA, refrescarCola);
  }, [refrescarCola, refrescarSnapshot]);

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

  const valor = useMemo<Contexto>(
    () => ({
      online: navegadorEnLinea && !redCaida,
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
    [
      navegadorEnLinea,
      redCaida,
      cola,
      sincronizando,
      sesionExpirada,
      snapshot,
      registrar,
      sincronizar,
      reintentarFallida,
      descartar,
    ]
  );

  return <SyncContext.Provider value={valor}>{children}</SyncContext.Provider>;
}

export function useSync(): Contexto {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync debe usarse dentro de <SyncProvider>");
  return ctx;
}
