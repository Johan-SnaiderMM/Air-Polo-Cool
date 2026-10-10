/**
 * Fase 14 sobre un Postgres real en memoria: la gasolina, el flete o el parqueadero se cargan a la orden como
 * «otros cargos»: se suman al total y al saldo por cobrar, su costo baja el margen y el portal del cliente los
 * muestra aparte (con su valor, sin el costo).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseSupabase } from "@/test/base-supabase";

let db: PGlite;
let orden: string;

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
const totalDe = async () =>
  Number((await una<{ t: string }>(`select total_cobrado as t from public.ordenes_servicio where id = $1`, [orden])).t);

const cargo = (nombre: string, costo: number, precio: number) =>
  una<{ id: string }>(
    `insert into public.orden_repuestos (orden_id, tipo, nombre, cantidad_usada, costo_unitario, precio_unitario)
     values ($1, 'cargo', $2, 1, $3, $4) returning id`,
    [orden, nombre, costo, precio]
  );

beforeAll(async () => {
  db = await crearBaseSupabase();
  await db.exec(`
    insert into public.clientes (nombre, telefono) values ('Ana Ruiz', '+573001112233');
    insert into public.vehiculos (cliente_id, placa, marca, modelo) select id, 'ABC123', 'Renault', 'Logan' from public.clientes;
    insert into public.ordenes_servicio (vehiculo_id, estado, mano_obra, total_cobrado)
      select id, 'en_proceso', 180000, 180000 from public.vehiculos;
  `);
  orden = (await una<{ id: string }>(`select id from public.ordenes_servicio`)).id;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("otros cargos de la orden", () => {
  it("la gasolina se suma al total y al saldo sin tocar el total a mano", async () => {
    await cargo("Gasolina", 40000, 50000);
    expect(await totalDe()).toBe(230000);
    const s = await una<{ saldo: string }>(`select saldo from public.v_saldo_ordenes where orden_id = $1`, [orden]);
    expect(Number(s.saldo)).toBe(230000);
  });

  it("su costo baja el margen y el balance como cualquier costo de la orden", async () => {
    const f = await una<{ costo_repuestos: string; margen_bruto: string }>(
      `select costo_repuestos, margen_bruto from public.v_finanzas_orden where orden_id = $1`,
      [orden]
    );
    expect(Number(f.costo_repuestos)).toBe(40000);
    expect(Number(f.margen_bruto)).toBe(190000); // 230.000 cobrado − 40.000 de gasolina
  });

  it("varios cargos se acumulan; quitar uno devuelve el total", async () => {
    const { id } = await cargo("Parqueadero", 0, 12000);
    expect(await totalDe()).toBe(242000);
    await db.query(`delete from public.orden_repuestos where id = $1`, [id]);
    expect(await totalDe()).toBe(230000);
  });

  it("un cargo no puede venir del inventario (no mueve stock) y su tipo debe ser válido", async () => {
    await db.exec(`insert into public.inventario (codigo, nombre, stock_actual, costo_compra, precio_venta) values ('X-1', 'Filtro', 5, 1, 2)`);
    const inv = (await una<{ id: string }>(`select id from public.inventario where codigo = 'X-1'`)).id;
    expect(
      await codigoDeError(
        db.query(`insert into public.orden_repuestos (orden_id, inventario_id, tipo, cantidad_usada) values ($1, $2, 'cargo', 1)`, [orden, inv])
      )
    ).toBe("23514");
    expect(
      await codigoDeError(
        db.query(`insert into public.orden_repuestos (orden_id, tipo, nombre, cantidad_usada, costo_unitario, precio_unitario) values ($1, 'regalo', 'x', 1, 1, 1)`, [orden])
      )
    ).toBe("23514");
  });

  it("las líneas anteriores a la fase 14 siguen siendo repuestos", async () => {
    await db.exec(`insert into public.inventario (codigo, nombre, stock_actual, costo_compra, precio_venta) values ('Y-1', 'Válvula', 5, 10, 20)`);
    await db.query(`insert into public.orden_repuestos (orden_id, inventario_id, cantidad_usada) select $1, id, 1 from public.inventario where codigo = 'Y-1'`, [orden]);
    const r = await una<{ tipo: string }>(`select tipo from public.orden_repuestos where inventario_id is not null`);
    expect(r.tipo).toBe("repuesto");
  });
});

describe("el portal del cliente", () => {
  it("marca cada línea como repuesto o cargo, con su valor y sin costos", async () => {
    const { token_publico } = await una<{ token_publico: string }>(`select token_publico from public.ordenes_servicio where id = $1`, [orden]);
    const r = await una<{ p: { repuestos: { tipo: string; nombre: string; precio_unitario: number }[] } }>(
      `select public.obtener_orden_publica($1) as p`,
      [token_publico]
    );
    const gasolina = r.p.repuestos.find((x) => x.nombre === "Gasolina");
    expect(gasolina).toMatchObject({ tipo: "cargo", precio_unitario: 50000 });
    expect(r.p.repuestos.find((x) => x.nombre === "Válvula")).toMatchObject({ tipo: "repuesto" });
    const texto = JSON.stringify(r.p);
    expect(texto).not.toContain("40000");
    expect(texto).not.toMatch(/costo/i);
  });
});
