import { describe, expect, it } from "vitest";
import type { Operacion } from "@/lib/offline/operaciones";
import { ejecutarOperacion } from "@/lib/servidor/operaciones";
import { crearSupabaseFalso, type Llamada, type Respuesta } from "@/test/supabase-falso";

/**
 * Escritura real de lo que se hace sin conexión: gastos, pagos, fotos y órdenes. Se comprueba que
 * cada operación es IDEMPOTENTE (reenviar no duplica), que los errores permanentes se distinguen de
 * los transitorios (los transitorios se reintentan) y que no quedan archivos huérfanos en Storage.
 */
const ID = "123e4567-e89b-12d3-a456-426614174000";
const ORDEN = "223e4567-e89b-12d3-a456-426614174000";
const LINEA = "323e4567-e89b-12d3-a456-426614174000";

const imagen = (tipo = "image/webp", bytes = 10) => new File([new Uint8Array(bytes)], "f", { type: tipo });

function ejecutar(op: Operacion, archivo: File | null, responder?: (l: Llamada) => Respuesta | undefined, errorSubida?: { message: string }) {
  const f = crearSupabaseFalso({ responder, errorSubida });
  return ejecutarOperacion(f.cliente as never, op, archivo).then((r) => ({ r, f }));
}

const gasto = (conArchivo = false): Operacion => ({
  tipo: "gasto.crear",
  conArchivo,
  extension: "webp",
  datos: { id: ID, fecha: "2026-09-29", monto: 15000, categoria: "alimentacion_refrigerio", descripcion: "Almuerzo", orden_id: null, autor: "Polo" },
});
const pago = (extra: { es_devolucion?: boolean } = {}, conArchivo = false): Operacion => ({
  tipo: "pago.crear",
  conArchivo,
  datos: { id: ID, orden_id: ORDEN, fecha: "2026-09-29", monto: 80000, medio: "transferencia", es_devolucion: extra.es_devolucion ?? false, referencia: "ABC", notas: null, autor: "Soporte técnico" },
});

describe("gasto.crear", () => {
  it("inserta el gasto con su id (clave de idempotencia) y sin comprobante", async () => {
    const { r, f } = await ejecutar(gasto(), null);
    expect(r).toEqual({ ok: true });
    expect(f.de("insert", "gastos_caja_menor")[0].payload).toEqual({
      id: ID, fecha: "2026-09-29", categoria: "alimentacion_refrigerio", monto: 15000,
      descripcion: "Almuerzo", orden_id: null, autor: "Polo", comprobante_url: null,
    });
    expect(f.subidas).toHaveLength(0);
  });

  it("con recibo: lo sube al bucket de facturas en <aaaa-mm>/<id>.<ext> y guarda la ruta", async () => {
    const { r, f } = await ejecutar(gasto(true), imagen("image/webp"));
    expect(r).toEqual({ ok: true });
    expect(f.subidas).toEqual([{ bucket: "facturas-gastos", ruta: `2026-09/${ID}.webp`, tipo: "image/webp" }]);
    expect(f.de("insert", "gastos_caja_menor")[0].payload).toMatchObject({ comprobante_url: `2026-09/${ID}.webp` });
  });

  it("rechaza imágenes ausentes, de formato no permitido o de más de 3 MB (errores permanentes)", async () => {
    for (const [archivo, texto] of [
      [null, "Falta la imagen"],
      [imagen("image/png"), "Formato de imagen no permitido"],
      [imagen("image/webp", 3 * 1024 * 1024 + 1), "supera los 3 MB"],
    ] as const) {
      const { r, f } = await ejecutar(gasto(true), archivo);
      expect(r).toMatchObject({ ok: false, permanente: true, error: expect.stringContaining(texto) });
      expect(f.llamadas).toHaveLength(0);
    }
  });

  it("si falla la subida es transitorio (se reintenta) y no inserta nada", async () => {
    const { r, f } = await ejecutar(gasto(true), imagen(), undefined, { message: "timeout" });
    expect(r).toMatchObject({ ok: false, permanente: false, error: expect.stringContaining("No se pudo subir el recibo") });
    expect(f.de("insert")).toHaveLength(0);
  });

  it("reenviar un gasto que ya existe es éxito (duplicado), no error ni segundo registro", async () => {
    const { r, f } = await ejecutar(gasto(true), imagen(), (l) => (l.op === "insert" ? { error: { code: "23505", message: "duplicate key" } } : undefined));
    expect(r).toEqual({ ok: true, duplicado: true });
    expect(f.borrados).toHaveLength(0); // el recibo ya subido es el del registro original
  });

  it("orden asociada inexistente: error permanente y se retira el recibo subido", async () => {
    const { r, f } = await ejecutar(gasto(true), imagen(), (l) => (l.op === "insert" ? { error: { code: "23503", message: "fk" } } : undefined));
    expect(r).toEqual({ ok: false, error: "La orden asociada ya no existe.", permanente: true });
    expect(f.borrados).toEqual([{ bucket: "facturas-gastos", rutas: [`2026-09/${ID}.webp`] }]);
  });

  it("errores de conexión (08…) y de recursos (53…) se reintentan; los de reglas no", async () => {
    const con = (code: string) => ejecutar(gasto(), null, (l) => (l.op === "insert" ? { error: { code, message: "x" } } : undefined));
    expect((await con("08006")).r).toMatchObject({ ok: false, permanente: false });
    expect((await con("53300")).r).toMatchObject({ ok: false, permanente: false });
    expect((await con("57014")).r).toMatchObject({ ok: false, permanente: false });
    expect((await con("23514")).r).toMatchObject({ ok: false, permanente: true });
  });
});

