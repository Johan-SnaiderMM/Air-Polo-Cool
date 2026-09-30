import { describe, expect, it } from "vitest";
import { agruparCartera, cargarCartera, type FilaCartera } from "@/lib/datos/cartera";
import { cargarReporteMes, gastosPorCategoria } from "@/lib/datos/caja";
import { cargarCotizacion, listarCotizaciones } from "@/lib/datos/cotizaciones";
import { cargarGarantias, contarGarantias, garantiasVisibles, type Garantia, type Mantenimiento } from "@/lib/datos/garantias";
import { esCritico, listarInventario } from "@/lib/datos/inventario";
import { armarComprobante } from "@/lib/datos/mapeo";
import { cargarComprobanteOrden } from "@/lib/datos/ordenes";
import { buscarVehiculoParaOrden, cargarHistorialVehiculo, listarVehiculos, resumirServicios } from "@/lib/datos/vehiculos";
import { filtroCatalogo, limpiarTextoBusqueda } from "@/lib/consultas";
import { crearSupabaseFalso, type Llamada, type Respuesta } from "@/test/supabase-falso";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const falso = (responder?: (l: Llamada) => Respuesta | undefined) => crearSupabaseFalso({ responder });

// ---------------------------------------------------------------------
describe("búsqueda", () => {
  it("limpiarTextoBusqueda y filtroCatalogo neutralizan los caracteres de PostgREST", () => {
    expect(limpiarTextoBusqueda("  comp%,res()or* ")).toBe("comp  res  or");
    expect(filtroCatalogo("comp%res")).toBe("codigo.ilike.%comp res%,nombre.ilike.%comp res%");
    expect(filtroCatalogo("  %%  ")).toBeNull();
    expect(filtroCatalogo("")).toBeNull();
  });
});

// ---------------------------------------------------------------------
describe("vehículos", () => {
  const veh = { id: ID, placa: "ABC123", marca: "Kia", modelo: "Rio", anio: 2019, clientes: { nombre: "Ana", telefono: "+57300" } };

  it("listarVehiculos: sin búsqueda lista los más recientes; una búsqueda sin coincidencias posibles no consulta", async () => {
    const f = falso(() => ({ data: [veh] }));
    const r = await listarVehiculos(f.cliente, { q: "", limite: 50 });
    expect(r).toEqual({ vehiculos: [veh], error: null });
    expect(f.de("select", "vehiculos")).toHaveLength(1);

    const g = falso(() => ({ data: [veh] }));
    expect(await listarVehiculos(g.cliente, { q: "%%%", limite: 50 })).toEqual({ vehiculos: [], error: null });
    expect(g.llamadas).toHaveLength(0);
  });

  it("listarVehiculos: con texto filtra por placa o cliente y propaga el error", async () => {
    const f = falso((l) => (l.tabla === "clientes" ? { data: [{ id: "c1" }] } : { error: { message: "boom" } }));
    const r = await listarVehiculos(f.cliente, { q: "abc", limite: 50 });
    expect(r.error).toBe("boom");
    const or = f.de("select", "vehiculos")[0].filtros.find((x) => x.op === "or")!.valor as string;
    expect(or).toContain("placa.ilike.%ABC%");
    expect(or).toContain("cliente_id.in.(c1)");
  });

  it("resumirServicios: último km (del más reciente que lo tenga) y total sin cancelados", () => {
    expect(
      resumirServicios([
        { estado: "entregado", kilometraje: null, total_cobrado: 100 },
        { estado: "cancelado", kilometraje: 90000, total_cobrado: 999 },
        { estado: "entregado", kilometraje: 80000, total_cobrado: 50 },
      ])
    ).toEqual({ ultimoKm: 90000, totalFacturado: 150 });
    expect(resumirServicios([])).toEqual({ ultimoKm: null, totalFacturado: 0 });
  });

  it("cargarHistorialVehiculo: null si no existe o no tiene cliente; si existe reúne ficha, servicios y otros vehículos", async () => {
    expect(await cargarHistorialVehiculo(falso(() => ({ data: [] })).cliente, ID)).toBeNull();
    expect(await cargarHistorialVehiculo(falso(() => ({ data: [{ id: ID, clientes: null }] })).cliente, ID)).toBeNull();

    const f = falso((l) => {
      if (l.tabla === "ordenes_servicio") return { data: [{ id: "o1", estado: "entregado", kilometraje: 85000, total_cobrado: 450000, orden_repuestos: [] }] };
      if (l.tabla === "vehiculos" && l.filtros.some((x) => x.op === "neq")) return { data: [{ id: "v2", placa: "XYZ987", marca: "Kia", modelo: "Rio" }] };
      return { data: [{ id: ID, placa: "ABC123", clientes: { id: "c1", nombre: "Ana" } }] };
    });
    const h = await cargarHistorialVehiculo(f.cliente, ID);
    expect(h).toMatchObject({ cliente: { nombre: "Ana" }, ultimoKm: 85000, totalFacturado: 450000 });
    expect(h!.servicios).toHaveLength(1);
    expect(h!.otrosDelCliente.map((o) => o.placa)).toEqual(["XYZ987"]);
    // Los otros vehículos se piden del MISMO cliente y sin repetir el actual.
    const otros = f.de("select", "vehiculos").find((l) => l.filtros.some((x) => x.op === "neq"))!;
    expect(otros.filtros).toEqual(expect.arrayContaining([{ col: "cliente_id", op: "eq", valor: "c1" }, { col: "id", op: "neq", valor: ID }]));
  });

  it("buscarVehiculoParaOrden: arma el resultado del selector (cliente vacío si falta) o null", async () => {
    expect(await buscarVehiculoParaOrden(falso(() => ({ data: [] })).cliente, ID)).toBeNull();
    const r = await buscarVehiculoParaOrden(falso(() => ({ data: [{ id: ID, placa: "ABC123", marca: "Kia", modelo: "Rio", anio: null, clientes: null }] })).cliente, ID);
    expect(r).toEqual({ id: ID, placa: "ABC123", marca: "Kia", modelo: "Rio", anio: null, cliente: "" });
  });
});

