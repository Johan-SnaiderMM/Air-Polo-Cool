import { describe, expect, it } from "vitest";
import { describirOperacion, esErrorTransitorio, validarOperacion } from "@/lib/offline/operaciones";
import { buscarOrdenesLocal, buscarVehiculosLocal, type Snapshot } from "@/lib/offline/snapshot";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const ID2 = "223e4567-e89b-12d3-a456-426614174000";

describe("validarOperacion: gasto.crear", () => {
  const base = { id: ID, fecha: "2026-09-29", monto: 15000, categoria: "alimentacion_refrigerio", descripcion: " Almuerzo ", orden_id: null, autor: "Polo" };

  it("acepta un gasto válido y normaliza", () => {
    const r = validarOperacion({ tipo: "gasto.crear", datos: base });
    expect(r.ok).toBe(true);
    if (r.ok && r.valor.tipo === "gasto.crear") {
      expect(r.valor.datos.descripcion).toBe("Almuerzo");
      expect(r.valor.datos.autor).toBe("Polo");
    }
  });
  it("descarta autores no permitidos (queda null)", () => {
    const r = validarOperacion({ tipo: "gasto.crear", datos: { ...base, autor: "Hacker" } });
    expect(r.ok && r.valor.tipo === "gasto.crear" && r.valor.datos.autor).toBeNull();
  });
  it("rechaza id, fecha, monto y categoría inválidos", () => {
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, id: "x" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, fecha: "2026-13-40" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, fecha: "29/09/2026" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, monto: 0 } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, monto: -5 } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, monto: 1e12 } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, monto: "15000" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, categoria: "lujos" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear", datos: { ...base, orden_id: "no-uuid" } }).ok).toBe(false);
  });
});

describe("validarOperacion: pago, caja y evidencia", () => {
  it("pago: medios válidos y devolución", () => {
    const ok = validarOperacion({
      tipo: "pago.crear",
      datos: { id: ID, orden_id: ID2, fecha: "2026-09-29", monto: 80000, medio: "transferencia", es_devolucion: false, referencia: "  ABC  ", notas: null, autor: "Soporte técnico" },
    });
    expect(ok.ok && ok.valor.tipo === "pago.crear" && ok.valor.datos.referencia).toBe("ABC");
    const mal = validarOperacion({
      tipo: "pago.crear",
      datos: { id: ID, orden_id: ID2, fecha: "2026-09-29", monto: 80000, medio: "cripto" },
    });
    expect(mal.ok).toBe(false);
  });
  it("evidencia: exige extensión, tipo y ids válidos; siempre lleva archivo", () => {
    const r = validarOperacion({ tipo: "evidencia.subir", datos: { id: ID, orden_id: ID2, tipo: "prueba_tecnica", extension: "webp" } });
    expect(r.ok && r.valor.tipo === "evidencia.subir" && r.valor.conArchivo).toBe(true);
    expect(validarOperacion({ tipo: "evidencia.subir", datos: { id: ID, orden_id: ID2, tipo: "prueba_tecnica", extension: "exe" } }).ok).toBe(false);
    expect(validarOperacion({ tipo: "evidencia.subir", datos: { id: ID, orden_id: ID2, tipo: "selfie", extension: "webp" } }).ok).toBe(false);
  });
  it("evidencia: solo las fotos de repuesto pueden ligarse a un repuesto", () => {
    const ev = (tipo: string, orden_repuesto_id?: unknown) =>
      validarOperacion({ tipo: "evidencia.subir", datos: { id: ID, orden_id: ID2, tipo, extension: "webp", orden_repuesto_id } });
    const ok = ev("repuesto_viejo", ID2);
    expect(ok.ok && ok.valor.tipo === "evidencia.subir" && ok.valor.datos.orden_repuesto_id).toBe(ID2);
    expect(ev("repuesto_nuevo", ID2).ok).toBe(true);
    expect(ev("ingreso", ID2).ok).toBe(false);
    expect(ev("repuesto_viejo", "no-es-uuid").ok).toBe(false);
    // Sin vínculo (o una operación vieja de la cola, anterior a la fase 5): queda null.
    const sin = ev("repuesto_viejo");
    expect(sin.ok && sin.valor.tipo === "evidencia.subir" && sin.valor.datos.orden_repuesto_id).toBeNull();
  });
  it("rechaza tipos desconocidos y basura", () => {
    expect(validarOperacion({ tipo: "borrar.todo", datos: {} }).ok).toBe(false);
    expect(validarOperacion(null).ok).toBe(false);
    expect(validarOperacion("texto").ok).toBe(false);
    expect(validarOperacion({ tipo: "gasto.crear" }).ok).toBe(false);
  });
});

