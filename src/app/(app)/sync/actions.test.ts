import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { procesarOperacion } from "@/app/(app)/sync/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ID = "123e4567-e89b-12d3-a456-426614174000";
const ORDEN = "223e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}
function formulario(op: unknown, archivo?: File) {
  const fd = new FormData();
  fd.set("op", typeof op === "string" ? op : JSON.stringify(op));
  if (archivo) fd.set("archivo", archivo);
  return fd;
}

const gasto = { tipo: "gasto.crear", datos: { id: ID, fecha: "2026-09-29", monto: 15000, categoria: "otros", descripcion: null, orden_id: null, autor: "Polo" } };
const pago = { tipo: "pago.crear", datos: { id: ID, orden_id: ORDEN, fecha: "2026-09-29", monto: 50000, medio: "efectivo", es_devolucion: false, referencia: null, notas: null, autor: "Polo" } };

describe("procesarOperacion (punto único de escritura offline)", () => {
  it("sin sesión: marca `sesion` (la cola se detiene y conserva todo) y no escribe", async () => {
    const f = usar(undefined, null);
    const r = await procesarOperacion(formulario(gasto));
    expect(r).toMatchObject({ ok: false, permanente: false, sesion: true });
    expect(f.de("insert")).toHaveLength(0);
  });

  it("operación ilegible o inválida: error PERMANENTE (no se reintenta en bucle)", async () => {
    const f = usar();
    expect(await procesarOperacion(formulario("{no es json"))).toEqual({ ok: false, error: "Operación ilegible.", permanente: true });
    expect(await procesarOperacion(formulario({ tipo: "borrar.todo", datos: {} }))).toMatchObject({ ok: false, permanente: true });
    expect(await procesarOperacion(formulario({ ...gasto, datos: { ...gasto.datos, monto: -5 } }))).toMatchObject({ ok: false, permanente: true });
    expect(f.llamadas).toHaveLength(0);
  });

  it("un gasto válido se inserta y refresca Caja", async () => {
    const f = usar();
    expect(await procesarOperacion(formulario(gasto))).toEqual({ ok: true });
    expect(f.de("insert", "gastos_caja_menor")).toHaveLength(1);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/caja-menor"]);
  });

  it("un pago refresca la orden, la cartera, la caja y el inicio", async () => {
    usar();
    await procesarOperacion(formulario(pago));
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([`/ordenes/${ORDEN}`, "/cartera", "/caja-menor", "/"]);
  });

  it("recibe el archivo adjunto del FormData y lo sube", async () => {
    const f = usar();
    const archivo = new File([new Uint8Array(20)], "recibo.webp", { type: "image/webp" });
    expect(await procesarOperacion(formulario({ ...gasto, conArchivo: true, extension: "webp" }, archivo))).toEqual({ ok: true });
    expect(f.subidas).toHaveLength(1);
  });

  it("un fallo permanente de la base no refresca; una excepción inesperada se reintenta", async () => {
    usar((l) => (l.op === "insert" ? { error: { code: "23514", message: "check" } } : undefined));
    expect(await procesarOperacion(formulario(gasto))).toMatchObject({ ok: false, permanente: true });
    expect(revalidatePath).not.toHaveBeenCalled();

    const f = usar();
    f.cliente.from = (() => {
      throw new Error("fetch failed");
    }) as never;
    expect(await procesarOperacion(formulario(gasto))).toEqual({ ok: false, error: "fetch failed", permanente: false });
  });

  it("reenviar lo mismo dos veces no duplica: la segunda respuesta es «duplicado» y cuenta como éxito", async () => {
    let vez = 0;
    usar((l) => (l.op === "insert" && vez++ > 0 ? { error: { code: "23505", message: "duplicate" } } : undefined));
    expect(await procesarOperacion(formulario(pago))).toEqual({ ok: true });
    expect(await procesarOperacion(formulario(pago))).toEqual({ ok: true, duplicado: true });
  });
});