describe("pago.crear", () => {
  it("inserta el abono con su id; devoluciones y abonos se distinguen por es_devolucion", async () => {
    const { r, f } = await ejecutar(pago({ es_devolucion: true }), null);
    expect(r).toEqual({ ok: true });
    expect(f.de("insert", "pagos_orden")[0].payload).toEqual({
      id: ID, orden_id: ORDEN, fecha: "2026-09-29", monto: 80000, medio: "transferencia",
      es_devolucion: true, referencia: "ABC", notas: null, autor: "Soporte técnico", comprobante_url: null,
    });
  });

  it("con comprobante: pagos/<aaaa-mm>/<id>.jpg en el bucket de facturas", async () => {
    const { r, f } = await ejecutar(pago({}, true), imagen("image/jpeg"));
    expect(r).toEqual({ ok: true });
    expect(f.subidas[0]).toMatchObject({ bucket: "facturas-gastos", ruta: `pagos/2026-09/${ID}.jpg` });
  });

  it("duplicado = éxito; orden inexistente = permanente y sin archivo huérfano", async () => {
    const dup = await ejecutar(pago({}, true), imagen(), (l) => (l.op === "insert" ? { error: { code: "23505", message: "d" } } : undefined));
    expect(dup.r).toEqual({ ok: true, duplicado: true });
    const fk = await ejecutar(pago({}, true), imagen(), (l) => (l.op === "insert" ? { error: { code: "23503", message: "fk" } } : undefined));
    expect(fk.r).toEqual({ ok: false, error: "La orden de este pago ya no existe.", permanente: true });
    expect(fk.f.borrados).toHaveLength(1);
  });
});

