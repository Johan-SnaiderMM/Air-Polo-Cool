import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { anularGasto, editarGasto } from "@/app/(app)/caja-menor/actions";
import { hoyBogota } from "@/lib/caja";
import { crearSupabaseFalso, sesionFalsa } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const GASTO = "123e4567-e89b-12d3-a456-426614174000";
const ORDEN = "223e4567-e89b-12d3-a456-426614174000";

const valido = {
  id: GASTO,
  fecha: "2026-01-15",
  categoria: "flete_acarreo",
  monto: 25000,
  descripcion: "  Flete del compresor  ",
  ordenId: ORDEN as string | null,
  autor: "Polo",
};

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("editarGasto", () => {
  async function editar(cambios: Partial<typeof valido>) {
    const f = crearSupabaseFalso();
    sesionFalsa.cliente = f.cliente;
    return { r: await editarGasto({ ...valido, ...cambios }), f };
  }

  it("valida cada campo antes de llamar a la base", async () => {
    const casos: [Partial<typeof valido>, string][] = [
      [{ id: "x" }, "Gasto inválido."],
      [{ fecha: "15/01/2026" }, "La fecha no puede ser futura."],
      [{ fecha: "2999-01-01" }, "La fecha no puede ser futura."],
      [{ categoria: "lujos" }, "Categoría inválida."],
      [{ monto: 0 }, "Ingresa un monto mayor a 0."],
      [{ monto: -5 }, "Ingresa un monto mayor a 0."],
      [{ monto: Number.NaN }, "Ingresa un monto mayor a 0."],
      [{ monto: 10_000_000_000 }, "Ingresa un monto mayor a 0."],
      [{ ordenId: "no-uuid" }, "Orden inválida."],
    ];
    for (const [cambio, error] of casos) {
      const { r, f } = await editar(cambio);
      expect(r, JSON.stringify(cambio)).toEqual({ ok: false, error });
      expect(f.de("rpc"), JSON.stringify(cambio)).toHaveLength(0);
    }
  });

  it("edita por la RPC (queda historial en la base): monto redondeado, descripción limpia y autor válido", async () => {
    const { r, f } = await editar({ monto: 25000.456, autor: "x".repeat(60) });
    expect(r).toEqual({ ok: true, mensaje: "Gasto actualizado." });
    expect(f.de("rpc", "editar_gasto")[0].payload).toEqual({
      p_id: GASTO,
      p_fecha: "2026-01-15",
      p_categoria: "flete_acarreo",
      p_monto: 25000.46,
      p_descripcion: "Flete del compresor",
      p_orden_id: ORDEN,
      p_autor: null, // solo «Polo» o «Soporte técnico»
    });
    expect(f.de("update")).toHaveLength(0); // nunca se edita la tabla directamente
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/caja-menor", "/"]);
  });

  it("la fecha de hoy y una descripción vacía son válidas (descripción → null, sin orden)", async () => {
    const { r, f } = await editar({ fecha: hoyBogota(), descripcion: "   ", ordenId: null });
    expect(r.ok).toBe(true);
    expect(f.de("rpc", "editar_gasto")[0].payload).toMatchObject({ p_descripcion: null, p_orden_id: null });
  });

  it("sin sesión no edita; con error de la base lo traduce", async () => {
    const sin = crearSupabaseFalso({ usuario: null });
    sesionFalsa.cliente = sin.cliente;
    expect(await editarGasto(valido)).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });
    expect(sin.de("rpc")).toHaveLength(0);

    const malo = crearSupabaseFalso({ responder: () => ({ error: { message: "El gasto ya está anulado" , code: "P0001" } }) });
    sesionFalsa.cliente = malo.cliente;
    expect(await editarGasto(valido)).toEqual({ ok: false, error: "El gasto ya está anulado" });
  });
});

describe("anularGasto", () => {
  it("exige un motivo de al menos 3 caracteres", async () => {
    const f = crearSupabaseFalso();
    sesionFalsa.cliente = f.cliente;
    expect(await anularGasto({ id: GASTO, motivo: " ab ", autor: "Polo" })).toEqual({ ok: false, error: "Escribe el motivo de la anulación." });
    expect(await anularGasto({ id: "x", motivo: "duplicado", autor: "Polo" })).toEqual({ ok: false, error: "Gasto inválido." });
    expect(f.llamadas).toHaveLength(0);
  });

  it("anula por la RPC con motivo y autor; no borra", async () => {
    const f = crearSupabaseFalso();
    sesionFalsa.cliente = f.cliente;
    const r = await anularGasto({ id: GASTO, motivo: "  Mal digitado  ", autor: "Soporte técnico" });
    expect(r).toEqual({ ok: true, mensaje: "Gasto anulado." });
    expect(f.de("rpc", "anular_gasto")[0].payload).toEqual({ p_id: GASTO, p_motivo: "Mal digitado", p_autor: "Soporte técnico" });
    expect(f.de("delete")).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/caja-menor");
  });
});
