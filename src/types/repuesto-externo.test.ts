/**
 * Fase 12 sobre un Postgres real en memoria: un repuesto comprado para el trabajo (sin inventario) se cobra al
 * cliente sin tocar el total a mano, baja el margen con su costo y no mueve stock; y el total solo sigue a los
 * repuestos cuando estaba al día (un descuento o un total pactado a mano no se pisa).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseSupabase } from "@/test/base-supabase";

let db: PGlite;

async function una<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
const codigoDeError = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

/** Crea una orden nueva con esa mano de obra y ese total; devuelve su id. */
let secuencia = 0;
async function nuevaOrden(manoObra: number, total: number): Promise<string> {
  secuencia += 1;
  const placa = `TST${String(secuencia).padStart(3, "0")}`;
  await db.query(
    `insert into public.vehiculos (cliente_id, placa, marca, modelo) select id, $1, 'Chevrolet', 'Spark' from public.clientes limit 1`,
    [placa]
  );
  const { id } = await una<{ id: string }>(
    `insert into public.ordenes_servicio (vehiculo_id, estado, mano_obra, total_cobrado)
     select id, 'en_proceso', $2, $3 from public.vehiculos where placa = $1 returning id`,
    [placa, manoObra, total]
  );
  return id;
}
const totalDe = async (orden: string) =>
  Number((await una<{ total_cobrado: string }>(`select total_cobrado from public.ordenes_servicio where id = $1`, [orden])).total_cobrado);

const agregarExterno = (orden: string, nombre: string, costo: number, precio: number) =>
  una<{ id: string }>(
    `insert into public.orden_repuestos (orden_id, nombre, cantidad_usada, costo_unitario, precio_unitario)
     values ($1, $2, 1, $3, $4) returning id`,
    [orden, nombre, costo, precio]
  );