// ---------------------------------------------------------------------
describe("garantías", () => {
  const g = (orden_id: string, semaforo: Garantia["semaforo"]) => ({ orden_id, semaforo } as Garantia);
  const todas = [g("a", "verde"), g("b", "rojo"), g("c", "rojo"), g("d", "amarillo")];
  const mant = (estado: string) => ({ estado_mantenimiento: estado } as Mantenimiento);

  it("contar: por semáforo, total y mantenimientos pendientes (los «lejanos» no cuentan)", () => {
    expect(contarGarantias(todas, [mant("vencido"), mant("proximo"), mant("lejano")])).toEqual({
      amarillo: 1, verde: 1, rojo: 2, todas: 4, mantenimiento: 2,
    });
  });

  it("visibles: filtra por semáforo y muestra primero las vencidas más recientes", () => {
    expect(garantiasVisibles(todas, "verde").map((x) => x.orden_id)).toEqual(["a"]);
    expect(garantiasVisibles(todas, "rojo").map((x) => x.orden_id)).toEqual(["c", "b"]);
    expect(garantiasVisibles(todas, "todas")).toHaveLength(4);
  });

  it("cargarGarantias: descarta filas incompletas y tolera que falte la migración de mantenimientos", async () => {
    const f = falso((l) =>
      l.tabla === "v_garantias"
        ? { data: [{ orden_id: "a", semaforo: "verde" }, { orden_id: null, semaforo: "rojo" }, { orden_id: "b", semaforo: null }] }
        : { error: { code: "PGRST205", message: "no existe" } }
    );
    const r = await cargarGarantias(f.cliente);
    expect(r.garantias.map((x) => x.orden_id)).toEqual(["a"]);
    expect(r.mantenimientos).toEqual([]);
    expect(r.error).toBeNull();
  });
});

// ---------------------------------------------------------------------
describe("cartera", () => {
  const fila = (orden_id: string, cliente: string | null, telefono: string | null, saldo: number) => ({ orden_id, cliente, telefono, saldo } as FilaCartera);

  it("agruparCartera: mismo teléfono = mismo cliente, de mayor a menor deuda", () => {
    const r = agruparCartera([fila("o1", "Ana", "+57300", 100), fila("o2", "Luis", "+57311", 500), fila("o3", "Ana R.", "+57300", 250)]);
    expect(r.map((c) => [c.nombre, c.total, c.ordenes.length])).toEqual([["Luis", 500, 1], ["Ana", 350, 2]]);
    // Sin teléfono ni nombre, cada orden es su propio cliente.
    expect(agruparCartera([fila("x", null, null, 1), fila("y", null, null, 2)])).toHaveLength(2);
  });

  it("cargarCartera: totales, y avisa si falta la migración de la fase 3", async () => {
    const f = falso(() => ({ data: [fila("o1", "Ana", "+57300", 100), fila("o2", "Ana", "+57300", 50), { orden_id: null, saldo: 9 }] }));
    expect(await cargarCartera(f.cliente)).toMatchObject({ total: 150, totalOrdenes: 2, migracionPendiente: false, error: null });
    const sin = await cargarCartera(falso(() => ({ error: { code: "PGRST205", message: "no table" } })).cliente);
    expect(sin).toMatchObject({ migracionPendiente: true, clientes: [], total: 0 });
  });
});

