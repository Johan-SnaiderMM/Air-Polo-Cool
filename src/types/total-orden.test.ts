/**
 * Fase 13 sobre un Postgres real en memoria: una orden con solo mano de obra no se queda en $0, y el total sigue a
 * la mano de obra mientras estaba al día (sin pisar un total escrito a mano).
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { crearBaseSupabase, DIR_MIGRACIONES, MIGRACIONES } from "@/test/base-supabase";

const FASE13 = MIGRACIONES.find((f) => f.includes("fase13"))!;
let db: PGlite;
let secuencia = 0;

async function orden(manoObra: number | null, total: number | null, estado = "en_proceso", base: PGlite = db): Promise<string> {
  secuencia += 1;
  const placa = `TOT${String(secuencia).padStart(3, "0")}`;
  await base.query(`insert into public.vehiculos (cliente_id, placa, marca, modelo) select id, $1, 'Renault', 'Logan' from public.clientes limit 1`, [placa]);
  const r = await base.query<{ id: string }>(
    `insert into public.ordenes_servicio (vehiculo_id, estado, mano_obra, total_cobrado)
     select id, $2, coalesce($3::numeric, 0), coalesce($4::numeric, 0) from public.vehiculos where placa = $1 returning id`,
    [placa, estado, manoObra, total]
  );
  return r.rows[0].id;
}
const total = async (id: string, base: PGlite = db) =>
  Number((await base.query<{ t: string }>(`select total_cobrado as t from public.ordenes_servicio where id = $1`, [id])).rows[0].t);

beforeAll(async () => {
  db = await crearBaseSupabase();
  await db.exec(`insert into public.clientes (nombre, telefono) values ('Ana Ruiz', '+573001112233')`);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("total por defecto", () => {
  it("el caso del bug: solo mano de obra y total en 0 → el total es la mano de obra", async () => {
    expect(await total(await orden(180000, 0))).toBe(180000);
  });

  it("sin mano de obra ni total sigue en 0; un total escrito a mano se respeta", async () => {
    expect(await total(await orden(0, 0))).toBe(0);
    expect(await total(await orden(180000, 500000))).toBe(500000);
    expect(await total(await orden(180000, 150000))).toBe(150000);
  });

  it("al editar una orden dejando el total en 0, se cobra la mano de obra más los repuestos", async () => {
    const id = await orden(0, 0);
    await db.exec(`insert into public.inventario (codigo, nombre, stock_actual, costo_compra, precio_venta) values ('R-1', 'Filtro', 5, 10000, 25000)`);
    await db.query(`insert into public.orden_repuestos (orden_id, inventario_id, cantidad_usada) select $1, id, 2 from public.inventario where codigo = 'R-1'`, [id]);
    await db.query(`update public.ordenes_servicio set mano_obra = 100000, total_cobrado = 0 where id = $1`, [id]);
    expect(await total(id)).toBe(150000); // 100.000 + 2 × 25.000
  });
});

describe("el total sigue a la mano de obra si estaba al día", () => {
  it("cambiar solo la mano de obra mueve el total", async () => {
    const id = await orden(180000, 180000);
    await db.query(`update public.ordenes_servicio set mano_obra = 200000 where id = $1`, [id]);
    expect(await total(id)).toBe(200000);
  });

  it("el formulario reenvía el total sin cambios: también lo sigue", async () => {
    const id = await orden(180000, 180000);
    await db.query(`update public.ordenes_servicio set mano_obra = 220000, total_cobrado = 180000 where id = $1`, [id]);
    expect(await total(id)).toBe(220000);
  });

  it("un total distinto a propósito no se pisa (descuento, o total cambiado en la misma edición)", async () => {
    const conDescuento = await orden(180000, 150000);
    await db.query(`update public.ordenes_servicio set mano_obra = 200000 where id = $1`, [conDescuento]);
    expect(await total(conDescuento)).toBe(150000);

    const alDia = await orden(180000, 180000);
    await db.query(`update public.ordenes_servicio set mano_obra = 200000, total_cobrado = 190000 where id = $1`, [alDia]);
    expect(await total(alDia)).toBe(190000);
  });

  it("cambiar el estado no altera el total", async () => {
    const id = await orden(180000, 150000);
    await db.query(`update public.ordenes_servicio set estado = 'listo' where id = $1`, [id]);
    expect(await total(id)).toBe(150000);
  });
});

describe("migración sobre datos existentes", () => {
  it("arregla las órdenes abiertas en $0 con mano de obra y no toca las entregadas ni las canceladas", async () => {
    const antes = MIGRACIONES.filter((f) => f !== FASE13 && !MIGRACIONES.slice(MIGRACIONES.indexOf(FASE13)).includes(f));
    const viejo = await crearBaseSupabase(antes);
    try {
      await viejo.exec(`insert into public.clientes (nombre, telefono) values ('Ana Ruiz', '+573001112233')`);
      const abierta = await orden(180000, 0, "en_proceso", viejo);
      const entregada = await orden(180000, 0, "entregado", viejo);
      const cancelada = await orden(180000, 0, "cancelado", viejo);
      expect(await total(abierta, viejo)).toBe(0); // el bug, antes de la migración
      await viejo.exec(fs.readFileSync(path.join(DIR_MIGRACIONES, FASE13), "utf8"));
      expect(await total(abierta, viejo)).toBe(180000);
      expect(await total(entregada, viejo)).toBe(0);
      expect(await total(cancelada, viejo)).toBe(0);
    } finally {
      await viejo.close();
    }
  }, 120_000); // arma una segunda base con todas las migraciones: tarda varios segundos
});
