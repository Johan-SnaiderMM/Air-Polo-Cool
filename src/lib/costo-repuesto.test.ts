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
  const base = { yaEnOrden: false, nombre: "Compresor", costo: 480000, precio: null, sinCosto: false };

  it("sin tocar el precio, se le cobra al cliente el costo (el repuesto no se «regala»)", () => {
    expect(validarCostoRepuesto(base)).toEqual({ ok: true, valor: { nombre: "Compresor", costo: 480000, precio: 480000 } });
  });

  it("acepta un precio propio (con ganancia) y también 0 (ya incluido en el total acordado)", () => {
    expect(validarCostoRepuesto({ ...base, precio: 600000 })).toMatchObject({ ok: true, valor: { costo: 480000, precio: 600000 } });
    expect(validarCostoRepuesto({ ...base, precio: 0 })).toMatchObject({ ok: true, valor: { precio: 0 } });
    expect(validarCostoRepuesto({ ...base, precio: -1 })).toMatchObject({ ok: false, error: expect.stringContaining("negativo") });
  });

  it("un repuesto fuera de la orden necesita nombre; uno de la orden no", () => {
    expect(validarCostoRepuesto({ ...base, nombre: " a " })).toMatchObject({ ok: false, error: expect.stringContaining("qué repuesto es") });
    expect(validarCostoRepuesto({ ...base, nombre: "  Válvula   de expansión " })).toMatchObject({
      ok: true,
      valor: { nombre: "Válvula de expansión" },
    });
    expect(validarCostoRepuesto({ ...base, yaEnOrden: true, nombre: "" })).toMatchObject({ ok: true });
  });

  it("el costo es obligatorio salvo «sin costo», y entonces no hay línea (todo en 0)", () => {
    for (const costo of [0, -5, NaN]) {
      expect(validarCostoRepuesto({ ...base, costo }), String(costo)).toMatchObject({ ok: false, error: expect.stringContaining("cuánto costó") });
    }
    expect(validarCostoRepuesto({ ...base, costo: 99999, precio: 5, sinCosto: true })).toEqual({
      ok: true,
      valor: { nombre: "Compresor", costo: 0, precio: 0 },
    });
  });
});