describe("evidencia.subir", () => {
  const evidencia = (repuesto: string | null = null): Operacion => ({
    tipo: "evidencia.subir",
    conArchivo: true,
    datos: { id: ID, orden_id: ORDEN, tipo: "repuesto_viejo", extension: "webp", notas: null, orden_repuesto_id: repuesto },
  });

  it("sube a <orden>/<id>.<ext> y liga la foto al repuesto si este sigue en la orden", async () => {
    const { r, f } = await ejecutar(evidencia(LINEA), imagen(), (l) => (l.tabla === "orden_repuestos" ? { data: [{ id: LINEA }] } : undefined));
    expect(r).toEqual({ ok: true });
    expect(f.subidas[0]).toMatchObject({ bucket: "evidencias-ordenes", ruta: `${ORDEN}/${ID}.webp` });
    expect(f.de("insert", "evidencias_fotograficas")[0].payload).toMatchObject({ orden_repuesto_id: LINEA, tipo: "repuesto_viejo" });
    // La comprobación del repuesto se limita a LA MISMA orden.
    expect(f.de("select", "orden_repuestos")[0].filtros).toContainEqual({ col: "orden_id", op: "eq", valor: ORDEN });
  });

  it("si el repuesto ya no está en la orden, la foto se guarda igual, sin vínculo", async () => {
    const { r, f } = await ejecutar(evidencia(LINEA), imagen(), (l) => (l.tabla === "orden_repuestos" ? { data: [] } : undefined));
    expect(r).toEqual({ ok: true });
    expect(Object.keys(f.de("insert", "evidencias_fotograficas")[0].payload as object)).not.toContain("orden_repuesto_id");
  });

  it("si aún no se ejecutó la migración de la fase 5, reintenta sin la columna y conserva la foto", async () => {
    let intentos = 0;
    const { r, f } = await ejecutar(evidencia(LINEA), imagen(), (l) => {
      if (l.tabla === "orden_repuestos") return { data: [{ id: LINEA }] };
      if (l.op === "insert" && intentos++ === 0) return { error: { code: "42703", message: "column does not exist" } };
      return undefined;
    });
    expect(r).toEqual({ ok: true });
    const inserts = f.de("insert", "evidencias_fotograficas");
    expect(inserts).toHaveLength(2);
    expect(Object.keys(inserts[1].payload as object)).not.toContain("orden_repuesto_id");
    expect(f.borrados).toHaveLength(0);
  });

  it("orden inexistente: error permanente y se retira el archivo subido", async () => {
    const { r, f } = await ejecutar(evidencia(), imagen(), (l) => (l.op === "insert" ? { error: { code: "23503", message: "fk" } } : undefined));
    expect(r).toMatchObject({ ok: false, permanente: true, error: expect.stringContaining("no existe") });
    expect(f.borrados).toEqual([{ bucket: "evidencias-ordenes", rutas: [`${ORDEN}/${ID}.webp`] }]);
  });

  it("duplicado = éxito", async () => {
    const { r } = await ejecutar(evidencia(), imagen(), (l) => (l.op === "insert" ? { error: { code: "23505", message: "d" } } : undefined));
    expect(r).toEqual({ ok: true, duplicado: true });
  });
});

