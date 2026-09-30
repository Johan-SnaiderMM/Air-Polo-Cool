import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { ajustarStock, crearItem, editarItem } from "@/app/(app)/inventario/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

const ITEM = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}
function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("crearItem", () => {
  const campos = { codigo: " CMP-01 ", nombre: "Compresor", tipo_unidad: "unidad", stock_actual: "3", stock_minimo: "1", costo_compra: "100000", precio_venta: "150000", descripcion: "" };

  it("sin sesión redirige al login", async () => {
    usar(undefined, null);
    await expect(crearItem({}, formulario(campos))).rejects.toThrow("REDIRECT:/login");
  });

  it("valida con el esquema y no toca la base si hay error", async () => {
    const f = usar();
    expect(await crearItem({}, formulario({ ...campos, codigo: "" }))).toEqual({ error: "Ingresa el código del ítem." });
    expect(await crearItem({}, formulario({ ...campos, stock_actual: "1.5" }))).toEqual({ error: "Las unidades físicas deben ser cantidades enteras." });
    expect(f.de("insert")).toHaveLength(0);
  });

  it("inserta el ítem limpio y refresca; un código repetido da un mensaje claro", async () => {
    let f = usar();
    expect(await crearItem({}, formulario(campos))).toEqual({ ok: "Ítem registrado." });
    expect(f.de("insert", "inventario")[0].payload).toEqual({
      codigo: "CMP-01", nombre: "Compresor", tipo_unidad: "unidad", stock_actual: 3, stock_minimo: 1, costo_compra: 100000, precio_venta: 150000, descripcion: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/inventario");

    f = usar((l) => (l.op === "insert" ? { error: { code: "23505", message: "duplicate key" } } : undefined));
    expect(await crearItem({}, formulario(campos))).toEqual({ error: 'Ya existe un ítem con el código "CMP-01".' });
  });
});

describe("editarItem", () => {
  const campos = { inventario_id: ITEM, codigo: "CMP-01", nombre: "Compresor", stock_minimo: "2", costo_compra: "100000", precio_venta: "150000", descripcion: "" };
  const datos = (tipo: string) => (l: Llamada): Respuesta | undefined =>
    l.op === "select" ? { data: [{ tipo_unidad: tipo }] } : l.op === "update" ? { data: [{ id: ITEM }] } : undefined;

  it("actualiza los datos maestros sin tocar el stock", async () => {
    const f = usar(datos("unidad"));
    expect(await editarItem({}, formulario(campos))).toEqual({ ok: "Ítem actualizado." });
    const payload = f.de("update", "inventario")[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain("stock_actual");
    expect(payload).toMatchObject({ codigo: "CMP-01", stock_minimo: 2 });
  });

  it("el stock mínimo de una unidad física debe ser entero (regla que depende de la base); ítem inexistente", async () => {
    usar(datos("unidad"));
    expect(await editarItem({}, formulario({ ...campos, stock_minimo: "1.5" }))).toEqual({ error: "Las unidades físicas deben ser cantidades enteras." });
    usar(datos("gramo"));
    expect((await editarItem({}, formulario({ ...campos, stock_minimo: "1.5" }))).ok).toBe("Ítem actualizado.");
    usar(() => ({ data: [] }));
    expect(await editarItem({}, formulario(campos))).toEqual({ error: "El ítem ya no existe." });
  });

  it("código duplicado y cero filas actualizadas", async () => {
    usar((l) => (l.op === "update" ? { error: { code: "23505", message: "dup" } } : datos("unidad")(l)));
    expect(await editarItem({}, formulario(campos))).toEqual({ error: 'Ya existe otro ítem con el código "CMP-01".' });
    usar((l) => (l.op === "update" ? { data: [] } : datos("unidad")(l)));
    expect(await editarItem({}, formulario(campos))).toEqual({ error: "No se pudo actualizar el ítem." });
  });
});

describe("ajustarStock (reposición con concurrencia optimista)", () => {
  const campos = { inventario_id: ITEM, cantidad: "5", costo_compra: "" };

  it("suma al stock LEÍDO y condiciona la escritura a ese mismo stock", async () => {
    const f = usar((l) => (l.op === "select" ? { data: [{ stock_actual: 10, tipo_unidad: "unidad" }] } : { data: [{ id: ITEM }] }));
    expect(await ajustarStock({}, formulario(campos))).toEqual({ ok: "Existencias actualizadas." });
    const [u] = f.de("update", "inventario");
    expect(u.payload).toEqual({ stock_actual: 15 });
    expect(u.filtros).toContainEqual({ col: "stock_actual", op: "eq", valor: 10 }); // si otro consumo cambió el stock, no pisa
  });

  it("si otro proceso cambió el stock, relee y reintenta con el valor nuevo", async () => {
    let lecturas = 0;
    let escrituras = 0;
    const f = usar((l) => {
      if (l.op === "select") return { data: [{ stock_actual: lecturas++ === 0 ? 10 : 7, tipo_unidad: "unidad" }] };
      return { data: escrituras++ === 0 ? [] : [{ id: ITEM }] }; // la primera no toca filas: el stock cambió
    });
    expect(await ajustarStock({}, formulario(campos))).toEqual({ ok: "Existencias actualizadas." });
    expect(f.de("update").map((u) => (u.payload as { stock_actual: number }).stock_actual)).toEqual([15, 12]);
  });

  it("tras 3 intentos fallidos avisa, y guarda el costo nuevo si se indica", async () => {
    let f = usar((l) => (l.op === "select" ? { data: [{ stock_actual: 1, tipo_unidad: "unidad" }] } : { data: [] }));
    expect(await ajustarStock({}, formulario(campos))).toEqual({ error: "El inventario cambió mientras se guardaba. Intenta de nuevo." });
    expect(f.de("update")).toHaveLength(3);

    f = usar((l) => (l.op === "select" ? { data: [{ stock_actual: 0, tipo_unidad: "gramo" }] } : { data: [{ id: ITEM }] }));
    await ajustarStock({}, formulario({ ...campos, cantidad: "450,5", costo_compra: "90" }));
    expect(f.de("update")[0].payload).toEqual({ stock_actual: 450.5, costo_compra: 90 });
  });

  it("valida la cantidad, y una unidad física no admite decimales", async () => {
    usar((l) => (l.op === "select" ? { data: [{ stock_actual: 1, tipo_unidad: "unidad" }] } : undefined));
    expect(await ajustarStock({}, formulario({ ...campos, cantidad: "0" }))).toEqual({ error: "Ingresa una cantidad mayor a 0." });
    expect(await ajustarStock({}, formulario({ ...campos, cantidad: "1.5" }))).toEqual({ error: "Este ítem se maneja por unidades enteras." });
  });
});