beforeAll(async () => {
  db = await crearBaseSupabase();
  await db.exec(`
    insert into public.clientes (nombre, telefono) values ('Ana Ruiz', '+573001112233');
    insert into public.inventario (codigo, nombre, stock_actual, costo_compra, precio_venta)
      values ('FIL-1', 'Filtro', 10, 20000, 35000);
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("el repuesto comprado para el trabajo se cobra al cliente", () => {
  it("el caso real: mano de obra 180.000 + compresor 480.000 → el total pasa a 660.000 sin tocarlo a mano", async () => {
    const orden = await nuevaOrden(180000, 180000);
    await agregarExterno(orden, "Compresor", 480000, 480000);
    expect(await totalDe(orden)).toBe(660000);
    const f = await una<{ margen_bruto: string; costo_repuestos: string }>(
      `select margen_bruto, costo_repuestos from public.v_finanzas_orden where orden_id = $1`,
      [orden]
    );
    expect(Number(f.costo_repuestos)).toBe(480000);
    expect(Number(f.margen_bruto)).toBe(180000); // la mano de obra: ya no es -300.000
  });

  it("con ganancia: costo 480.000, precio 600.000 → total 780.000 y margen 300.000", async () => {
    const orden = await nuevaOrden(180000, 180000);
    await agregarExterno(orden, "Compresor", 480000, 600000);
    expect(await totalDe(orden)).toBe(780000);
    const f = await una<{ margen_bruto: string }>(`select margen_bruto from public.v_finanzas_orden where orden_id = $1`, [orden]);
    expect(Number(f.margen_bruto)).toBe(300000);
  });

  it("aparece en el saldo por cobrar: el cliente debe el total nuevo", async () => {
    const orden = await nuevaOrden(180000, 180000);
    await agregarExterno(orden, "Compresor", 480000, 480000);
    const s = await una<{ saldo: string }>(`select saldo from public.v_saldo_ordenes where orden_id = $1`, [orden]);
    expect(Number(s.saldo)).toBe(660000);
  });

  it("quitar la línea devuelve el total (mientras estuviera al día)", async () => {
    const orden = await nuevaOrden(180000, 180000);
    const { id } = await agregarExterno(orden, "Compresor", 480000, 480000);
    expect(await totalDe(orden)).toBe(660000);
    await db.query(`delete from public.orden_repuestos where id = $1`, [id]);
    expect(await totalDe(orden)).toBe(180000);
  });

  it("cambiar el precio de la línea corrige el total", async () => {
    const orden = await nuevaOrden(100000, 100000);
    const { id } = await agregarExterno(orden, "Válvula", 50000, 50000);
    await db.query(`update public.orden_repuestos set precio_unitario = 70000 where id = $1`, [id]);
    expect(await totalDe(orden)).toBe(170000);
  });
});

describe("el total a mano no se pisa", () => {
  it("un descuento o un total pactado distinto de «mano de obra + repuestos» queda como está", async () => {
    const orden = await nuevaOrden(180000, 150000); // descuento de 30.000
    await agregarExterno(orden, "Compresor", 480000, 480000);
    expect(await totalDe(orden)).toBe(150000);
  });

  it("si el total ya incluía el repuesto (cotización) y la línea suma lo mismo, queda igual", async () => {
    const orden = await nuevaOrden(180000, 660000);
    await agregarExterno(orden, "Compresor", 480000, 480000);
    expect(await totalDe(orden)).toBe(660000);
  });

  it("una línea con precio 0 (ya incluida en el total) no cambia nada, pero su costo sí cuenta", async () => {
    const orden = await nuevaOrden(180000, 180000);
    await agregarExterno(orden, "Compresor", 480000, 0);
    expect(await totalDe(orden)).toBe(180000);
    const f = await una<{ costo_repuestos: string }>(`select costo_repuestos from public.v_finanzas_orden where orden_id = $1`, [orden]);
    expect(Number(f.costo_repuestos)).toBe(480000);
  });
});

describe("no mueve stock y convive con los repuestos de inventario", () => {
  it("una línea de inventario sigue descontando stock y sumando su precio al total; la externa no toca stock", async () => {
    const orden = await nuevaOrden(100000, 100000);
    await db.query(
      `insert into public.orden_repuestos (orden_id, inventario_id, cantidad_usada) select $1, id, 2 from public.inventario where codigo = 'FIL-1'`,
      [orden]
    );
    expect(await totalDe(orden)).toBe(170000); // 100.000 + 2 × 35.000
    await agregarExterno(orden, "Compresor", 480000, 480000);
    expect(await totalDe(orden)).toBe(650000);
    const stock = await una<{ stock_actual: string }>(`select stock_actual from public.inventario where codigo = 'FIL-1'`);
    expect(Number(stock.stock_actual)).toBe(8); // solo las 2 del filtro
  });

  it("cada línea necesita inventario o nombre", async () => {
    const orden = await nuevaOrden(1000, 1000);
    expect(
      await codigoDeError(
        db.query(`insert into public.orden_repuestos (orden_id, cantidad_usada, costo_unitario, precio_unitario) values ($1, 1, 5, 5)`, [orden])
      )
    ).toBe("23514");
    expect(
      await codigoDeError(
        db.query(
          `insert into public.orden_repuestos (orden_id, nombre, cantidad_usada, costo_unitario, precio_unitario) values ($1, '  ', 1, 5, 5)`,
          [orden]
        )
      )
    ).toBe("23514");
  });

  it("una orden entregada no admite repuestos nuevos (ni externos)", async () => {
    const orden = await nuevaOrden(1000, 1000);
    await db.query(`update public.ordenes_servicio set estado = 'entregado', fecha_entrega = now() where id = $1`, [orden]);
    expect(await codigoDeError(agregarExterno(orden, "Tarde", 100, 100))).toBe("23514");
  });

  it("borrar la orden borra sus repuestos sin errores (cascada)", async () => {
    const orden = await nuevaOrden(1000, 1000);
    await agregarExterno(orden, "Tubo", 100, 100);
    await db.query(`delete from public.ordenes_servicio where id = $1`, [orden]);
    const n = await una<{ n: number }>(`select count(*)::int as n from public.orden_repuestos where orden_id = $1`, [orden]);
    expect(n.n).toBe(0);
  });
});

describe("el portal del cliente", () => {
  it("lista el repuesto con su nombre y precio de venta, y nunca el costo", async () => {
    const orden = await nuevaOrden(180000, 180000);
    await agregarExterno(orden, "Compresor Denso", 480123, 512345);
    const { token_publico } = await una<{ token_publico: string }>(`select token_publico from public.ordenes_servicio where id = $1`, [orden]);
    const r = await una<{ p: { repuestos: { nombre: string; precio_unitario: number; unidad: string }[] } }>(
      `select public.obtener_orden_publica($1) as p`,
      [token_publico]
    );
    expect(r.p.repuestos).toEqual([expect.objectContaining({ nombre: "Compresor Denso", precio_unitario: 512345, unidad: "unidad" })]);
    const texto = JSON.stringify(r.p);
    expect(texto).not.toContain("480123");
    expect(texto).not.toMatch(/costo/i);
  });
});
