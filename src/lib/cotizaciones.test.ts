import { describe, expect, it } from "vitest";
import { estaVencida, totalesCotizacion, validarItems, vigenteHasta } from "@/lib/cotizaciones";
import { mensajeCotizacion } from "@/lib/whatsapp";

describe("totalesCotizacion", () => {
  it("suma mano de obra + repuestos y estima el margen", () => {
    const t = totalesCotizacion(150000, [
      { inventario_id: null, descripcion: "Compresor", cantidad: 1, precio_unitario: 400000, costo_unitario: 300000 },
      { inventario_id: null, descripcion: "R134a (lb)", cantidad: 1.5, precio_unitario: 30000, costo_unitario: 20000 },
    ]);
    expect(t.repuestos).toBe(445000);
    expect(t.total).toBe(595000);
    expect(t.costoEstimado).toBe(330000);
    expect(t.margenEstimado).toBe(265000);
  });
  it("sin ítems: solo mano de obra", () => {
    expect(totalesCotizacion(80000, []).total).toBe(80000);
  });
});

describe("vigencia", () => {
  it("calcula la fecha de vencimiento cruzando meses", () => {
    expect(vigenteHasta("2026-01-25", 15)).toBe("2026-02-09");
    expect(vigenteHasta("2026-12-20", 15)).toBe("2027-01-04");
  });
  it("vencida solo después del último día de vigencia", () => {
    expect(estaVencida("2026-01-01", 15, "2026-01-16")).toBe(false);
    expect(estaVencida("2026-01-01", 15, "2026-01-17")).toBe(true);
  });
});

describe("validarItems", () => {
  it("acepta ítems correctos y normaliza decimales", () => {
    const r = validarItems([{ descripcion: " Filtro ", cantidad: 2, precio_unitario: 12000.555, costo_unitario: 8000 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0].descripcion).toBe("Filtro");
      expect(r.items[0].precio_unitario).toBe(12000.56);
      expect(r.items[0].inventario_id).toBeNull();
    }
  });
  it("rechaza descripción vacía, cantidad <= 0 y precios negativos o no numéricos", () => {
    expect(validarItems([{ descripcion: "", cantidad: 1, precio_unitario: 1 }]).ok).toBe(false);
    expect(validarItems([{ descripcion: "x", cantidad: 0, precio_unitario: 1 }]).ok).toBe(false);
    expect(validarItems([{ descripcion: "x", cantidad: 1, precio_unitario: -5 }]).ok).toBe(false);
    expect(validarItems([{ descripcion: "x", cantidad: "abc", precio_unitario: 1 }]).ok).toBe(false);
    expect(validarItems("no es lista").ok).toBe(false);
  });
  it("descarta ids de inventario que no son UUID", () => {
    const r = validarItems([{ inventario_id: "'; drop table", descripcion: "x", cantidad: 1, precio_unitario: 1 }]);
    expect(r.ok && r.items[0].inventario_id).toBeNull();
  });
  it("limita la cantidad de ítems", () => {
    const muchos = Array.from({ length: 61 }, () => ({ descripcion: "x", cantidad: 1, precio_unitario: 1 }));
    expect(validarItems(muchos).ok).toBe(false);
  });
});

describe("mensajeCotizacion", () => {
  it("lista ítems, mano de obra, total y vigencia", () => {
    const m = mensajeCotizacion({
      cliente: "Ana Ruiz",
      vehiculo: "Chevrolet Spark GT 2018",
      placa: "ABC123",
      manoObra: 150000,
      items: [{ descripcion: "Compresor", cantidad: 1, precio_unitario: 400000 }],
      total: 550000,
      vigenteHasta: "12 oct 2026",
    });
    expect(m).toContain("Hola Ana");
    expect(m).toContain("1 × Compresor");
    expect(m).toContain("Mano de obra");
    expect(m).toMatch(/Total: .*550\.000/);
    expect(m).toContain("12 oct 2026");
  });
});
