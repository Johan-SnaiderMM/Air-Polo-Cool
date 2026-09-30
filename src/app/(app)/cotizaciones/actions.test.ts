import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { cambiarEstadoCotizacion, convertirCotizacion, guardarCotizacion } from "@/app/(app)/cotizaciones/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

const COT = "123e4567-e89b-12d3-a456-426614174000";
const VEH = "223e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}
const item = { descripcion: "Compresor", cantidad: 1, precio_unitario: 400000, costo_unitario: 300000 };
function formulario(extra: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    items: JSON.stringify([item]),
    mano_obra: "150000",
    vigencia_dias: "15",
    notas: "",
    autor: "Polo",
    vehiculo: JSON.stringify({ modo: "existente", vehiculo: { id: VEH } }),
  };
  for (const [k, v] of Object.entries({ ...base, ...extra })) fd.set(k, v);
  return fd;
}

describe("guardarCotizacion: validación", () => {
  it("sin sesión redirige al login", async () => {
    usar(undefined, null);
    await expect(guardarCotizacion({}, formulario())).rejects.toThrow("REDIRECT:/login");
  });

  it("rechaza con el mensaje de cada regla y sin tocar la base", async () => {
    const casos: [Record<string, string>, string][] = [
      [{ cotizacion_id: "x" }, "Cotización inválida."],
      [{ items: "{no es json" }, "Los ítems no tienen un formato válido."],
      [{ items: JSON.stringify([{ ...item, precio_unitario: -1 }]) }, 'Precio inválido en "Compresor".'],
      [{ mano_obra: "-5" }, "La mano de obra debe ser un valor mayor o igual a 0."],
      [{ items: "[]", mano_obra: "0" }, "Agrega al menos un ítem o la mano de obra."],
      [{ vigencia_dias: "45" }, "Vigencia inválida."],
      [{ vehiculo: "" }, "Selecciona un vehículo o registra uno nuevo."],
      [{ vehiculo: JSON.stringify({ modo: "existente", vehiculo: { id: "x" } }) }, "Selecciona un vehículo o registra uno nuevo."],
      [{ vehiculo: JSON.stringify({ modo: "nuevo", datos: { cliente_nombre: "", cliente_telefono: "3001234567", placa: "ABC123", marca: "K", modelo: "R", anio: "" } }) }, "Ingresa el nombre del cliente."],
    ];
    for (const [extra, error] of casos) {
      const f = usar();
      expect(await guardarCotizacion({}, formulario(extra)), JSON.stringify(extra)).toEqual({ error });
      expect(f.de("insert"), JSON.stringify(extra)).toHaveLength(0);
    }
  });
});

