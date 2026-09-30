/**
 * Almacenamiento local persistente (IndexedDB) — SOLO navegador.
 *
 * Tres almacenes:
 *   - outbox : cola de sincronización (operaciones pendientes, en orden FIFO por `seq`).
 *   - blobs  : fotos (recibos / evidencias) pendientes de subir. Van aparte porque
 *              IndexedDB guarda Blobs de forma nativa (sin base64).
 *   - cache  : datos de referencia (snapshot de vehículos y órdenes, plantillas de
 *              gasto, operador actual) para poder trabajar sin red.
 *
 * Persistencia: se pide `navigator.storage.persist()` para que el navegador no
 * borre estos datos por falta de espacio (importante: la cola contiene dinero).
 */
import type { Operacion } from "@/lib/offline/operaciones";

const NOMBRE_DB = "polo-air-cool";
const VERSION_DB = 1;
const OUTBOX = "outbox";
const BLOBS = "blobs";
const CACHE = "cache";

export type EstadoItem = "pendiente" | "fallida";

export type ItemCola = {
  seq: number;
  operacion: Operacion;
  /** Clave del Blob adjunto en el almacén `blobs` (si la operación trae imagen). */
  blobId: string | null;
  creada: number; // epoch ms
  intentos: number;
  estado: EstadoItem;
  error: string | null;
};

/** Evento que avisa a la interfaz que la cola cambió (mismo documento). */
export const EVENTO_COLA = "polo:cola";

let promesaDb: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible en este navegador."));
  }
  if (!promesaDb) {
    promesaDb = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OUTBOX)) {
          db.createObjectStore(OUTBOX, { keyPath: "seq", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: "clave" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        promesaDb = null;
        reject(req.error ?? new Error("No se pudo abrir IndexedDB."));
      };
    });
  }
  return promesaDb;
}

function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function terminada(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada."));
  });
}

function avisarCambio() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_COLA));
}

/** Pide al navegador que NO purgue estos datos (la cola contiene registros sin sincronizar). */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* no crítico */
  }
  return false;
}

// ---------------------------------------------------------------------
// Cola de sincronización
// ---------------------------------------------------------------------

export async function encolarOperacion(operacion: Operacion, archivo?: Blob | null): Promise<number> {
  const db = await abrir();
  const blobId = archivo ? `blob-${crypto.randomUUID()}` : null;
  const tx = db.transaction([OUTBOX, BLOBS], "readwrite");
  if (archivo && blobId) tx.objectStore(BLOBS).put({ id: blobId, blob: archivo });
  const seq = await pedir(
    tx.objectStore(OUTBOX).add({
      operacion,
      blobId,
      creada: Date.now(),
      intentos: 0,
      estado: "pendiente",
      error: null,
    } satisfies Omit<ItemCola, "seq">)
  );
  await terminada(tx);
  avisarCambio();
  return Number(seq);
}

export async function listarCola(): Promise<ItemCola[]> {
  const db = await abrir();
  const items = await pedir(db.transaction(OUTBOX).objectStore(OUTBOX).getAll());
  return (items as ItemCola[]).sort((a, b) => a.seq - b.seq);
}

export async function actualizarItem(
  seq: number,
  cambios: Partial<Pick<ItemCola, "estado" | "error" | "intentos">>
): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(OUTBOX, "readwrite");
  const store = tx.objectStore(OUTBOX);
  const actual = (await pedir(store.get(seq))) as ItemCola | undefined;
  if (actual) store.put({ ...actual, ...cambios });
  await terminada(tx);
  avisarCambio();
}

export async function eliminarItem(seq: number): Promise<void> {
  const db = await abrir();
  const tx = db.transaction([OUTBOX, BLOBS], "readwrite");
  const item = (await pedir(tx.objectStore(OUTBOX).get(seq))) as ItemCola | undefined;
  tx.objectStore(OUTBOX).delete(seq);
  if (item?.blobId) tx.objectStore(BLOBS).delete(item.blobId);
  await terminada(tx);
  avisarCambio();
}

export async function leerBlob(id: string): Promise<Blob | null> {
  const db = await abrir();
  const fila = (await pedir(db.transaction(BLOBS).objectStore(BLOBS).get(id))) as
    | { id: string; blob: Blob }
    | undefined;
  return fila?.blob ?? null;
}

// ---------------------------------------------------------------------
// Caché de datos de referencia
// ---------------------------------------------------------------------

export async function guardarCache<T>(clave: string, valor: T): Promise<void> {
  const db = await abrir();
  const tx = db.transaction(CACHE, "readwrite");
  tx.objectStore(CACHE).put({ clave, valor, guardado: Date.now() });
  await terminada(tx);
}

export async function leerCache<T>(clave: string): Promise<{ valor: T; guardado: number } | null> {
  try {
    const db = await abrir();
    const fila = (await pedir(db.transaction(CACHE).objectStore(CACHE).get(clave))) as
      | { clave: string; valor: T; guardado: number }
      | undefined;
    return fila ? { valor: fila.valor, guardado: fila.guardado } : null;
  } catch {
    return null;
  }
}

/** Borra la caché de referencia (al cerrar sesión). NO toca la cola de pendientes. */
export async function limpiarCacheReferencia(): Promise<void> {
  try {
    const db = await abrir();
    const tx = db.transaction(CACHE, "readwrite");
    tx.objectStore(CACHE).clear();
    await terminada(tx);
  } catch {
    /* no crítico */
  }
}
