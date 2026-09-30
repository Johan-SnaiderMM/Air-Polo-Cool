/**
 * Supabase SIMULADO para probar Server Actions y cargadores sin red ni base de datos.
 *
 * Registra cada consulta (tabla, operación, datos, filtros), cada RPC y cada subida a Storage, y
 * responde lo que decida la prueba con `responder`. Lo que se comprueba es lo que la acción LE
 * PIDE a la base (qué inserta, con qué filtros, qué RPC llama) y cómo reacciona a sus respuestas
 * (errores, cero filas por RLS, duplicados). Las reglas propias de Postgres (triggers, RLS) se
 * verifican aparte, con PGlite, en src/types/database.contract.test.ts.
 */
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type ErrorFalso = { code?: string; message: string; hint?: string | null };

export type Llamada = {
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  tabla?: string;
  rpc?: string;
  /** Lo que se inserta/actualiza, o los argumentos del RPC. */
  payload?: unknown;
  filtros: { col: string; op: string; valor: unknown }[];
  seleccion: string;
};

export type Respuesta = { data?: unknown; error?: ErrorFalso | null };

export type OpcionesFalso = {
  /** Decide qué responde la «base» a cada consulta. Sin respuesta: `{ data: null }`. */
  responder?: (llamada: Llamada) => Respuesta | undefined;
  /** Usuario de la sesión; `null` = sin sesión. Por defecto, un operario. */
  usuario?: { app_metadata?: { rol?: string } } | null;
  /** Error al subir a Storage (por defecto, sube bien). */
  errorSubida?: ErrorFalso | null;
};

export function crearSupabaseFalso(opciones: OpcionesFalso = {}) {
  const llamadas: Llamada[] = [];
  const subidas: { bucket: string; ruta: string; tipo?: string }[] = [];
  const borrados: { bucket: string; rutas: string[] }[] = [];
  const usuario = opciones.usuario === undefined ? { app_metadata: { rol: "operario" } } : opciones.usuario;

  const responder = (l: Llamada): Respuesta => {
    llamadas.push({ ...l, filtros: [...l.filtros] });
    return opciones.responder?.(l) ?? { data: null };
  };

  const constructor = (tabla: string) => {
    const l: Llamada = { op: "select", tabla, filtros: [], seleccion: "" };
    const b: Record<string, unknown> = {};
    const accion = (op: Llamada["op"]) => (payload?: unknown) => {
      l.op = op;
      l.payload = payload;
      return b;
    };
    b.insert = accion("insert");
    b.update = accion("update");
    b.delete = accion("delete");
    b.upsert = accion("upsert");
    b.select = (s?: string) => {
      l.seleccion = s ?? "*";
      return b;
    };
    for (const f of ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "like", "ilike"]) {
      b[f] = (col: string, valor?: unknown) => {
        l.filtros.push({ col, op: f, valor });
        return b;
      };
    }
    // .or("a.eq.1,b.eq.2") lleva un solo argumento: el filtro completo.
    b.or = (filtro: string) => {
      l.filtros.push({ col: "", op: "or", valor: filtro });
      return b;
    };
    for (const m of ["order", "limit", "range"]) b[m] = () => b;

    b.maybeSingle = async () => {
      const r = responder(l);
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : (r.data ?? null), error: r.error ?? null };
    };
    b.single = b.maybeSingle;
    b.then = (ok: (v: unknown) => unknown, fallo: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          const r = responder(l);
          return { data: r.data ?? null, error: r.error ?? null, count: null };
        })
        .then(ok, fallo);
    return b;
  };

  const cliente = {
    from: constructor,
    rpc: (nombre: string, args?: unknown) =>
      Promise.resolve().then(() => {
        const r = responder({ op: "rpc", rpc: nombre, payload: args, filtros: [], seleccion: "" });
        return { data: r.data ?? null, error: r.error ?? null };
      }),
    auth: { getUser: async () => ({ data: { user: usuario }, error: null }) },
    storage: {
      from: (bucket: string) => ({
        upload: async (ruta: string, _cuerpo: unknown, o?: { contentType?: string }) => {
          subidas.push({ bucket, ruta, tipo: o?.contentType });
          return { data: opciones.errorSubida ? null : { path: ruta }, error: opciones.errorSubida ?? null };
        },
        remove: async (rutas: string[]) => {
          borrados.push({ bucket, rutas });
          return { data: [], error: null };
        },
        createSignedUrls: async (rutas: string[]) => ({
          data: rutas.map((path) => ({ path, signedUrl: `https://firmada/${bucket}/${path}`, error: null })),
        }),
      }),
    },
  } as unknown as ClienteServidor;

  return {
    cliente,
    llamadas,
    subidas,
    borrados,
    /** Llamadas de una operación sobre una tabla (o RPC), para asertar sobre ellas. */
    de: (op: Llamada["op"], tablaORpc?: string) =>
      llamadas.filter((l) => l.op === op && (tablaORpc === undefined || l.tabla === tablaORpc || l.rpc === tablaORpc)),
  };
}

// ---------------------------------------------------------------------
// Sustituto de `@/utils/supabase/server` para las pruebas de acciones
// ---------------------------------------------------------------------

/** La prueba deja aquí el cliente simulado que debe recibir la acción. */
export const sesionFalsa: { cliente: ClienteServidor | null } = { cliente: null };

/**
 * Uso en cada prueba (vi.mock se eleva al inicio del archivo, por eso la importación dinámica):
 *   vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
 */
export function moduloServidorFalso() {
  return {
    createClient: async () => {
      if (!sesionFalsa.cliente) throw new Error("La prueba no definió sesionFalsa.cliente");
      return sesionFalsa.cliente;
    },
  };
}
