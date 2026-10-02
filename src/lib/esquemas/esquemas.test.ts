import { describe, expect, it } from "vitest";
import { validar } from "@/lib/esquemas/comunes";
import { anularGastoSchema, editarGastoSchema } from "@/lib/esquemas/gasto";
import { ajustarStockSchema, crearItemSchema, editarItemSchema } from "@/lib/esquemas/inventario";
import { validarOperacion } from "@/lib/esquemas/operaciones";
import { camposOrdenSchema, mantenimientoSchema, pertenenciasONull } from "@/lib/esquemas/orden";
import {
  camposVehiculoNuevoSchema,
  editarClienteSchema,
  editarVehiculoSchema,
  vehiculoOrdenSchema,
} from "@/lib/esquemas/vehiculo";
import { hoyBogota } from "@/lib/caja";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const ID2 = "223e4567-e89b-12d3-a456-426614174000";
const error = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

// ---------------------------------------------------------------------
describe("vehículo y cliente", () => {
  const nuevo = {
    cliente_nombre: "  Luis Peña ", cliente_telefono: "300 123 4567", placa: "xyz-987", marca: " Renault ", modelo: "Logan", anio: "2020",
  };

  it("camposVehiculoNuevo: normaliza y valida en el orden cliente → teléfono → placa → marca/línea → año", () => {
    const ok = validar(camposVehiculoNuevoSchema, nuevo);
    expect(ok).toMatchObject({ ok: true, valor: { cliente_nombre: "Luis Peña", placa: "XYZ987", marca: "Renault", anio: 2020 } });
    expect(error(validar(camposVehiculoNuevoSchema, { ...nuevo, cliente_nombre: "", placa: "AB" }))).toBe("Ingresa el nombre del cliente.");
    expect(error(validar(camposVehiculoNuevoSchema, { ...nuevo, cliente_telefono: "123", placa: "AB" }))).toContain("WhatsApp");
    expect(error(validar(camposVehiculoNuevoSchema, { ...nuevo, placa: "AB" }))).toBe("La placa debe tener entre 5 y 8 letras/números.");
    expect(error(validar(camposVehiculoNuevoSchema, { ...nuevo, modelo: " " }))).toBe("Ingresa la marca y la línea.");
    expect(error(validar(camposVehiculoNuevoSchema, { ...nuevo, anio: 1900 }))).toBe("El modelo (año) debe estar entre 1950 y 2100.");
    expect(validar(camposVehiculoNuevoSchema, { ...nuevo, anio: null }).ok).toBe(true);
    expect(error(validar(camposVehiculoNuevoSchema, null))).not.toBeNull();
  });

  it("vehiculoOrden: existente (solo id) o nuevo (con ids y datos), con mensajes claros", () => {
    expect(validar(vehiculoOrdenSchema, { id: ID })).toEqual({ ok: true, valor: { nuevo: false, id: ID } });
    expect(error(validar(vehiculoOrdenSchema, { id: "x" }))).toBe("Vehículo inválido.");
    expect(error(validar(vehiculoOrdenSchema, "texto"))).toBe("Vehículo inválido.");
    expect(error(validar(vehiculoOrdenSchema, { nuevo: true, id: ID, cliente_id: "x", ...nuevo }))).toBe("Cliente inválido (id).");
    const r = validar(vehiculoOrdenSchema, { nuevo: true, id: ID, cliente_id: ID2, ...nuevo });
    expect(r).toMatchObject({ ok: true, valor: { nuevo: true, id: ID, cliente_id: ID2, placa: "XYZ987" } });
  });

  it("editarVehiculo (valores de formulario): placa, marca/línea, año, refrigerante y carga", () => {
    const base = { vehiculo_id: ID, placa: "abc123", marca: "Kia", modelo: "Rio", anio: "", tipo_gas_sugerido: "", carga_estandar_gramos: "" };
    expect(validar(editarVehiculoSchema, base)).toMatchObject({
      ok: true, valor: { placa: "ABC123", anio: null, tipo_gas_sugerido: null, carga_estandar_gramos: null },
    });
    expect(validar(editarVehiculoSchema, { ...base, tipo_gas_sugerido: "R1234yf", carga_estandar_gramos: "450,5", anio: "2019" })).toMatchObject({
      ok: true, valor: { tipo_gas_sugerido: "R1234yf", carga_estandar_gramos: 450.5, anio: 2019 },
    });
    for (const [cambio, msg] of [
      [{ vehiculo_id: "x" }, "Vehículo inválido."],
      [{ placa: "A" }, "La placa debe tener entre 5 y 8 letras/números."],
      [{ marca: "" }, "Ingresa la marca y la línea."],
      [{ anio: "3000" }, "El modelo (año) debe estar entre 1950 y 2100."],
      [{ tipo_gas_sugerido: "R22" }, "Tipo de refrigerante inválido."],
      [{ carga_estandar_gramos: "0" }, "La carga estándar debe ser un valor en gramos mayor a 0."],
      [{ carga_estandar_gramos: "100000" }, "La carga estándar debe ser un valor en gramos mayor a 0."],
    ] as const) {
      expect(error(validar(editarVehiculoSchema, { ...base, ...cambio })), JSON.stringify(cambio)).toBe(msg);
    }
  });

  it("editarCliente: nombre, WhatsApp y documento opcional", () => {
    expect(validar(editarClienteSchema, { cliente_id: ID, nombre: " Ana ", telefono: "3001234567", documento: "" })).toMatchObject({
      ok: true, valor: { nombre: "Ana", telefono: "+573001234567", documento: null },
    });
    expect(error(validar(editarClienteSchema, { cliente_id: "x", nombre: "Ana", telefono: "3001234567" }))).toBe("Cliente inválido.");
    expect(error(validar(editarClienteSchema, { cliente_id: ID, nombre: "", telefono: "3001234567" }))).toBe("Ingresa el nombre del cliente.");
    expect(error(validar(editarClienteSchema, { cliente_id: ID, nombre: "Ana", telefono: "12" }))).toContain("WhatsApp");
  });
});

