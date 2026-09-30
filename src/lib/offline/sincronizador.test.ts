import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actualizarItem,
  eliminarItem,
  encolarOperacion,
  guardarCache,
  leerBlob,
  leerCache,
  limpiarCacheReferencia,
  listarCola,
  type ItemCola,
} from "@/lib/offline/almacen";
import type { Operacion } from "@/lib/offline/operaciones";
import { vaciarCola, type DependenciasCola } from "@/lib/offline/sincronizador";
import type { ResultadoOperacion } from "@/lib/servidor/operaciones";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const gasto = (monto: number): Operacion => ({
  tipo: "gasto.crear",
  datos: { id: crypto.randomUUID(), fecha: "2026-09-29", monto, categoria: "otros", descripcion: null, orden_id: null, autor: "Polo" },
});

/** Dependencias en memoria para probar el algoritmo sin red ni IndexedDB. */
function crearMundo(items: ItemCola[], respuestas: (op: Operacion, i: number) => ResultadoOperacion | "red") {
  const cola = items.map((x) => ({ ...x }));
  const enviados: number[] = [];
  const deps: DependenciasCola = {
    listar: async () => cola.map((x) => ({ ...x })),
    leerBlob: async (id) => (id === "sin-foto" ? null : new Blob(["x"], { type: "image/webp" })),
    enviar: async (op) => {
      const monto = op.tipo === "gasto.crear" ? op.datos.monto : 0;
      enviados.push(monto);
      const r = respuestas(op, enviados.length - 1);
      if (r === "red") throw new TypeError("Failed to fetch");
      return r;
    },
    eliminar: async (seq) => {
      cola.splice(cola.findIndex((x) => x.seq === seq), 1);
    },
    actualizar: async (seq, cambios) => {
      const it = cola.find((x) => x.seq === seq);
      if (it) Object.assign(it, cambios);
    },
  };
  return { cola, enviados, deps };
}

const item = (seq: number, monto: number, extra: Partial<ItemCola> = {}): ItemCola => ({
  seq, operacion: gasto(monto), blobId: null, creada: 0, intentos: 0, estado: "pendiente", error: null, ...extra,
});

describe("vaciarCola", () => {
  it("envía en orden FIFO y deja la cola vacía", async () => {
    const m = crearMundo([item(1, 100), item(2, 200), item(3, 300)], () => ({ ok: true }));
    const r = await vaciarCola(m.deps);
    expect(m.enviados).toEqual([100, 200, 300]);
    expect(r).toEqual({ enviadas: 3, fallidas: 0, parada: null });
    expect(m.cola).toHaveLength(0);
  });

  it("un error permanente marca la operación como fallida y sigue con las demás", async () => {
    const m = crearMundo([item(1, 100), item(2, 200), item(3, 300)], (_, i) =>
      i === 1 ? { ok: false, error: "La orden ya no existe.", permanente: true } : { ok: true }
    );
    const r = await vaciarCola(m.deps);
    expect(r).toEqual({ enviadas: 2, fallidas: 1, parada: null });
    expect(m.cola).toHaveLength(1);
    expect(m.cola[0]).toMatchObject({ seq: 2, estado: "fallida", error: "La orden ya no existe.", intentos: 1 });
  });

  it("sin red se detiene en la primera y NO toca nada (ni orden ni contadores)", async () => {
    const m = crearMundo([item(1, 100), item(2, 200)], () => "red");
    const r = await vaciarCola(m.deps);
    expect(r.parada).toBe("red");
    expect(m.enviados).toEqual([100]); // no se intenta la segunda
    expect(m.cola.map((x) => x.estado)).toEqual(["pendiente", "pendiente"]);
    expect(m.cola[0].intentos).toBe(0);
  });

  it("corte de red a mitad: lo enviado se elimina y lo demás queda para después", async () => {
    const m = crearMundo([item(1, 100), item(2, 200), item(3, 300)], (_, i) => (i === 0 ? { ok: true } : "red"));
    const r = await vaciarCola(m.deps);
    expect(r).toEqual({ enviadas: 1, fallidas: 0, parada: "red" });
    expect(m.cola.map((x) => x.seq)).toEqual([2, 3]);
  });

  it("error transitorio del servidor: se detiene, cuenta el intento y conserva el orden", async () => {
    const m = crearMundo([item(1, 100), item(2, 200)], () => ({ ok: false, error: "Timeout", permanente: false }));
    const r = await vaciarCola(m.deps);
    expect(r.parada).toBe("transitorio");
    expect(m.enviados).toEqual([100]);
    expect(m.cola[0]).toMatchObject({ seq: 1, estado: "pendiente", intentos: 1, error: "Timeout" });
  });

  it("sesión expirada: se detiene y conserva TODO sin marcar fallos", async () => {
    const m = crearMundo([item(1, 100), item(2, 200)], () => ({ ok: false, error: "sesión", permanente: false, sesion: true }));
    const r = await vaciarCola(m.deps);
    expect(r.parada).toBe("sesion");
    expect(m.cola).toHaveLength(2);
    expect(m.cola.every((x) => x.estado === "pendiente" && x.intentos === 0)).toBe(true);
  });

  it("una foto adjunta que se perdió se marca fallida sin enviarse", async () => {
    const m = crearMundo([item(1, 100, { blobId: "sin-foto" }), item(2, 200)], () => ({ ok: true }));
    const r = await vaciarCola(m.deps);
    expect(m.enviados).toEqual([200]);
    expect(r).toEqual({ enviadas: 1, fallidas: 1, parada: null });
    expect(m.cola[0]).toMatchObject({ seq: 1, estado: "fallida" });
  });

  it("ignora las ya fallidas (no se reenvían solas)", async () => {
    const m = crearMundo([item(1, 100, { estado: "fallida", error: "x" }), item(2, 200)], () => ({ ok: true }));
    await vaciarCola(m.deps);
    expect(m.enviados).toEqual([200]);
    expect(m.cola.map((x) => x.seq)).toEqual([1]);
  });

  it("un duplicado (ok + duplicado) se trata igual que un éxito: nunca se duplica el registro", async () => {
    const m = crearMundo([item(1, 100)], () => ({ ok: true, duplicado: true }));
    const r = await vaciarCola(m.deps);
    expect(r.enviadas).toBe(1);
    expect(m.cola).toHaveLength(0);
  });
});

