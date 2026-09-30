import { describe, expect, it } from "vitest";
import { VALORES_NUEVA, armarOrdenNueva, type OrdenFormValores } from "@/lib/orden-nueva";
import type { SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";

let n = 0;
const id = () => `id-${++n}`;

const existente: SeleccionVehiculo = {
  modo: "existente",
  vehiculo: { id: "veh-1", placa: "ABC123", marca: "Chevrolet", modelo: "Spark", anio: 2018, cliente: "Ana" },
};
const nuevo = (extra: Partial<Extract<SeleccionVehiculo, { modo: "nuevo" }>["datos"]> = {}): SeleccionVehiculo => ({
  modo: "nuevo",
  datos: {
    cliente_nombre: "  Luis Peña ",
    cliente_telefono: "300 123 4567",
    placa: "xyz-987",
    marca: " Renault ",
    modelo: "Logan",
    anio: "2020",
    ...extra,
  },
});
const armar = (valores: Partial<OrdenFormValores>, vehiculo: SeleccionVehiculo | null = existente) =>
  armarOrdenNueva({ valores: { ...VALORES_NUEVA, ...valores }, vehiculo, autor: "Polo", generarId: id });

describe("armarOrdenNueva", () => {
  it("sin vehículo no hay orden", () => {
    expect(armar({}, null)).toEqual({ ok: false, error: "Selecciona un vehículo o registra uno nuevo." });
  });

  it("vehículo existente: solo referencia su id; los textos vacíos pasan a null y los números a 0", () => {
    const r = armar({ kilometraje: "85000", diagnostico_inicial: "  fuga  ", dias_garantia: 90 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toMatchObject({
      vehiculo: { nuevo: false, id: "veh-1" },
      kilometraje: 85000,
      diagnostico_inicial: "fuga",
      trabajos_a_realizar: null,
      mano_obra: 0,
      total_cobrado: 0,
      dias_garantia: 90,
      estado: "recibido",
      autor: "Polo",
    });
  });

  it("vehículo nuevo: normaliza teléfono y placa, recorta textos y genera los ids en el teléfono", () => {
    const r = armar({}, nuevo());
    expect(r.ok).toBe(true);
    if (!r.ok || !r.valor.vehiculo.nuevo) return;
    expect(r.valor.vehiculo).toMatchObject({
      cliente_nombre: "Luis Peña",
      placa: "XYZ987",
      marca: "Renault",
      modelo: "Logan",
      anio: 2020,
    });
    expect(r.valor.vehiculo.cliente_telefono).toMatch(/^\+57/);
    // Ids distintos para vehículo, cliente y orden (idempotencia al reenviar).
    const ids = new Set([r.valor.vehiculo.id, r.valor.vehiculo.cliente_id, r.valor.id]);
    expect(ids.size).toBe(3);
  });

  it("vehículo nuevo: cada dato obligatorio tiene su mensaje", () => {
    expect(armar({}, nuevo({ cliente_nombre: " " }))).toMatchObject({ ok: false, error: "Ingresa el nombre del cliente." });
    expect(armar({}, nuevo({ cliente_telefono: "123" }))).toMatchObject({ ok: false, error: expect.stringContaining("WhatsApp") });
    expect(armar({}, nuevo({ placa: "AB" }))).toMatchObject({ ok: false, error: expect.stringContaining("placa") });
    expect(armar({}, nuevo({ marca: "" }))).toMatchObject({ ok: false, error: "Ingresa la marca y la línea." });
    expect(armar({}, nuevo({ modelo: " " }))).toMatchObject({ ok: false, error: "Ingresa la marca y la línea." });
    for (const anio of ["1900", "2101", "20.5", "abc"]) {
      expect(armar({}, nuevo({ anio }))).toMatchObject({ ok: false, error: expect.stringContaining("modelo (año)") });
    }
    expect(armar({}, nuevo({ anio: "" })).ok).toBe(true); // el año es opcional
  });

  it("rechaza kilometraje y cobros inválidos", () => {
    const km = { ok: false, error: expect.stringContaining("kilometraje") };
    expect(armar({ kilometraje: "-1" })).toMatchObject(km);
    expect(armar({ kilometraje: "12.5" })).toMatchObject(km);
    expect(armar({ kilometraje: "abc" })).toMatchObject(km);
    // Cada campo de cobro tiene su propio mensaje (los mismos que al editar una orden).
    expect(armar({ mano_obra: "-5" })).toEqual({ ok: false, error: "La mano de obra debe ser un valor mayor o igual a 0." });
    expect(armar({ total_cobrado: "x" })).toEqual({ ok: false, error: "El total cobrado debe ser un valor mayor o igual a 0." });
    expect(armar({ dias_garantia: 45 })).toEqual({ ok: false, error: "Selecciona un plazo de garantía válido." });
    expect(armar({ kilometraje: "0", mano_obra: "0", total_cobrado: "150000" }).ok).toBe(true);
  });

  it("el mantenimiento solo se conserva si la orden nace Lista o Entregada", () => {
    expect(armar({ estado: "recibido", mantenimiento_meses: 6 })).toMatchObject({ ok: true, valor: { mantenimiento_meses: null } });
    expect(armar({ estado: "listo", mantenimiento_meses: 6 })).toMatchObject({ ok: true, valor: { mantenimiento_meses: 6 } });
    expect(armar({ estado: "entregado", mantenimiento_meses: 12 })).toMatchObject({ ok: true, valor: { mantenimiento_meses: 12 } });
  });
});