// ---------------------------------------------------------------------
describe("orden", () => {
  const base = { kilometraje: "", mano_obra: "", total_cobrado: "", dias_garantia: 0, estado: "recibido", diagnostico_inicial: "", trabajos_a_realizar: "" };

  it("camposOrden: convierte el texto del formulario y aplica los valores por defecto", () => {
    expect(validar(camposOrdenSchema, base)).toEqual({
      ok: true,
      valor: { kilometraje: null, mano_obra: 0, total_cobrado: 0, dias_garantia: 0, estado: "recibido", diagnostico_inicial: null, trabajos_a_realizar: null },
    });
    expect(validar(camposOrdenSchema, { ...base, kilometraje: "85000", mano_obra: "200000,5", dias_garantia: 90, estado: "listo", diagnostico_inicial: " fuga " })).toMatchObject({
      ok: true, valor: { kilometraje: 85000, mano_obra: 200000.5, dias_garantia: 90, estado: "listo", diagnostico_inicial: "fuga" },
    });
  });

  it("camposOrden: un mensaje por regla", () => {
    for (const [cambio, msg] of [
      [{ kilometraje: "-1" }, "El kilometraje debe ser un número entero mayor o igual a 0."],
      [{ kilometraje: "1.5" }, "El kilometraje debe ser un número entero mayor o igual a 0."],
      [{ mano_obra: "-5" }, "La mano de obra debe ser un valor mayor o igual a 0."],
      [{ total_cobrado: "abc" }, "El total cobrado debe ser un valor mayor o igual a 0."],
      [{ dias_garantia: 45 }, "Selecciona un plazo de garantía válido."],
      [{ estado: "volando" }, "Estado inválido."],
    ] as const) {
      expect(error(validar(camposOrdenSchema, { ...base, ...cambio })), JSON.stringify(cambio)).toBe(msg);
    }
  });

  it("pertenencias y mantenimiento se reconstruyen campo a campo", () => {
    expect(pertenenciasONull(null)).toBeNull();
    expect(pertenenciasONull("x")).toBeNull();
    expect(pertenenciasONull({ carroceria: "rayones", llanta_repuesto: true, extra: "se descarta", objetos_valor: "  gafas " })).toEqual({
      carroceria: "rayones", llanta_repuesto: true, herramientas: false, documentos: false, objetos_valor: "gafas", notas: "",
    });
    expect(pertenenciasONull({ carroceria: "explotado" })?.carroceria).toBe("sin_danos");
    expect([3, 6, 12, 5, null, "6"].map((m) => validar(mantenimientoSchema, m))).toEqual([
      { ok: true, valor: 3 }, { ok: true, valor: 6 }, { ok: true, valor: 12 },
      { ok: true, valor: null }, { ok: true, valor: null }, { ok: true, valor: null },
    ]);
  });
});

