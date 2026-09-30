import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { anularPago } from "@/app/(app)/ordenes/pagos-actions";
import { crearSupabaseFalso, sesionFalsa } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PAGO = "123e4567-e89b-12d3-a456-426614174000";
const ORDEN = "223e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("anularPago", () => {
  it("rechaza ids inválidos y motivos cortos sin tocar la base", async () => {
    const f = crearSupabaseFalso();
    sesionFalsa.cliente = f.cliente;
    expect(await anularPago({ pagoId: "x", ordenId: ORDEN, motivo: "error de digitación" })).toEqual({ ok: false, error: "Datos inválidos." });
    expect(await anularPago({ pagoId: PAGO, ordenId: ORDEN, motivo: " a " })).toEqual({ ok: false, error: "Escribe el motivo de la anulación." });
    expect(f.llamadas).toHaveLength(0);
  });

  it("sin sesión devuelve «sesión expirada» y no anula nada", async () => {
    const f = crearSupabaseFalso({ usuario: null });
    sesionFalsa.cliente = f.cliente;
    const r = await anularPago({ pagoId: PAGO, ordenId: ORDEN, motivo: "duplicado" });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });
    expect(f.de("rpc")).toHaveLength(0);
  });

  it("anula por la RPC (nunca borra), con el motivo recortado a 300 caracteres, y refresca las pantallas", async () => {
    const f = crearSupabaseFalso();
    sesionFalsa.cliente = f.cliente;
    const r = await anularPago({ pagoId: PAGO, ordenId: ORDEN, motivo: `  ${"x".repeat(400)}  ` });
    expect(r).toEqual({ ok: true, mensaje: "Pago anulado." });
    const [llamada] = f.de("rpc", "anular_pago");
    expect(llamada.payload).toEqual({ p_pago_id: PAGO, p_motivo: "x".repeat(300) });
    expect(f.de("delete")).toHaveLength(0);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([`/ordenes/${ORDEN}`, "/cartera", "/caja-menor", "/"]);
  });

  it("si la base rechaza, traduce el error y no refresca", async () => {
    const f = crearSupabaseFalso({ responder: () => ({ error: { code: "42501", message: "permission denied" } }) });
    sesionFalsa.cliente = f.cliente;
    const r = await anularPago({ pagoId: PAGO, ordenId: ORDEN, motivo: "duplicado" });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("permisos") });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
