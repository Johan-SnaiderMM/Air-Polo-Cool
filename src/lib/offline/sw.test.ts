import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba de la ESTRATEGIA del service worker (public/sw.js) con un entorno simulado:
 * cachés en memoria, fetch controlable y peticiones falsas. No prueba el registro en un
 * navegador real, pero sí qué se cachea, qué se ignora y cómo responde sin red.
 */
type Resp = Response & { _cuerpo?: string };
type Peticion = {
  url: string;
  method: string;
  mode: string;
  headers: { get: (k: string) => string | null };
};

const codigo = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGEN = "https://taller.test";

function respuesta(cuerpo: string, extra: Partial<{ ok: boolean; redirected: boolean; type: string; status: number }> = {}): Resp {
  return {
    ok: extra.ok ?? true,
    status: extra.status ?? 200,
    redirected: extra.redirected ?? false,
    type: extra.type ?? "basic",
    _cuerpo: cuerpo,
    clone() {
      return this;
    },
  } as unknown as Resp;
}

function crearEntorno() {
  const almacenes = new Map<string, Map<string, Resp>>();
  const manejadores: Record<string, (e: unknown) => void> = {};
  const red = { activa: true, respuestas: new Map<string, Resp>() };

  const abrir = (nombre: string) => {
    if (!almacenes.has(nombre)) almacenes.set(nombre, new Map());
    const m = almacenes.get(nombre)!;
    return {
      async match(req: Peticion | string, opts?: { ignoreSearch?: boolean }) {
        const url = typeof req === "string" ? req : req.url;
        const clave = opts?.ignoreSearch ? url.split("?")[0] : url;
        for (const [k, v] of m) if ((opts?.ignoreSearch ? k.split("?")[0] : k) === clave) return v;
        return undefined;
      },
      async put(req: Peticion, res: Resp) {
        m.set(req.url, res);
      },
      async keys() {
        return [...m.keys()].map((url) => ({ url }));
      },
      async delete(k: { url: string } | string) {
        return m.delete(typeof k === "string" ? k : k.url);
      },
      async addAll(urls: string[]) {
        for (const u of urls) m.set(`${ORIGEN}${u}`, respuesta(`estatico:${u}`));
      },
    };
  };

  const caches = {
    open: async (n: string) => abrir(n),
    keys: async () => [...almacenes.keys()],
    delete: async (n: string) => almacenes.delete(n),
    match: async (req: string) => {
      for (const m of almacenes.values()) {
        const r = m.get(req.startsWith("http") ? req : `${ORIGEN}${req}`);
        if (r) return r;
      }
      return undefined;
    },
  };

  const fetchFalso = vi.fn(async (req: Peticion) => {
    if (!red.activa) throw new TypeError("Failed to fetch");
    return red.respuestas.get(req.url) ?? respuesta(`red:${req.url}`);
  });

  const avisos = { mostrados: [] as { titulo: string; opciones: Record<string, unknown> }[], abiertas: [] as string[], ventanas: [] as { focus: () => Promise<void>; navigate?: (u: string) => Promise<unknown> }[] };

  const self = {
    location: { origin: ORIGEN },
    registration: {
      showNotification: async (titulo: string, opciones: Record<string, unknown>) => {
        avisos.mostrados.push({ titulo, opciones });
      },
    },
    addEventListener: (tipo: string, fn: (e: unknown) => void) => {
      manejadores[tipo] = fn;
    },
    skipWaiting: async () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async () => avisos.ventanas,
      openWindow: async (u: string) => {
        avisos.abiertas.push(u);
      },
    },
  };

  new Function("self", "caches", "fetch", codigo)(self, caches, fetchFalso);

  /** Dispara un fetch y devuelve la respuesta (o null si el SW lo ignoró). */
  async function pedir(p: Partial<Peticion> & { url: string; cabeceras?: Record<string, string> }) {
    const cabeceras = p.cabeceras ?? {};
    const req: Peticion = {
      url: p.url.startsWith("http") ? p.url : `${ORIGEN}${p.url}`,
      method: p.method ?? "GET",
      mode: p.mode ?? "cors",
      headers: { get: (k: string) => cabeceras[k] ?? null },
    };
    const capturada: { promesa: Promise<Resp> | null } = { promesa: null };
    manejadores.fetch({ request: req, respondWith: (pr: Promise<Resp>) => (capturada.promesa = pr) });
    return capturada.promesa ? await capturada.promesa : null;
  }

  return { almacenes, red, pedir, manejadores, caches, avisos };
}