// ---------------------------------------------------------------------
describe("gasto (edición y anulación)", () => {
  const base = { id: ID, fecha: "2026-01-15", categoria: "flete_acarreo", monto: 25000.456, descripcion: "  Flete ", ordenId: ID2, autor: "Polo" };

  it("editar: normaliza (monto a centavos, descripción limpia) y valida la fecha contra HOY", () => {
    expect(validar(editarGastoSchema, base)).toEqual({
      ok: true,
      valor: { id: ID, fecha: "2026-01-15", categoria: "flete_acarreo", monto: 25000.46, descripcion: "Flete", ordenId: ID2, autor: "Polo" },
    });
    expect(validar(editarGastoSchema, { ...base, fecha: hoyBogota() }).ok).toBe(true);
    for (const [cambio, msg] of [
      [{ id: "x" }, "Gasto inválido."],
      [{ fecha: "2999-01-01" }, "La fecha no puede ser futura."],
      [{ fecha: "15/01/2026" }, "La fecha no puede ser futura."],
      [{ fecha: "2026-02-31" }, "La fecha no puede ser futura."],
      [{ categoria: "lujos" }, "Categoría inválida."],
      [{ monto: 0 }, "Ingresa un monto mayor a 0."],
      [{ ordenId: "x" }, "Orden inválida."],
    ] as const) {
      expect(error(validar(editarGastoSchema, { ...base, ...cambio })), JSON.stringify(cambio)).toBe(msg);
    }
    expect(validar(editarGastoSchema, { ...base, ordenId: null, autor: "x".repeat(60), descripcion: "" })).toMatchObject({
      ok: true, valor: { ordenId: null, autor: null, descripcion: null },
    });
  });

  it("anular: motivo de 3 a 300 caracteres y autor válido", () => {
    expect(validar(anularGastoSchema, { id: ID, motivo: `  ${"x".repeat(400)} `, autor: "Soporte técnico" })).toMatchObject({
      ok: true, valor: { motivo: "x".repeat(300), autor: "Soporte técnico" },
    });
    expect(error(validar(anularGastoSchema, { id: ID, motivo: " ab " }))).toBe("Escribe el motivo de la anulación.");
    expect(error(validar(anularGastoSchema, { id: "x", motivo: "duplicado" }))).toBe("Gasto inválido.");
  });
});

// ---------------------------------------------------------------------
describe("inventario", () => {
  const item = { codigo: " CMP-01 ", nombre: " Compresor ", tipo_unidad: "", stock_actual: "", stock_minimo: "2", costo_compra: "100000", precio_venta: "150000", descripcion: "" };

  it("crear: unidad «unidad» por defecto, números del formulario y descripción opcional", () => {
    expect(validar(crearItemSchema, item)).toEqual({
      ok: true,
      valor: { codigo: "CMP-01", nombre: "Compresor", tipo_unidad: "unidad", stock_actual: 0, stock_minimo: 2, costo_compra: 100000, precio_venta: 150000, descripcion: null },
    });
  });

  it("crear: mensajes por regla y orden de validación (código → nombre → unidad → stock → precios → enteros)", () => {
    for (const [cambio, msg] of [
      [{ codigo: "" }, "Ingresa el código del ítem."],
      [{ nombre: " " }, "Ingresa el nombre del ítem."],
      [{ tipo_unidad: "litros" }, "Unidad de medida inválida."],
      [{ stock_actual: "-1" }, "El stock debe ser un número mayor o igual a 0."],
      [{ stock_minimo: "x" }, "El stock debe ser un número mayor o igual a 0."],
      [{ costo_compra: "-5" }, "Los precios deben ser valores mayores o iguales a 0."],
      [{ precio_venta: "abc" }, "Los precios deben ser valores mayores o iguales a 0."],
      [{ stock_actual: "1.5" }, "Las unidades físicas deben ser cantidades enteras."],
    ] as const) {
      expect(error(validar(crearItemSchema, { ...item, ...cambio })), JSON.stringify(cambio)).toBe(msg);
    }
    // Los insumos a granel sí admiten decimales.
    expect(validar(crearItemSchema, { ...item, tipo_unidad: "gramo", stock_actual: "450,5" }).ok).toBe(true);
  });

  it("editar y ajustar", () => {
    expect(validar(editarItemSchema, { inventario_id: ID, codigo: "C", nombre: "N", stock_minimo: "", costo_compra: "", precio_venta: "", descripcion: "x" })).toMatchObject({
      ok: true, valor: { stock_minimo: 0, costo_compra: 0, descripcion: "x" },
    });
    expect(error(validar(editarItemSchema, { inventario_id: "", codigo: "C", nombre: "N" }))).toBe("Ítem inválido.");
    expect(error(validar(editarItemSchema, { inventario_id: ID, codigo: "C", nombre: "N", stock_minimo: "-1" }))).toBe("El stock mínimo debe ser un número mayor o igual a 0.");

    expect(validar(ajustarStockSchema, { inventario_id: ID, cantidad: "12,5", costo_compra: "" })).toEqual({
      ok: true, valor: { inventario_id: ID, cantidad: 12.5, costo_compra: null },
    });
    for (const [cambio, msg] of [
      [{ inventario_id: "" }, "Ítem inválido."],
      [{ cantidad: "0" }, "Ingresa una cantidad mayor a 0."],
      [{ cantidad: "" }, "Ingresa una cantidad mayor a 0."],
      [{ costo_compra: "-1" }, "El costo de compra debe ser mayor o igual a 0."],
    ] as const) {
      const base = { inventario_id: ID, cantidad: "1", costo_compra: "" };
      expect(error(validar(ajustarStockSchema, { ...base, ...cambio })), JSON.stringify(cambio)).toBe(msg);
    }
  });
});

