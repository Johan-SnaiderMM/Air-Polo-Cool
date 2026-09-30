import { describe, expect, it } from "vitest";
import { cargarBalanceMes, cargarCobrosMes, cargarGastosMes } from "@/lib/datos/caja";
import { firmarRutas } from "@/lib/datos/firmar";
import {
  armarPagos,
  edicionesHistorial,
  mesesMantenimiento,
  pagadoNeto,
  saldoPendiente,
  totalesRepuestos,
} from "@/lib/datos/mapeo";
import { cargarDetalleOrden, listarOrdenes } from "@/lib/datos/ordenes";
import { armarSeccionesPortal } from "@/lib/portal";
import type { OrdenPublica } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

// ---------------------------------------------------------------------
// Mapeos puros
// ---------------------------------------------------------------------
describe("mapeo", () => {
  it("mesesMantenimiento: solo 3, 6 y 12", () => {
    expect([3, 6, 12].map(mesesMantenimiento)).toEqual([3, 6, 12]);
    expect([mesesMantenimiento(5), mesesMantenimiento(null), mesesMantenimiento(undefined)]).toEqual([null, null, null]);
  });

  it("pagadoNeto y saldoPendiente: restan devoluciones, ignoran anulados y nunca bajan de 0", () => {
    const pagos = [
      { monto: 300000, es_devolucion: false, anulado: false },
      { monto: 50000, es_devolucion: true, anulado: false },
      { monto: 999999, es_devolucion: false, anulado: true },
    ];
    expect(pagadoNeto(pagos)).toBe(250000);
    expect(saldoPendiente(500000, pagos)).toBe(250000);
    expect(saldoPendiente(100000, pagos)).toBe(0); // pagó de más: no hay saldo negativo
    expect(saldoPendiente(0, [])).toBe(0);
  });

  it("totalesRepuestos: precio y costo redondeados", () => {
    const t = totalesRepuestos([
      { cantidad_usada: 2, costo_unitario: 10.005, precio_unitario: 20 },
      { cantidad_usada: 1.5, costo_unitario: 100, precio_unitario: 199.99 },
    ]);
    expect(t.precio).toBe(339.99);
    expect(t.costo).toBe(170.01);
  });

  it("edicionesHistorial: valida la forma del jsonb y descarta basura", () => {
    expect(edicionesHistorial(null)).toEqual([]);
    expect(edicionesHistorial("x")).toEqual([]);
    expect(
      edicionesHistorial([
        { at: "2026-09-30T10:00:00Z", por: "u1", autor: "Polo", antes: { monto: 5 } },
        { at: "2026-09-30T11:00:00Z", autor: "Hacker" },
        { sinFecha: true },
        "texto",
        null,
      ])
    ).toEqual([
      { at: "2026-09-30T10:00:00Z", por: "u1", autor: "Polo", antes: { monto: 5 } },
      { at: "2026-09-30T11:00:00Z", por: null, autor: null, antes: undefined },
    ]);
  });

  it("armarPagos: adjunta la URL firmada del comprobante (o null)", () => {
    const base = {
      fecha: "2026-09-30", monto: 1, medio: "efectivo" as const, es_devolucion: false, referencia: null,
      notas: null, autor: null, anulado: false, anulado_motivo: null,
    };
    const r = armarPagos(
      [
        { ...base, id: "a", comprobante_url: "pagos/a.webp" },
        { ...base, id: "b", comprobante_url: "pagos/b.webp" },
        { ...base, id: "c", comprobante_url: null },
      ],
      new Map([["pagos/a.webp", "https://firmada/a"]])
    );
    expect(r.map((p) => p.comprobanteUrl)).toEqual(["https://firmada/a", null, null]);
  });
});