// ---------------------------------------------------------------------
describe("inventario", () => {
  const item = (nombre: string, stock_actual: number, stock_minimo: number) => ({ id: nombre, nombre, stock_actual, stock_minimo });

  it("esCritico: en o por debajo del mínimo", () => {
    expect([esCritico({ stock_actual: 1, stock_minimo: 1 }), esCritico({ stock_actual: 0, stock_minimo: 2 }), esCritico({ stock_actual: 3, stock_minimo: 2 })]).toEqual([true, true, false]);
  });

  it("listarInventario: el filtro crítico se aplica sobre el catálogo y el conteo es independiente", async () => {
    const f = falso((l) => (l.tabla === "v_inventario_reposicion" ? { count: 7 } : { data: [item("a", 5, 1), item("b", 0, 2), item("c", 2, 2)] }));
    const r = await listarInventario(f.cliente, { q: "", critico: true, limite: 100 });
    expect(r.items.map((i) => i.nombre)).toEqual(["b", "c"]);
    expect(r.totalCriticos).toBe(7);

    const todo = await listarInventario(falso(() => ({ data: [item("a", 5, 1)] })).cliente, { q: "comp", critico: false, limite: 100 });
    expect(todo.items).toHaveLength(1);
    expect(todo.totalCriticos).toBe(0);
  });

  it("listarInventario: con texto busca por código o nombre y respeta el límite del crítico", async () => {
    const f = falso(() => ({ data: Array.from({ length: 5 }, (_, i) => item(`x${i}`, 0, 1)) }));
    const r = await listarInventario(f.cliente, { q: "comp%", critico: true, limite: 3 });
    expect(r.items).toHaveLength(3);
    const or = f.de("select", "inventario")[0].filtros.find((x) => x.op === "or")!.valor;
    expect(or).toBe("codigo.ilike.%comp%,nombre.ilike.%comp%");
  });
});

