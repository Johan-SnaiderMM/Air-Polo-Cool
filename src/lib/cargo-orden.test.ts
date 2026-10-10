import { describe, expect, it } from "vitest";
import { CARGOS_SUGERIDOS, validarCargo } from "@/lib/cargo-orden";

describe("validarCargo", () => {
  it("sin tocar el precio se cobra lo que se gastó (sin ganancia ni pérdida)", () => {
    expect(validarCargo({ nombre: "Gasolina", costo: 50000, precio: null })).toEqual({
      ok: true,
      valor: { nombre: "Gasolina", costo: 50000, precio: 50000 },
    });
  });

  it("acepta cobrar más (ganancia) y un cargo sin gasto propio (costo 0)", () => {
    expect(validarCargo({ nombre: "  Servicio   de grúa ", costo: 0, precio: 80000 })).toEqual({
      ok: true,
      valor: { nombre: "Servicio de grúa", costo: 0, precio: 80000 },
    });
    expect(validarCargo({ nombre: "Flete", costo: 20000, precio: 35000 })).toMatchObject({ ok: true, valor: { costo: 20000, precio: 35000 } });
  });

  it("necesita concepto y algo que cobrar", () => {
    expect(validarCargo({ nombre: "a", costo: 100, precio: null })).toMatchObject({ ok: false, error: expect.stringContaining("de qué es") });
    expect(validarCargo({ nombre: "Gasolina", costo: 0, precio: null })).toMatchObject({ ok: false, error: expect.stringContaining("cuánto se le cobra") });
    expect(validarCargo({ nombre: "Gasolina", costo: 5000, precio: 0 })).toMatchObject({ ok: false, error: expect.stringContaining("cuánto se le cobra") });
    expect(validarCargo({ nombre: "Gasolina", costo: 5000, precio: -1 })).toMatchObject({ ok: false });
  });

  it("trae los atajos habituales", () => {
    expect(CARGOS_SUGERIDOS).toEqual(expect.arrayContaining(["Gasolina", "Parqueadero", "Flete"]));
  });
});