// ---------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------
describe("armarSeccionesPortal", () => {
  const repuestos: OrdenPublica["repuestos"] = [
    { id: "r1", nombre: "Compresor", cantidad: 1, unidad: "unidad", precio_unitario: 1 },
    { id: "r2", nombre: "Filtro", cantidad: 1, unidad: "unidad", precio_unitario: 1 },
  ];
  const ev = (url: string, tipo: OrdenPublica["evidencias"][number]["tipo"], rep?: string): OrdenPublica["evidencias"][number] => ({
    url_imagen: url, tipo, notas: null, orden_repuesto_id: rep ?? null,
  });
  const urls = new Map(["i", "v1", "n1", "vs", "p", "rota"].filter((u) => u !== "rota").map((u) => [u, `https://f/${u}`]));

  it("ingreso, una sección por repuesto, sueltas y pruebas — en ese orden", () => {
    const s = armarSeccionesPortal(
      [ev("i", "ingreso"), ev("v1", "repuesto_viejo", "r1"), ev("n1", "repuesto_nuevo", "r1"), ev("vs", "repuesto_viejo"), ev("p", "prueba_tecnica")],
      repuestos, urls, "ABC123"
    );
    expect(s.map((x) => x.titulo)).toEqual(["Al ingreso", "Compresor", "Otros repuestos", "Pruebas técnicas"]);
    const comp = s[1];
    expect(comp.columnas.map((c) => c.fotos.length)).toEqual([1, 1]);
    expect(comp.columnas[0].fotos[0].alt).toBe("Retirado: Compresor · ABC123");
  });

  it("sin vínculos (antes de la fase 5) usa «Antes y después»; y omite fotos sin URL firmada", () => {
    const s = armarSeccionesPortal([ev("vs", "repuesto_viejo"), ev("rota", "repuesto_nuevo")], [], urls, "ABC123");
    expect(s.map((x) => x.titulo)).toEqual(["Antes y después"]);
    expect(s[0].columnas.map((c) => c.fotos.length)).toEqual([1, 0]);
    expect(armarSeccionesPortal([], [], urls, "X")).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Cargadores con un Supabase simulado
// ---------------------------------------------------------------------
type Respuesta = { data?: unknown; error?: { code?: string; message: string } | null };

function crearFalso(responder: (tabla: string, seleccion: string) => Respuesta, demoraMs = 0) {
  const eventos: string[] = [];
  const dormir = () => (demoraMs ? new Promise((r) => setTimeout(r, demoraMs)) : Promise.resolve());

  const constructor = (tabla: string) => {
    let seleccion = "";
    const resolver = async () => {
      eventos.push(`consulta:${tabla}`);
      await dormir();
      return responder(tabla, seleccion);
    };
    const b: Record<string, unknown> = {};
    for (const m of ["eq", "gt", "gte", "lt", "in", "or", "order", "limit"]) b[m] = () => b;
    b.select = (s: string) => {
      seleccion = s;
      return b;
    };
    b.maybeSingle = async () => {
      const r = await resolver();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : (r.data ?? null), error: r.error ?? null };
    };
    b.then = (ok: (v: unknown) => unknown, fallo: (e: unknown) => unknown) =>
      resolver().then((r) => ({ data: r.data ?? null, error: r.error ?? null, count: null }), fallo).then(ok, fallo);
    return b;
  };

  const cliente = {
    from: constructor,
    auth: { getUser: async () => ({ data: { user: { app_metadata: { rol: "admin" } } } }) },
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (rutas: string[]) => {
          eventos.push(`firma:${bucket}`);
          return { data: rutas.map((path) => ({ path, signedUrl: `https://firmada/${bucket}/${path}`, error: null })) };
        },
      }),
    },
  } as unknown as ClienteServidor;

  return { cliente, eventos };
}

const FILA_ORDEN = {
  id: "o1", estado: "en_proceso", total_cobrado: 500000, mano_obra: 200000, mantenimiento_meses: 6,
  notas: "30 sep 10:12 · Polo · Recibido → Diagnóstico", fecha_entrega: null, vehiculo_id: "v1",
  vehiculos: { placa: "ABC123", marca: "Chevrolet", modelo: "Spark", anio: 2018, tipo_gas_sugerido: null, carga_estandar_gramos: null, clientes: { nombre: "Ana", telefono: "+573001234567" } },
};
const CONTEXTO = { estado: "en_proceso", telefono: "+573001234567", urlPublica: "https://x/orden/t", mensajes: { recepcion: "a", listo: "b", entregado: "c" } } as const;