describe("orden.crear", () => {
  const orden = (vehiculo: Extract<Operacion, { tipo: "orden.crear" }>["datos"]["vehiculo"]): Operacion => ({
    tipo: "orden.crear",
    datos: {
      id: ORDEN, vehiculo, kilometraje: 85000, diagnostico_inicial: "Fuga", trabajos_a_realizar: null, mano_obra: 200000,
      total_cobrado: 450000, dias_garantia: 90, estado: "recibido",
      pertenencias: { carroceria: "sin_danos", llanta_repuesto: true, herramientas: false, documentos: false, objetos_valor: "", notas: "" },
      mantenimiento_meses: null, autor: "Polo",
    },
  });
  const nuevoVehiculo = {
    nuevo: true as const, id: ID, cliente_id: LINEA, cliente_nombre: "Ana", cliente_telefono: "+573001234567",
    placa: "ABC123", marca: "Chevrolet", modelo: "Spark", anio: 2018,
  };
  const sin = (...tablas: string[]) => (l: Llamada): Respuesta | undefined => (l.op === "select" && tablas.includes(l.tabla ?? "") ? { data: [] } : undefined);

  it("una orden que ya existe es éxito (duplicado) y no toca nada más", async () => {
    const { r, f } = await ejecutar(orden({ nuevo: false, id: ID }), null, (l) => (l.tabla === "ordenes_servicio" ? { data: [{ id: ORDEN }] } : undefined));
    expect(r).toEqual({ ok: true, duplicado: true });
    expect(f.de("insert")).toHaveLength(0);
  });

  it("vehículo existente: crea solo la orden", async () => {
    const { r, f } = await ejecutar(orden({ nuevo: false, id: ID }), null, (l) =>
      l.tabla === "vehiculos" ? { data: [{ id: ID }] } : l.tabla === "ordenes_servicio" && l.op === "select" ? { data: [] } : undefined
    );
    expect(r).toEqual({ ok: true });
    expect(f.de("insert").map((l) => l.tabla)).toEqual(["ordenes_servicio"]);
    expect(f.de("insert", "ordenes_servicio")[0].payload).toMatchObject({ id: ORDEN, vehiculo_id: ID, estado: "recibido", autor: "Polo" });
  });

  it("vehículo que ya no existe: error permanente", async () => {
    const { r } = await ejecutar(orden({ nuevo: false, id: ID }), null, sin("ordenes_servicio", "vehiculos"));
    expect(r).toEqual({ ok: false, error: "El vehículo ya no existe.", permanente: true });
  });

  it("cliente y vehículo nuevos: crea cliente, vehículo y orden, con placa y teléfono normalizados", async () => {
    const { r, f } = await ejecutar(orden(nuevoVehiculo), null, sin("ordenes_servicio", "vehiculos", "clientes"));
    expect(r).toEqual({ ok: true });
    expect(f.de("insert").map((l) => l.tabla)).toEqual(["clientes", "vehiculos", "ordenes_servicio"]);
    expect(f.de("insert", "clientes")[0].payload).toEqual({ id: LINEA, nombre: "Ana", telefono: "+573001234567" });
    expect(f.de("insert", "vehiculos")[0].payload).toMatchObject({ id: ID, cliente_id: LINEA, placa: "ABC123" });
  });

  it("si el teléfono ya es de un cliente, el vehículo nuevo se asocia a ese cliente (sin duplicarlo)", async () => {
    const { r, f } = await ejecutar(orden(nuevoVehiculo), null, (l) => {
      if (l.tabla === "clientes" && l.op === "select") {
        return l.filtros.some((x) => x.col === "telefono") ? { data: [{ id: "cliente-existente" }] } : { data: [] };
      }
      return sin("ordenes_servicio", "vehiculos")(l);
    });
    expect(r).toEqual({ ok: true });
    expect(f.de("insert", "clientes")).toHaveLength(0);
    expect(f.de("insert", "vehiculos")[0].payload).toMatchObject({ cliente_id: "cliente-existente" });
  });

  it("placa ya registrada: error permanente con la indicación de qué hacer", async () => {
    const { r } = await ejecutar(orden(nuevoVehiculo), null, (l) =>
      l.tabla === "vehiculos" && l.filtros.some((x) => x.col === "placa") ? { data: [{ id: "otro" }] } : sin("ordenes_servicio", "vehiculos")(l)
    );
    expect(r).toMatchObject({ ok: false, permanente: true, error: expect.stringContaining("ABC123 ya está registrada") });
  });

  it("un reintento tras un corte reutiliza el vehículo ya creado (idempotencia)", async () => {
    const { r, f } = await ejecutar(orden(nuevoVehiculo), null, (l) =>
      l.tabla === "vehiculos" && l.filtros.some((x) => x.col === "id") ? { data: [{ id: ID }] } : sin("ordenes_servicio")(l)
    );
    expect(r).toEqual({ ok: true });
    expect(f.de("insert").map((l) => l.tabla)).toEqual(["ordenes_servicio"]);
  });

  it("revalida los datos del vehículo nuevo en el servidor (no confía en la cola)", async () => {
    for (const cambio of [{ placa: "AB" }, { cliente_telefono: "123" }, { marca: "" }, { anio: 1900 }, { cliente_nombre: "" }]) {
      const { r, f } = await ejecutar(orden({ ...nuevoVehiculo, ...cambio }), null, sin("ordenes_servicio"));
      expect(r, JSON.stringify(cambio)).toMatchObject({ ok: false, permanente: true });
      expect(f.de("insert"), JSON.stringify(cambio)).toHaveLength(0);
    }
  });
});