describe("guardarCotizacion: crear", () => {
  const responderCrear = (extra?: (l: Llamada) => Respuesta | undefined) => (l: Llamada): Respuesta | undefined => {
    const propio = extra?.(l);
    if (propio) return propio;
    if (l.tabla === "vehiculos") return { data: [{ id: VEH }] };
    if (l.tabla === "cotizaciones" && l.op === "insert") return { data: [{ id: COT }] };
    return undefined;
  };

  it("con un vehículo existente: inserta la cotización y sus ítems (normalizados) y redirige a ella", async () => {
    const f = usar(responderCrear());
    await expect(guardarCotizacion({}, formulario({ notas: "  valida hasta el lunes " }))).rejects.toThrow(`REDIRECT:/cotizaciones/${COT}`);
    expect(f.de("insert", "cotizaciones")[0].payload).toEqual({
      vehiculo_id: VEH, mano_obra: 150000, vigencia_dias: 15, notas: "valida hasta el lunes", autor: "Polo",
    });
    expect(f.de("insert", "cotizacion_items")[0].payload).toEqual([{ ...item, inventario_id: null, cotizacion_id: COT }]);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/cotizaciones", `/cotizaciones/${COT}`]);
  });

  it("con un vehículo nuevo: lo da de alta (cliente + vehículo) antes de cotizar", async () => {
    const nuevo = { modo: "nuevo", datos: { cliente_nombre: "Luis", cliente_telefono: "3001234567", placa: "xyz-987", marca: "Renault", modelo: "Logan", anio: "2020" } };
    const f = usar((l) => {
      if (l.op === "select" && (l.tabla === "vehiculos" || l.tabla === "clientes")) return { data: [] };
      if (l.tabla === "cotizaciones" && l.op === "insert") return { data: [{ id: COT }] };
      return undefined;
    });
    await expect(guardarCotizacion({}, formulario({ vehiculo: JSON.stringify(nuevo) }))).rejects.toThrow(`REDIRECT:/cotizaciones/${COT}`);
    expect(f.de("insert").map((l) => l.tabla)).toEqual(["clientes", "vehiculos", "cotizaciones", "cotizacion_items"]);
    expect(f.de("insert", "vehiculos")[0].payload).toMatchObject({ placa: "XYZ987", marca: "Renault", modelo: "Logan", anio: 2020 });
    expect(f.de("insert", "clientes")[0].payload).toMatchObject({ nombre: "Luis", telefono: "+573001234567" });
  });

  it("si la placa del vehículo nuevo ya existe, avisa y no crea la cotización", async () => {
    const nuevo = { modo: "nuevo", datos: { cliente_nombre: "Luis", cliente_telefono: "3001234567", placa: "ABC123", marca: "K", modelo: "R", anio: "" } };
    const f = usar((l) => (l.tabla === "vehiculos" && l.filtros.some((x) => x.col === "placa") ? { data: [{ id: "otro" }] } : { data: [] }));
    const r = await guardarCotizacion({}, formulario({ vehiculo: JSON.stringify(nuevo) }));
    expect(r.error).toContain("ABC123 ya está registrada");
    expect(f.de("insert", "cotizaciones")).toHaveLength(0);
  });

  it("si falla el insert de los ítems, se deshace la cotización recién creada", async () => {
    const f = usar(responderCrear((l) => (l.tabla === "cotizacion_items" && l.op === "insert" ? { error: { code: "23514", message: "check" } } : undefined)));
    const r = await guardarCotizacion({}, formulario());
    expect(r.error).toBeTruthy();
    expect(f.de("delete", "cotizaciones")[0].filtros).toContainEqual({ col: "id", op: "eq", valor: COT });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("solo con mano de obra (sin ítems) también crea la cotización, sin insertar ítems", async () => {
    const f = usar(responderCrear());
    await expect(guardarCotizacion({}, formulario({ items: "[]" }))).rejects.toThrow("REDIRECT:");
    expect(f.de("insert", "cotizacion_items")).toHaveLength(0);
  });
});

describe("guardarCotizacion: editar", () => {
  const anteriores = [{ id: "i0", cotizacion_id: COT, descripcion: "Viejo", cantidad: 1, precio_unitario: 1, costo_unitario: 0, inventario_id: null }];
  const editar = (estado: string, extra?: (l: Llamada) => Respuesta | undefined) => (l: Llamada): Respuesta | undefined => {
    const propio = extra?.(l);
    if (propio) return propio;
    if (l.tabla === "cotizaciones" && l.op === "select") return { data: [{ estado }] };
    if (l.tabla === "cotizacion_items" && l.op === "select") return { data: anteriores };
    return undefined;
  };

  it("no edita una cotización inexistente ni una ya convertida en orden", async () => {
    usar(() => ({ data: [] }));
    expect(await guardarCotizacion({}, formulario({ cotizacion_id: COT }))).toEqual({ error: "La cotización no existe." });
    const f = usar(editar("convertida"));
    expect((await guardarCotizacion({}, formulario({ cotizacion_id: COT }))).error).toContain("ya fue convertida");
    expect(f.de("update")).toHaveLength(0);
  });

  it("actualiza los datos y REEMPLAZA los ítems (sin tocar el vehículo)", async () => {
    const f = usar(editar("borrador"));
    await expect(guardarCotizacion({}, formulario({ cotizacion_id: COT }))).rejects.toThrow(`REDIRECT:/cotizaciones/${COT}`);
    expect(f.de("update", "cotizaciones")[0].payload).toEqual({ mano_obra: 150000, vigencia_dias: 15, notas: null });
    expect(f.de("delete", "cotizacion_items")).toHaveLength(1);
    expect(f.de("insert", "cotizacion_items")[0].payload).toEqual([{ ...item, inventario_id: null, cotizacion_id: COT }]);
    expect(f.de("insert", "vehiculos")).toHaveLength(0);
  });

  it("si falla el insert de los ítems nuevos, RESTAURA los anteriores", async () => {
    let inserciones = 0;
    const f = usar(editar("borrador", (l) => (l.tabla === "cotizacion_items" && l.op === "insert" && inserciones++ === 0 ? { error: { code: "23514", message: "check" } } : undefined)));
    const r = await guardarCotizacion({}, formulario({ cotizacion_id: COT }));
    expect(r.error).toBeTruthy();
    const inserts = f.de("insert", "cotizacion_items");
    expect(inserts).toHaveLength(2);
    expect(inserts[1].payload).toEqual(anteriores); // los que había antes vuelven a su lugar
    expect(f.de("delete", "cotizaciones")).toHaveLength(0); // al editar NO se borra la cotización
  });
});

describe("cambiarEstadoCotizacion y convertirCotizacion", () => {
  const estadoActual = (estado: string) => (l: Llamada): Respuesta | undefined => (l.op === "select" ? { data: [{ estado }] } : undefined);

  it("cambia entre los estados manuales y rechaza los que no lo son", async () => {
    const f = usar(estadoActual("borrador"));
    expect(await cambiarEstadoCotizacion({ id: COT, estado: "enviada" })).toEqual({ ok: true });
    expect(f.de("update", "cotizaciones")[0].payload).toEqual({ estado: "enviada" });
    expect(await cambiarEstadoCotizacion({ id: COT, estado: "convertida" })).toEqual({ ok: false, error: "Datos inválidos." });
    expect(await cambiarEstadoCotizacion({ id: "x", estado: "aprobada" })).toEqual({ ok: false, error: "Datos inválidos." });
  });

  it("no cambia el estado de una cotización convertida o inexistente, ni sin sesión", async () => {
    usar(estadoActual("convertida"));
    expect(await cambiarEstadoCotizacion({ id: COT, estado: "rechazada" })).toEqual({ ok: false, error: "La cotización ya fue convertida en orden." });
    usar(() => ({ data: [] }));
    expect(await cambiarEstadoCotizacion({ id: COT, estado: "rechazada" })).toEqual({ ok: false, error: "La cotización no existe." });
    usar(undefined, null);
    expect(await cambiarEstadoCotizacion({ id: COT, estado: "rechazada" })).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });
  });

  it("convertir: llama a la función atómica de la base (no inserta a mano) y refresca órdenes e inicio", async () => {
    const ORDEN = "323e4567-e89b-12d3-a456-426614174000";
    const f = usar((l) => (l.op === "rpc" ? { data: ORDEN } : undefined));
    expect(await convertirCotizacion({ id: COT, autor: "Hacker" })).toEqual({ ok: true, ordenId: ORDEN });
    expect(f.de("rpc", "convertir_cotizacion")[0].payload).toEqual({ p_id: COT, p_autor: null });
    expect(f.de("insert")).toHaveLength(0);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/cotizaciones", `/cotizaciones/${COT}`, "/ordenes", "/"]);
  });

  it("convertir: error de la base, id inválido y sin sesión", async () => {
    usar((l) => (l.op === "rpc" ? { error: { code: "P0001", message: "La cotización ya fue convertida" } } : undefined));
    expect(await convertirCotizacion({ id: COT, autor: "Polo" })).toEqual({ ok: false, error: "La cotización ya fue convertida" });
    expect(await convertirCotizacion({ id: "x", autor: "Polo" })).toEqual({ ok: false, error: "Cotización inválida." });
    usar(undefined, null);
    expect(await convertirCotizacion({ id: COT, autor: "Polo" })).toMatchObject({ ok: false });
  });
});
