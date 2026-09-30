import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  agregarRepuesto,
  buscarInventario,
  eliminarRepuesto,
  recalcularTotal,
} from "@/app/(app)/ordenes/repuestos-actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORDEN = "123e4567-e89b-12d3-a456-426614174000";
const ITEM = "223e4567-e89b-12d3-a456-426614174000";
const LINEA = "323e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(responder?: (l: Llamada) => Respuesta | undefined, opciones: { usuario?: null } = {}) {
  const f = crearSupabaseFalso({ responder, ...opciones });
  sesionFalsa.cliente = f.cliente;
  return f;
}

describe("agregarRepuesto", () => {
  const inventario = (tipo: string) => (l: Llamada) => (l.tabla === "inventario" ? { data: [{ tipo_unidad: tipo, nombre: "Refrigerante R134a" }] } : undefined);

  it("valida ids y cantidad", async () => {
    const f = usar();
    expect(await agregarRepuesto({ ordenId: "x", inventarioId: ITEM, cantidad: 1 })).toEqual({ ok: false, error: "Datos inválidos." });
    for (const cantidad of [0, -1, Number.NaN, Infinity]) {
      expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad })).toEqual({ ok: false, error: "Ingresa una cantidad mayor a 0." });
    }
    expect(f.llamadas).toHaveLength(0);
  });

  it("el ítem debe existir; las unidades se manejan enteras y el granel admite decimales", async () => {
    usar(() => ({ data: [] }));
    expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad: 1 })).toEqual({ ok: false, error: "El ítem de inventario no existe." });

    usar(inventario("unidad"));
    expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad: 1.5 })).toMatchObject({
      ok: false,
      error: expect.stringContaining("unidades enteras"),
    });

    const f = usar(inventario("gramo"));
    expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad: 450.12349 })).toEqual({ ok: true });
    // El stock y el snapshot de costo/precio los resuelve el trigger de la base: aquí solo se inserta la línea.
    expect(f.de("insert", "orden_repuestos")[0].payload).toEqual({ orden_id: ORDEN, inventario_id: ITEM, cantidad_usada: 450.123 });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([`/ordenes/${ORDEN}`, "/ordenes", "/inventario"]);
  });

  it("muestra el rechazo del trigger (stock insuficiente) con su pista y no refresca", async () => {
    usar((l) =>
      l.tabla === "inventario"
        ? { data: [{ tipo_unidad: "unidad", nombre: "Compresor" }] }
        : { error: { code: "P0001", message: "Stock insuficiente de Compresor", hint: "Disponible: 0" } }
    );
    expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad: 1 })).toEqual({
      ok: false,
      error: "Stock insuficiente de Compresor. Disponible: 0",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin sesión no agrega", async () => {
    const f = usar(undefined, { usuario: null });
    expect(await agregarRepuesto({ ordenId: ORDEN, inventarioId: ITEM, cantidad: 1 })).toMatchObject({ ok: false });
    expect(f.llamadas).toHaveLength(0);
  });
});

describe("eliminarRepuesto", () => {
  it("borra la línea de ESA orden (el trigger devuelve el stock)", async () => {
    const f = usar((l) => (l.op === "delete" ? { data: [{ id: LINEA }] } : undefined));
    expect(await eliminarRepuesto({ ordenId: ORDEN, lineaId: LINEA })).toEqual({ ok: true });
    const [borrado] = f.de("delete", "orden_repuestos");
    expect(borrado.filtros).toEqual([
      { col: "id", op: "eq", valor: LINEA },
      { col: "orden_id", op: "eq", valor: ORDEN },
    ]);
  });

  it("cero filas = sin permiso (RLS): avisa que solo el administrador elimina", async () => {
    usar((l) => (l.op === "delete" ? { data: [] } : undefined));
    expect(await eliminarRepuesto({ ordenId: ORDEN, lineaId: LINEA })).toMatchObject({ ok: false, error: expect.stringContaining("administrador") });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("recalcularTotal", () => {
  const datos = (mano: number | null) => (l: Llamada): Respuesta | undefined => {
    if (l.tabla === "ordenes_servicio" && l.op === "select") return { data: mano === null ? [] : [{ mano_obra: mano }] };
    if (l.tabla === "orden_repuestos") {
      return { data: [{ cantidad_usada: 2, precio_unitario: 15000.5 }, { cantidad_usada: 0.5, precio_unitario: 80000 }] };
    }
    if (l.op === "update") return { data: [{ id: ORDEN }] };
    return undefined;
  };

  it("total = mano de obra + repuestos a precio de venta, redondeado", async () => {
    const f = usar(datos(100000));
    expect(await recalcularTotal(ORDEN)).toEqual({ ok: true, mensaje: "Total actualizado." });
    expect(f.de("update", "ordenes_servicio")[0].payload).toEqual({ total_cobrado: 170001 }); // 100000 + 2·15000.5 + 0.5·80000
  });

  it("orden inexistente, id inválido y actualización sin filas", async () => {
    expect(await recalcularTotal("x")).toEqual({ ok: false, error: "Orden inválida." });
    usar(datos(null));
    expect(await recalcularTotal(ORDEN)).toEqual({ ok: false, error: "La orden no existe." });
    usar((l) => (l.op === "update" ? { data: [] } : datos(1)(l)));
    expect(await recalcularTotal(ORDEN)).toMatchObject({ ok: false, error: expect.stringContaining("permisos") });
  });
});

describe("buscarInventario", () => {
  it("limpia los caracteres especiales del filtro y no consulta con menos de 2 letras", async () => {
    const f = usar(() => ({ data: [] }));
    expect(await buscarInventario("a")).toEqual([]);
    expect(f.llamadas).toHaveLength(0);
    await buscarInventario("comp%,res()or*");
    const filtro = f.de("select", "inventario")[0].filtros.find((x) => x.op === "or")!.valor as string;
    // Los % , ( ) * que alterarían el filtro de PostgREST se sustituyen por espacios.
    expect(filtro).toBe("codigo.ilike.%comp  res  or%,nombre.ilike.%comp  res  or%");
  });

  it("sin sesión devuelve lista vacía", async () => {
    const f = usar(undefined, { usuario: null });
    expect(await buscarInventario("compresor")).toEqual([]);
    expect(f.llamadas).toHaveLength(0);
  });
});