function datosDetalle(tabla: string, seleccion: string): Respuesta {
  switch (tabla) {
    case "ordenes_servicio":
      return { data: [FILA_ORDEN] };
    case "evidencias_fotograficas":
      return {
        data: [
          { id: "e1", tipo: "repuesto_viejo", notas: null, url_imagen: "o1/e1.webp", created_at: "2026-09-30T10:00:00Z", ...(seleccion.includes("orden_repuesto_id") ? { orden_repuesto_id: "lin1" } : {}) },
        ],
      };
    case "orden_repuestos":
      return { data: [{ id: "lin1", cantidad_usada: 1, costo_unitario: 100, precio_unitario: 200, inventario: { nombre: "Compresor", codigo: "C1", tipo_unidad: "unidad" } }] };
    case "pagos_orden":
      return {
        data: [
          { id: "p1", fecha: "2026-09-30", monto: 300000, medio: "efectivo", es_devolucion: false, referencia: null, notas: null, autor: "Polo", anulado: false, anulado_motivo: null, comprobante_url: "pagos/p1.webp" },
          { id: "p2", fecha: "2026-09-30", monto: 50000, medio: "transferencia", es_devolucion: true, referencia: null, notas: null, autor: null, anulado: false, anulado_motivo: null, comprobante_url: null },
          { id: "p3", fecha: "2026-09-29", monto: 999999, medio: "efectivo", es_devolucion: false, referencia: null, notas: null, autor: null, anulado: true, anulado_motivo: "error", comprobante_url: null },
        ],
      };
    default:
      return { data: [] };
  }
}

describe("cargarDetalleOrden", () => {
  it("arma el modelo completo de la pantalla", async () => {
    const { cliente } = crearFalso(datosDetalle);
    const d = await cargarDetalleOrden(cliente, "o1", async () => CONTEXTO);
    expect(d).not.toBeNull();
    expect(d!.orden.id).toBe("o1");
    expect(d!.saldoPendiente).toBe(250000); // 500.000 − (300.000 − 50.000); el anulado no cuenta
    expect(d!.pagos.map((p) => p.comprobanteUrl)).toEqual(["https://firmada/facturas-gastos/pagos/p1.webp", null, null]);
    expect(d!.evidencias[0]).toMatchObject({ url: "https://firmada/evidencias-ordenes/o1/e1.webp", orden_repuesto_id: "lin1" });
    expect(d!.lineas).toHaveLength(1);
    expect(d!.repuestosPrecio).toBe(200);
    expect(d!.repuestosCosto).toBe(100);
    expect(d!.historial).toHaveLength(1);
    expect(d!.esAdmin).toBe(true);
    expect(d!.bloqueada).toBe(false);
    expect(d!.contexto?.telefono).toBe("+573001234567");
  });

  it("devuelve null si la orden no existe", async () => {
    const { cliente } = crearFalso((t, s) => (t === "ordenes_servicio" ? { data: [] } : datosDetalle(t, s)));
    expect(await cargarDetalleOrden(cliente, "no-existe", async () => null)).toBeNull();
  });

  it("si falta la columna de la fase 5 reintenta sin ella y las fotos quedan «sin asignar»", async () => {
    const { cliente } = crearFalso((t, s) =>
      t === "evidencias_fotograficas" && s.includes("orden_repuesto_id")
        ? { error: { code: "42703", message: "column does not exist" } }
        : datosDetalle(t, s)
    );
    const d = await cargarDetalleOrden(cliente, "o1", async () => null);
    expect(d!.evidencias).toHaveLength(1);
    expect(d!.evidencias[0].orden_repuesto_id).toBeNull();
  });

  it("consulta todo a la vez y firma después, también a la vez (dos viajes, no seis)", async () => {
    const { cliente, eventos } = crearFalso(datosDetalle, 40);
    const inicio = Date.now();
    await cargarDetalleOrden(cliente, "o1", async () => {
      await new Promise((r) => setTimeout(r, 40));
      return null;
    });
    const duracion = Date.now() - inicio;
    // En serie serían ≥ 5 consultas × 40 ms + contexto ≈ 240 ms; en paralelo ≈ 40 ms + firmas.
    expect(duracion).toBeLessThan(160);
    const primeraFirma = eventos.findIndex((e) => e.startsWith("firma:"));
    expect(eventos.slice(0, primeraFirma).every((e) => e.startsWith("consulta:"))).toBe(true);
    expect(eventos.filter((e) => e.startsWith("firma:")).sort()).toEqual(["firma:evidencias-ordenes", "firma:facturas-gastos"]);
  });
});

