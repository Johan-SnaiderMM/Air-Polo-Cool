import { describe, expect, it } from "vitest";
import { validar } from "@/lib/esquemas/comunes";
import {
  MAX_ITEMS,
  cotizacionFormSchema,
  itemsCotizacionSchema,
  seleccionVehiculoSchema,
} from "@/lib/esquemas/cotizacion";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const error = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);
const item = (extra: Record<string, unknown> = {}) => ({ descripcion: "Filtro", cantidad: 1, precio_unitario: 12000, ...extra });

describe("ítems de cotización", () => {
  it("normaliza: texto recortado, decimales (cantidad 3, dinero 2), costo opcional y id de inventario válido o null", () => {
    const r = validar(itemsCotizacionSchema, [
      item({ descripcion: " Gas R134a ", cantidad: "1,5".replace(",", "."), precio_unitario: 30000.555, costo_unitario: 20000.004, inventario_id: ID }),
      item({ cantidad: 2.12345, inventario_id: "'; drop table" }),
    ]);
    expect(r).toEqual({
      ok: true,
      valor: [
        { descripcion: "Gas R134a", cantidad: 1.5, precio_unitario: 30000.56, costo_unitario: 20000, inventario_id: ID },
        { descripcion: "Filtro", cantidad: 2.123, precio_unitario: 12000, costo_unitario: 0, inventario_id: null },
      ],
    });
  });

  it("el error nombra el ítem o su descripción", () => {
    const e = (i: Record<string, unknown>, posicion = 0) =>
      error(validar(itemsCotizacionSchema, [...Array.from({ length: posicion }, () => item()), i]));
    expect(e(item({ descripcion: "  " }))).toBe("El ítem 1 no tiene descripción.");
    expect(e(item({ descripcion: undefined }), 2)).toBe("El ítem 3 no tiene descripción.");
    expect(e(item({ cantidad: 0 }))).toBe('Cantidad inválida en "Filtro".');
    expect(e(item({ cantidad: "abc" }))).toBe('Cantidad inválida en "Filtro".');
    expect(e(item({ cantidad: 1_000_001 }))).toBe('Cantidad inválida en "Filtro".');
    expect(e(item({ precio_unitario: -5 }))).toBe('Precio inválido en "Filtro".');
    expect(e(item({ precio_unitario: 10_000_000_000 }))).toBe('Precio inválido en "Filtro".');
    expect(e(item({ costo_unitario: -1 }))).toBe('Costo inválido en "Filtro".');
    expect(error(validar(itemsCotizacionSchema, [item(), null]))).toBe("Ítem 2 inválido.");
    expect(error(validar(itemsCotizacionSchema, ["texto"]))).toBe("Ítem 1 inválido.");
  });

  it("rechaza lo que no es lista y pone tope de ítems", () => {
    for (const malo of [undefined, null, "x", {}, 5]) {
      expect(error(validar(itemsCotizacionSchema, malo)), String(malo)).toBe("Los ítems no tienen un formato válido.");
    }
    expect(validar(itemsCotizacionSchema, []).ok).toBe(true);
    expect(validar(itemsCotizacionSchema, Array.from({ length: MAX_ITEMS }, () => item())).ok).toBe(true);
    expect(error(validar(itemsCotizacionSchema, Array.from({ length: MAX_ITEMS + 1 }, () => item())))).toBe(`Máximo ${MAX_ITEMS} ítems por cotización.`);
  });
});

describe("formulario de cotización", () => {
  const base = { items: [item()], mano_obra: "", vigencia_dias: "", notas: "", autor: "Polo" };

  it("valores por defecto: mano de obra 0, vigencia 15 días, notas null", () => {
    expect(validar(cotizacionFormSchema, base)).toMatchObject({
      ok: true,
      valor: { mano_obra: 0, vigencia_dias: 15, notas: null, autor: "Polo" },
    });
  });

  it("convierte mano de obra y vigencia, recorta notas y descarta un autor desconocido", () => {
    const r = validar(cotizacionFormSchema, { ...base, mano_obra: "150000", vigencia_dias: "30", notas: `  ${"n".repeat(1200)} `, autor: "x".repeat(60) });
    expect(r).toMatchObject({ ok: true, valor: { mano_obra: 150000, vigencia_dias: 30, autor: null } });
    expect(r.ok && r.valor.notas).toHaveLength(1000);
  });

  it("cada regla con su mensaje", () => {
    const e = (cambio: Record<string, unknown>) => error(validar(cotizacionFormSchema, { ...base, ...cambio }));
    expect(e({ items: "no es lista" })).toBe("Los ítems no tienen un formato válido.");
    expect(e({ items: [item({ precio_unitario: -1 })] })).toBe('Precio inválido en "Filtro".');
    expect(e({ mano_obra: "-5" })).toBe("La mano de obra debe ser un valor mayor o igual a 0.");
    expect(e({ mano_obra: "abc" })).toBe("La mano de obra debe ser un valor mayor o igual a 0.");
    expect(e({ mano_obra: "10000000000" })).toBe("La mano de obra debe ser un valor mayor o igual a 0.");
    expect(e({ vigencia_dias: "45" })).toBe("Vigencia inválida.");
    expect(e({ items: [], mano_obra: "0" })).toBe("Agrega al menos un ítem o la mano de obra.");
    expect(e({ items: [], mano_obra: "80000" })).toBeNull(); // solo mano de obra también vale
  });
});

describe("selección de vehículo", () => {
  const datos = { cliente_nombre: " Luis ", cliente_telefono: "300 123 4567", placa: "xyz-987", marca: "Renault", modelo: "Logan", anio: "2020" };

  it("existente: solo su id; nuevo: con las reglas de una orden nueva y datos normalizados", () => {
    expect(validar(seleccionVehiculoSchema, { modo: "existente", vehiculo: { id: ID } })).toEqual({ ok: true, valor: { nuevo: false, id: ID } });
    expect(validar(seleccionVehiculoSchema, { modo: "nuevo", datos })).toMatchObject({
      ok: true, valor: { nuevo: true, cliente_nombre: "Luis", placa: "XYZ987", anio: 2020 },
    });
  });

  it("rechaza con mensajes claros", () => {
    const pide = "Selecciona un vehículo o registra uno nuevo.";
    for (const malo of [undefined, null, "x", {}, { modo: "otro" }, { modo: "existente" }, { modo: "existente", vehiculo: { id: "x" } }, { modo: "nuevo" }]) {
      expect(error(validar(seleccionVehiculoSchema, malo)), JSON.stringify(malo)).toBeTruthy();
    }
    expect(error(validar(seleccionVehiculoSchema, { modo: "existente", vehiculo: { id: "x" } }))).toBe(pide);
    expect(error(validar(seleccionVehiculoSchema, null))).toBe(pide);
    expect(error(validar(seleccionVehiculoSchema, { modo: "nuevo", datos: { ...datos, placa: "A" } }))).toBe("La placa debe tener entre 5 y 8 letras/números.");
    expect(error(validar(seleccionVehiculoSchema, { modo: "nuevo", datos: { ...datos, anio: "20.5" } }))).toBe("El modelo (año) debe estar entre 1950 y 2100.");
  });
});