// ---------------------------------------------------------------------
describe("operaciones offline (validarOperacion)", () => {
  const orden = (vehiculo: unknown, extra: Record<string, unknown> = {}) => ({ tipo: "orden.crear", datos: { id: ID, vehiculo, ...extra } });

  it("rechaza lo que no es una operación y los tipos desconocidos", () => {
    for (const malo of [null, "x", {}, { tipo: "gasto.crear" }, { tipo: 5, datos: {} }]) {
      expect(error(validarOperacion(malo)), JSON.stringify(malo)).toBe("Operación inválida.");
    }
    expect(error(validarOperacion({ tipo: "borrar.todo", datos: {} }))).toBe("Tipo de operación desconocido: borrar.todo");
  });

  it("orden.crear: los cobros inválidos se sanean (0), el estado por defecto es «recibido» y el mantenimiento solo 3/6/12", () => {
    const r = validarOperacion(orden({ id: ID2 }, { mano_obra: -5, total_cobrado: "x", dias_garantia: NaN, kilometraje: 1.5, mantenimiento_meses: 7 }));
    expect(r).toMatchObject({
      ok: true,
      valor: { datos: { mano_obra: 0, total_cobrado: 0, dias_garantia: 0, kilometraje: null, estado: "recibido", mantenimiento_meses: null, vehiculo: { nuevo: false, id: ID2 } } },
    });
    expect(error(validarOperacion(orden({ id: ID2 }, { estado: "volando" })))).toBe("Estado inválido.");
    expect(error(validarOperacion({ tipo: "orden.crear", datos: { id: "x", vehiculo: { id: ID2 } } }))).toBe("Orden inválida (id).");
  });

  it("orden.crear: el vehículo NUEVO se valida y normaliza ya al recibirla", () => {
    const nuevo = { nuevo: true, id: ID2, cliente_id: ID, cliente_nombre: "Ana", cliente_telefono: "3001234567", placa: "abc-123", marca: "Kia", modelo: "Rio", anio: 2019 };
    expect(validarOperacion(orden(nuevo))).toMatchObject({
      ok: true, valor: { datos: { vehiculo: { nuevo: true, placa: "ABC123", cliente_telefono: "+573001234567" } } },
    });
    expect(error(validarOperacion(orden({ ...nuevo, placa: "A" })))).toBe("La placa debe tener entre 5 y 8 letras/números.");
    expect(error(validarOperacion(orden({ ...nuevo, cliente_id: "x" })))).toBe("Cliente inválido (id).");
  });

  it("los tipos derivados del esquema coinciden con lo que sale del validador (gasto y pago)", () => {
    const g = validarOperacion({ tipo: "gasto.crear", conArchivo: true, extension: "webp", datos: { id: ID, fecha: "2026-09-29", monto: 1500.555, categoria: "otros", orden_id: null, descripcion: "  x ", autor: "Polo" } });
    expect(g).toEqual({
      ok: true,
      valor: { tipo: "gasto.crear", conArchivo: true, extension: "webp", datos: { id: ID, fecha: "2026-09-29", monto: 1500.56, categoria: "otros", orden_id: null, descripcion: "x", autor: "Polo" } },
    });
    const p = validarOperacion({ tipo: "pago.crear", datos: { id: ID, orden_id: ID2, fecha: "2026-09-29", monto: 5000, medio: "efectivo", es_devolucion: "sí", referencia: "  ", notas: null } });
    expect(p).toMatchObject({ ok: true, valor: { conArchivo: false, datos: { es_devolucion: false, referencia: null, autor: null } } });
  });
});