describe("listarOrdenes", () => {
  it("devuelve las órdenes con el saldo de las que aún deben (sin cast)", async () => {
    const { cliente } = crearFalso((t) =>
      t === "ordenes_servicio"
        ? { data: [{ ...FILA_ORDEN, fecha_ingreso: "2026-09-28T15:00:00Z" }] }
        : t === "v_saldo_ordenes"
          ? { data: [{ orden_id: "o1", saldo: 250000 }, { orden_id: null, saldo: 5 }] }
          : { data: [] }
    );
    const r = await listarOrdenes(cliente, { q: "", estado: "en_proceso", limite: 50 });
    expect(r.error).toBeNull();
    expect(r.ordenes).toHaveLength(1);
    expect([...r.saldoDe]).toEqual([["o1", 250000]]);
  });

  it("propaga el mensaje de error de la consulta", async () => {
    const { cliente } = crearFalso((t) => (t === "ordenes_servicio" ? { error: { message: "boom" } } : { data: [] }));
    const r = await listarOrdenes(cliente, { q: "", limite: 50 });
    expect(r.error).toBe("boom");
    expect(r.ordenes).toEqual([]);
  });
});

describe("cargadores de caja", () => {
  it("cobros: totales por medio y detalle recortado", async () => {
    const pagos = Array.from({ length: 120 }, (_, i) => ({
      id: `p${i}`, orden_id: "o1", fecha: "2026-09-10", monto: 1000, medio: i % 2 ? "transferencia" : "efectivo",
      es_devolucion: false, referencia: null, anulado: false,
      ordenes_servicio: { vehiculos: { placa: "ABC123", clientes: { nombre: "Ana" } } },
    }));
    const { cliente } = crearFalso(() => ({ data: pagos }));
    const r = await cargarCobrosMes(cliente, "2026-09");
    expect(r.totales).toMatchObject({ efectivo: 60000, transferencia: 60000, total: 120000 });
    expect(r.cobros).toHaveLength(100);
    expect(r.cobros[0]).toMatchObject({ placa: "ABC123", cliente: "Ana" });
    expect(r.errorMigracion).toBe(false);
  });

  it("gastos: firma comprobantes, valida el historial y marca la migración ausente", async () => {
    const fila = {
      id: "g1", fecha: "2026-09-10", categoria: "flete_acarreo", descripcion: null, monto: 5000, comprobante_url: "2026-09/a.webp",
      autor: "Polo", orden_id: null, anulado: false, anulado_motivo: null, anulado_autor: null,
      historial: [{ at: "2026-09-11T00:00:00Z" }, "basura"], ordenes_servicio: null,
    };
    const ok = await cargarGastosMes(crearFalso(() => ({ data: [fila] })).cliente, "2026-09", { incluirAnulados: false, limite: 500 });
    expect(ok.gastos[0].comprobanteUrl).toBe("https://firmada/facturas-gastos/2026-09/a.webp");
    expect(ok.gastos[0].historial).toHaveLength(1);

    const sinMigrar = await cargarGastosMes(
      crearFalso(() => ({ error: { code: "42703", message: "x" } })).cliente, "2026-09", { incluirAnulados: true, limite: 500 }
    );
    expect(sinMigrar.errorMigracion).toBe(true);
  });

  it("balance: sin datos devuelve ceros y compara categorías con el mes anterior", async () => {
    const { cliente } = crearFalso((t) =>
      t === "gastos_caja_menor"
        ? { data: [{ fecha: "2026-09-05", categoria: "ayudante", monto: 100 }, { fecha: "2026-08-20", categoria: "ayudante", monto: 40 }] }
        : { data: [] }
    );
    const b = await cargarBalanceMes(cliente, "2026-09");
    expect(b.actual).toMatchObject({ mes: "2026-09", cobrado: 0, utilidadReal: 0 });
    expect(b.totalesActual.ayudante).toBe(100);
    expect(b.totalesAnterior.ayudante).toBe(40);
    expect(b.mesAnterior).toBe("2026-08");
    expect(b.porCobrar).toEqual({ total: 0, ordenes: 0 });
  });
});

describe("firmarRutas", () => {
  it("no llama a Storage sin rutas y firma cada ruta una sola vez", async () => {
    const { cliente, eventos } = crearFalso(() => ({ data: [] }));
    expect((await firmarRutas(cliente, "b", [], 60)).size).toBe(0);
    expect(eventos).toEqual([]);
    const m = await firmarRutas(cliente, "b", ["x", "x", "y"], 60);
    expect([...m.keys()]).toEqual(["x", "y"]);
    expect(eventos).toEqual(["firma:b"]);
  });
});