describe("almacén local (IndexedDB)", () => {
  beforeEach(async () => {
    for (const i of await listarCola()) await eliminarItem(i.seq);
  });

  it("guarda la cola en orden de llegada con su foto adjunta", async () => {
    const foto = new Blob(["foto"], { type: "image/webp" });
    const a = await encolarOperacion(gasto(1000));
    const b = await encolarOperacion(
      { tipo: "evidencia.subir", conArchivo: true, datos: { id: ID, orden_id: ID, tipo: "ingreso", extension: "webp", notas: null } },
      foto
    );
    const cola = await listarCola();
    expect(cola.map((x) => x.seq)).toEqual([a, b]);
    expect(cola[0].estado).toBe("pendiente");
    expect(cola[1].blobId).toBeTruthy();
    const guardada = await leerBlob(cola[1].blobId!);
    expect(guardada?.type).toBe("image/webp");
    expect(guardada?.size).toBe(4);
  });

  it("eliminar un ítem borra también su foto", async () => {
    const seq = await encolarOperacion(
      { tipo: "evidencia.subir", conArchivo: true, datos: { id: ID, orden_id: ID, tipo: "ingreso", extension: "webp", notas: null } },
      new Blob(["x"], { type: "image/webp" })
    );
    const blobId = (await listarCola())[0].blobId!;
    await eliminarItem(seq);
    expect(await listarCola()).toHaveLength(0);
    expect(await leerBlob(blobId)).toBeNull();
  });

  it("actualiza estado y error sin perder la operación", async () => {
    const seq = await encolarOperacion(gasto(500));
    await actualizarItem(seq, { estado: "fallida", error: "boom", intentos: 2 });
    const [it] = await listarCola();
    expect(it).toMatchObject({ seq, estado: "fallida", error: "boom", intentos: 2 });
    expect(it.operacion.tipo).toBe("gasto.crear");
  });

  it("la caché de referencia se puede limpiar (logout) SIN tocar la cola de pendientes", async () => {
    await guardarCache("snapshot", { hola: 1 });
    await encolarOperacion(gasto(700));
    expect((await leerCache<{ hola: number }>("snapshot"))?.valor.hola).toBe(1);
    await limpiarCacheReferencia();
    expect(await leerCache("snapshot")).toBeNull();
    expect(await listarCola()).toHaveLength(1);
  });
});
