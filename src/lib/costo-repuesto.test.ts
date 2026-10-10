import { describe, expect, it } from "vitest";
import { pideCostoRepuesto, validarCostoRepuesto } from "@/lib/costo-repuesto";

describe("pideCostoRepuesto", () => {
  it("solo en la foto del repuesto instalado", () => {
    for (const tipo of ["ingreso", "repuesto_viejo", "prueba_tecnica", "factura_compra"] as const) {
      expect(pideCostoRepuesto(tipo, undefined), tipo).toBe(false);
    }
    expect(pideCostoRepuesto("repuesto_nuevo", undefined)).toBe(true);
  });

  it("si el repuesto ya tiene costo cargado en la orden no se vuelve a pedir (no se cuenta dos veces)", () => {
    expect(pideCostoRepuesto("repuesto_nuevo", { costo: 150000 })).toBe(false);
    expect(pideCostoRepuesto("repuesto_nuevo", { costo: 0 })).toBe(true);
  });
});

describe("validarCostoRepuesto", () => {
  it("acepta un repuesto de la orden con su costo", () => {
    expect(validarCostoRepuesto({ yaEnOrden: true, nombre: "", monto: 180000, sinCosto: false })).toEqual({
      ok: true,
      valor: { nombre: "", monto: 180000 },
    });
  });

  it("un repuesto fuera de la orden necesita nombre", () => {
    const r = validarCostoRepuesto({ yaEnOrden: false, nombre: " a ", monto: 5000, sinCosto: false });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("qué repuesto es") });
    expect(validarCostoRepuesto({ yaEnOrden: false, nombre: "  Válvula   de expansión ", monto: 5000.4, sinCosto: false })).toEqual({
      ok: true,
      valor: { nombre: "Válvula de expansión", monto: 5000 },
    });
  });

  it("el costo es obligatorio salvo «sin costo», y entonces no genera egreso (monto 0)", () => {
    for (const monto of [0, -5, NaN]) {
      expect(validarCostoRepuesto({ yaEnOrden: true, nombre: "", monto, sinCosto: false }), String(monto)).toMatchObject({
        ok: false,
        error: expect.stringContaining("cuánto costó"),
      });
    }
    expect(validarCostoRepuesto({ yaEnOrden: true, nombre: "", monto: 99999, sinCosto: true })).toEqual({
      ok: true,
      valor: { nombre: "", monto: 0 },
    });
  });
});