let e: ReturnType<typeof crearEntorno>;
beforeEach(() => {
  e = crearEntorno();
});

describe("service worker: qué ignora", () => {
  it("no toca POST (Server Actions y cola offline)", async () => {
    expect(await e.pedir({ url: "/ordenes", method: "POST", mode: "navigate" })).toBeNull();
  });
  it("no toca el portal público, la exportación CSV, otros orígenes ni precargas", async () => {
    expect(await e.pedir({ url: "/orden/abc123", mode: "navigate" })).toBeNull();
    expect(await e.pedir({ url: "/caja-menor/exportar?mes=2026-09", mode: "navigate" })).toBeNull();
    expect(await e.pedir({ url: "https://otro.com/x.js" })).toBeNull();
    expect(await e.pedir({ url: "/ordenes", cabeceras: { "Next-Router-Prefetch": "1", RSC: "1" } })).toBeNull();
    expect(await e.pedir({ url: "/api/algo" })).toBeNull(); // GET que no es navegación/RSC/estático
  });
});

describe("service worker: páginas (network-first)", () => {
  it("en línea devuelve la red y guarda la copia", async () => {
    const r = await e.pedir({ url: "/ordenes", mode: "navigate" });
    expect(r?._cuerpo).toBe(`red:${ORIGEN}/ordenes`);
    expect(e.almacenes.get("pac-paginas-v1")?.has(`${ORIGEN}/ordenes`)).toBe(true);
  });
  it("NO guarda redirecciones (p. ej. al login) ni errores", async () => {
    e.red.respuestas.set(`${ORIGEN}/ordenes`, respuesta("login", { redirected: true }));
    e.red.respuestas.set(`${ORIGEN}/inventario`, respuesta("error", { ok: false, status: 500 }));
    await e.pedir({ url: "/ordenes", mode: "navigate" });
    await e.pedir({ url: "/inventario", mode: "navigate" });
    expect(e.almacenes.get("pac-paginas-v1")?.size ?? 0).toBe(0);
  });
  it("sin red sirve la última copia vista", async () => {
    await e.pedir({ url: "/ordenes", mode: "navigate" });
    e.red.activa = false;
    const r = await e.pedir({ url: "/ordenes", mode: "navigate" });
    expect(r?._cuerpo).toBe(`red:${ORIGEN}/ordenes`);
  });
  it("sin red y sin copia muestra /offline.html", async () => {
    await e.manejadores.install({ waitUntil: (p: Promise<unknown>) => p });
    await new Promise((r) => setTimeout(r, 0));
    e.red.activa = false;
    const r = await e.pedir({ url: "/vehiculos", mode: "navigate" });
    expect(r?._cuerpo).toBe("estatico:/offline.html");
  });
});

describe("service worker: navegación interna (RSC)", () => {
  it("guarda el RSC en su propia caché y lo sirve sin red ignorando el parámetro _rsc", async () => {
    await e.pedir({ url: "/ordenes?_rsc=abc", cabeceras: { RSC: "1" } });
    expect(e.almacenes.get("pac-rsc-v1")?.size).toBe(1);
    expect(e.almacenes.get("pac-paginas-v1")?.size ?? 0).toBe(0); // no se mezcla con el HTML
    e.red.activa = false;
    const r = await e.pedir({ url: "/ordenes?_rsc=OTRO", cabeceras: { RSC: "1" } });
    expect(r?._cuerpo).toBe(`red:${ORIGEN}/ordenes?_rsc=abc`);
  });
  it("un RSC sin copia y sin red devuelve 503 (nunca un HTML)", async () => {
    e.red.activa = false;
    const r = await e.pedir({ url: "/caja-menor?_rsc=z", cabeceras: { RSC: "1" } });
    expect(r).not.toBeNull();
    expect((r as unknown as Response).status).toBe(503);
  });
});