// ---------------------------------------------------------------------
describe("cotizaciones", () => {
  it("listarCotizaciones: totales por id y migración pendiente", async () => {
    const f = falso((l) =>
      l.tabla === "v_cotizacion_totales" ? { data: [{ cotizacion_id: "c1", total: 500 }, { cotizacion_id: null, total: 1 }] } : { data: [{ id: "c1" }] }
    );
    const r = await listarCotizaciones(f.cliente, { estado: "borrador", limite: 80 });
    expect([...r.totalDe]).toEqual([["c1", 500]]);
    expect(r.cotizaciones).toHaveLength(1);
    expect(f.de("select", "cotizaciones")[0].filtros).toContainEqual({ col: "estado", op: "eq", valor: "borrador" });

    const sin = await listarCotizaciones(falso(() => ({ error: { code: "PGRST205", message: "x" } })).cliente, { limite: 80 });
    expect(sin).toMatchObject({ migracionPendiente: true, cotizaciones: [] });
  });

  it("cargarCotizacion: null si no existe; si existe trae sus ítems", async () => {
    expect(await cargarCotizacion(falso(() => ({ data: [] })).cliente, ID)).toBeNull();
    const f = falso((l) => (l.tabla === "cotizacion_items" ? { data: [{ id: "i1" }, { id: "i2" }] } : { data: [{ id: ID, estado: "borrador" }] }));
    const r = await cargarCotizacion(f.cliente, ID);
    expect(r!.cotizacion.id).toBe(ID);
    expect(r!.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------
describe("comprobante de la orden", () => {
  const repuestos = [
    { cantidad_usada: 2, precio_unitario: 15000.5, inventario: { nombre: "Filtro", tipo_unidad: "unidad" as const } },
    { cantidad_usada: 0.5, precio_unitario: 80000, inventario: { nombre: "Gas R134a", tipo_unidad: "gramo" as const } },
    { cantidad_usada: 1, precio_unitario: 999, inventario: null },
  ];

  it("armarComprobante: líneas con subtotal, ajuste (otros cargos o descuento), pagado neto y saldo", () => {
    const c = armarComprobante({ total_cobrado: 500000, mano_obra: 200000 }, repuestos, [
      { monto: 300000, es_devolucion: false },
      { monto: 50000, es_devolucion: true },
    ]);
    expect(c.lineas.map((l) => [l.nombre, l.subtotal])).toEqual([["Filtro", 30001], ["Gas R134a", 40000]]); // sin inventario no se imprime
    expect(c.totalRepuestos).toBe(70001);
    expect(c.ajuste).toBe(229999); // 500.000 − 200.000 − 70.001
    expect(c.pagado).toBe(250000);
    expect(c.saldo).toBe(250000);
  });

  it("el saldo puede ser negativo (pagó de más) y un descuento da ajuste negativo", () => {
    const c = armarComprobante({ total_cobrado: 100000, mano_obra: 120000 }, [], [{ monto: 150000, es_devolucion: false }]);
    expect(c.ajuste).toBe(-20000);
    expect(c.saldo).toBe(-50000);
  });

  it("cargarComprobanteOrden: null si no existe; si existe, las cifras salen de pagos vigentes", async () => {
    expect(await cargarComprobanteOrden(falso(() => ({ data: [] })).cliente, ID)).toBeNull();
    const f = falso((l) => {
      if (l.tabla === "orden_repuestos") return { data: repuestos };
      if (l.tabla === "pagos_orden") return { data: [{ monto: 100000, es_devolucion: false }] };
      return { data: [{ id: ID, total_cobrado: 500000, mano_obra: 200000 }] };
    });
    const r = await cargarComprobanteOrden(f.cliente, ID);
    expect(r).toMatchObject({ pagado: 100000, saldo: 400000, totalRepuestos: 70001 });
    expect(f.de("select", "pagos_orden")[0].filtros).toContainEqual({ col: "anulado", op: "eq", valor: false });
  });
});

// ---------------------------------------------------------------------
describe("reporte del mes", () => {
  it("gastosPorCategoria: solo categorías con gasto, en el orden del catálogo", () => {
    expect(
      gastosPorCategoria([
        { categoria: "otros", monto: 5 },
        { categoria: "ayudante", monto: 100 },
        { categoria: "ayudante", monto: 50 },
      ])
    ).toEqual([{ categoria: "ayudante", total: 150 }, { categoria: "otros", total: 5 }]);
    expect(gastosPorCategoria([])).toEqual([]);
  });

  it("cargarReporteMes: sin datos devuelve ceros; con datos, totales por categoría, por medio y cartera", async () => {
    const vacio = await cargarReporteMes(falso(() => ({ data: [] })).cliente, "2026-09");
    expect(vacio).toMatchObject({
      balance: { mes: "2026-09", cobrado: 0, utilidadReal: 0 }, porCategoria: [], totalGastos: 0, totalCartera: 0, rentabilidad: [],
    });
    expect(vacio.porMedio).toMatchObject({ efectivo: 0, transferencia: 0, total: 0 });

    const f = falso((l) => {
      if (l.tabla === "v_balance_real") return { data: [{ mes: "2026-09-01", facturado: 500, cobrado: 400, costo_repuestos: 100, gastos: 50, utilidad_real: 250 }] };
      if (l.tabla === "gastos_caja_menor") return { data: [{ categoria: "flete_acarreo", monto: 30 }, { categoria: "flete_acarreo", monto: 20 }] };
      if (l.tabla === "pagos_orden") return { data: [{ medio: "efectivo", monto: 300, es_devolucion: false }, { medio: "transferencia", monto: 100, es_devolucion: false }] };
      if (l.tabla === "v_cartera") return { data: [{ saldo: 70 }, { saldo: 30 }] };
      return { data: [] };
    });
    const r = await cargarReporteMes(f.cliente, "2026-09");
    expect(r.balance).toEqual({ mes: "2026-09", facturado: 500, cobrado: 400, costoRepuestos: 100, gastos: 50, utilidadReal: 250 });
    expect(r.porCategoria).toEqual([{ categoria: "flete_acarreo", total: 50 }]);
    expect(r.totalGastos).toBe(50);
    expect(r.porMedio).toMatchObject({ efectivo: 300, transferencia: 100, total: 400 });
    expect(r.totalCartera).toBe(100);
  });
});