describe("validarOperacion: orden.crear", () => {
  const nuevoVeh = {
    nuevo: true, id: ID, cliente_id: ID2, cliente_nombre: "Ana Ruiz", cliente_telefono: "300 123 4567",
    placa: "abc-123", marca: "Chevrolet", modelo: "Spark GT", anio: 2018,
  };
  it("acepta una orden con vehículo nuevo y pertenencias", () => {
    const r = validarOperacion({
      tipo: "orden.crear",
      datos: {
        id: ID2, vehiculo: nuevoVeh, kilometraje: 85000, mano_obra: 100000, total_cobrado: 250000, dias_garantia: 90,
        estado: "recibido", mantenimiento_meses: 6,
        pertenencias: { carroceria: "rayones", llanta_repuesto: true, herramientas: false, documentos: true, objetos_valor: "gafas", notas: "" },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.valor.tipo === "orden.crear") {
      expect(r.valor.datos.mantenimiento_meses).toBe(6);
      expect(r.valor.datos.pertenencias?.carroceria).toBe("rayones");
    }
  });
  it("mantenimiento solo 3/6/12; km entero; estado válido", () => {
    const con = (extra: Record<string, unknown>) =>
      validarOperacion({ tipo: "orden.crear", datos: { id: ID2, vehiculo: { nuevo: false, id: ID }, ...extra } });
    const r5 = con({ mantenimiento_meses: 5 });
    expect(r5.ok && r5.valor.tipo === "orden.crear" && r5.valor.datos.mantenimiento_meses).toBeNull();
    const rKm = con({ kilometraje: 10.5 });
    expect(rKm.ok && rKm.valor.tipo === "orden.crear" && rKm.valor.datos.kilometraje).toBeNull();
    expect(con({ estado: "volando" }).ok).toBe(false);
  });
  it("rechaza vehículo sin id válido", () => {
    expect(validarOperacion({ tipo: "orden.crear", datos: { id: ID2, vehiculo: { nuevo: false, id: "x" } } }).ok).toBe(false);
  });
});

describe("utilidades", () => {
  it("describe cada operación para la lista de pendientes", () => {
    const g = validarOperacion({ tipo: "gasto.crear", datos: { id: ID, fecha: "2026-09-29", monto: 15000, categoria: "otros" }, conArchivo: true });
    expect(g.ok && describirOperacion(g.valor)).toMatch(/Gasto .*15\.000.*con recibo/);
  });
  it("solo errores de conexión/recursos son transitorios", () => {
    expect(esErrorTransitorio("08006")).toBe(true);
    expect(esErrorTransitorio("53300")).toBe(true);
    expect(esErrorTransitorio("57014")).toBe(true);
    expect(esErrorTransitorio("23505")).toBe(false);
    expect(esErrorTransitorio(undefined)).toBe(false);
  });
});

describe("búsqueda local (snapshot offline)", () => {
  const snapshot: Snapshot = {
    generado: "2026-09-29T00:00:00Z",
    vehiculos: [
      { id: "1", placa: "ABC123", marca: "Chevrolet", modelo: "Spark", anio: 2018, cliente_id: "c1", cliente: "José Pérez", telefono: "+573001234567" },
      { id: "2", placa: "XYZ987", marca: "Renault", modelo: "Duster", anio: 2021, cliente_id: "c2", cliente: "Ana Ruiz", telefono: "+573115559999" },
    ],
    ordenes: [
      { id: "o1", placa: "ABC123", marca: "Chevrolet", modelo: "Spark", cliente: "José Pérez", estado: "entregado", total_cobrado: 500000, saldo: 100000 },
    ],
  };
  it("busca por placa (sin guiones ni mayúsculas), nombre sin tildes y teléfono", () => {
    expect(buscarVehiculosLocal(snapshot, "abc-12")[0]?.id).toBe("1");
    expect(buscarVehiculosLocal(snapshot, "jose")[0]?.id).toBe("1");
    expect(buscarVehiculosLocal(snapshot, "311555")[0]?.id).toBe("2");
    expect(buscarVehiculosLocal(snapshot, "zzz")).toHaveLength(0);
  });
  it("no busca con menos de 2 caracteres ni sin snapshot", () => {
    expect(buscarVehiculosLocal(snapshot, "a")).toHaveLength(0);
    expect(buscarVehiculosLocal(null, "abc")).toHaveLength(0);
  });
  it("órdenes: vacío devuelve las recientes; con texto filtra", () => {
    expect(buscarOrdenesLocal(snapshot, "")).toHaveLength(1);
    expect(buscarOrdenesLocal(snapshot, "abc")).toHaveLength(1);
    expect(buscarOrdenesLocal(snapshot, "nadie")).toHaveLength(0);
  });
});