describe("service worker: estáticos (cache-first)", () => {
  it("sirve de caché y refresca en segundo plano", async () => {
    const r1 = await e.pedir({ url: "/_next/static/chunk.js" });
    expect(r1?._cuerpo).toBe(`red:${ORIGEN}/_next/static/chunk.js`);
    e.red.activa = false;
    const r2 = await e.pedir({ url: "/_next/static/chunk.js" });
    expect(r2?._cuerpo).toBe(`red:${ORIGEN}/_next/static/chunk.js`);
  });
  it("cubre íconos e imágenes", async () => {
    expect(await e.pedir({ url: "/logo.png" })).not.toBeNull();
    expect(await e.pedir({ url: "/icons/icon-192.png" })).not.toBeNull();
  });
});

describe("service worker: ciclo de vida", () => {
  it("al activarse borra cachés de versiones anteriores", async () => {
    e.almacenes.set("pac-paginas-v0", new Map());
    e.almacenes.set("pac-estatico-v1", new Map());
    await e.manejadores.activate({ waitUntil: (p: Promise<unknown>) => p });
    await new Promise((r) => setTimeout(r, 0));
    expect(e.almacenes.has("pac-paginas-v0")).toBe(false);
    expect(e.almacenes.has("pac-estatico-v1")).toBe(true);
  });
});

describe("service worker: avisos (push)", () => {
  const recibir = async (datos: unknown, crudo = false) => {
    const evento = { data: { json: () => (crudo ? JSON.parse(String(datos)) : datos) }, waitUntil: (p: Promise<unknown>) => p };
    await e.manejadores.push(evento);
  };
  const tocar = async (data: unknown) => {
    const cerrada = vi.fn();
    await e.manejadores.notificationclick({ notification: { close: cerrada, data }, waitUntil: (p: Promise<unknown>) => p });
    return cerrada;
  };

  it("muestra el resumen con su título, texto, etiqueta (reemplaza al anterior) y la pantalla a abrir", async () => {
    await recibir({ titulo: "Agenda de hoy", cuerpo: "3 citas hoy · 2 por recordar", url: "/agenda", etiqueta: "agenda-dia" });
    expect(e.avisos.mostrados).toHaveLength(1);
    expect(e.avisos.mostrados[0].titulo).toBe("Agenda de hoy");
    expect(e.avisos.mostrados[0].opciones).toMatchObject({
      body: "3 citas hoy · 2 por recordar",
      tag: "agenda-dia",
      icon: "/icons/icon-192.png",
      data: { url: "/agenda" },
    });
  });

  it("siempre muestra algo, incluso si el aviso llega vacío o ilegible (el navegador lo exige)", async () => {
    await e.manejadores.push({ data: null, waitUntil: (p: Promise<unknown>) => p });
    await e.manejadores.push({ data: { json: () => { throw new Error("no es json"); } }, waitUntil: (p: Promise<unknown>) => p });
    expect(e.avisos.mostrados.map((m) => m.titulo)).toEqual(["Polo Air Cool", "Polo Air Cool"]);
    expect(e.avisos.mostrados[0].opciones).toMatchObject({ body: "", tag: "polo-aviso", data: { url: "/agenda" } });
  });

  it("al tocarlo sin la app abierta, abre la agenda", async () => {
    const cerrada = await tocar({ url: "/agenda" });
    await new Promise((r) => setTimeout(r, 0));
    expect(cerrada).toHaveBeenCalled();
    expect(e.avisos.abiertas).toEqual([`${ORIGEN}/agenda`]);
  });

  it("con la app ya abierta, la enfoca y la lleva a la agenda (sin abrir otra ventana)", async () => {
    const focus = vi.fn(async () => undefined);
    const navigate = vi.fn(async () => undefined);
    e.avisos.ventanas.push({ focus, navigate });
    await tocar({ url: "/agenda" });
    await new Promise((r) => setTimeout(r, 0));
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`${ORIGEN}/agenda`);
    expect(e.avisos.abiertas).toEqual([]);
  });

  it("un aviso nunca abre otro sitio: una dirección externa o inválida cae a la agenda", async () => {
    await tocar({ url: "https://malo.example/robo" });
    await tocar({ url: "http://[" });
    await tocar(undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(e.avisos.abiertas).toEqual([`${ORIGEN}/agenda`, `${ORIGEN}/agenda`, `${ORIGEN}/agenda`]);
  });
});
