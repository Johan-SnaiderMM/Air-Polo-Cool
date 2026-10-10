/**
 * Fase 11 sobre un Postgres real en memoria: el costo del repuesto que se pide al subir la foto queda como un
 * egreso (gasto «repuesto») ligado a la orden, descuenta del balance y de la rentabilidad de esa orden, y el
 * portal público del cliente no lo muestra nunca.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseSupabase } from "@/test/base-supabase";

let db: PGlite;
let ordenId: string;
let token: string;

async function una<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}

const COSTO_APARTE = 73123;
const COSTO_LINEA = 41007;
const PRECIO_LINEA = 99991;

beforeAll(async () => {
  db = await crearBaseSupabase();
  await db.exec(`
    insert into public.clientes (nombre, telefono) values ('Ana Ruiz', '+573001112233');
    insert into public.vehiculos (cliente_id, placa, marca, modelo)
      select id, 'ABC123', 'Chevrolet', 'Spark' from public.clientes;
    insert into public.ordenes_servicio (vehiculo_id, estado, mano_obra, total_cobrado)
      select id, 'en_proceso', 200000, 500000 from public.vehiculos;
    insert into public.inventario (codigo, nombre, stock_actual, costo_compra, precio_venta)
      values ('FIL-1', 'Filtro', 10, ${COSTO_LINEA}, ${PRECIO_LINEA});
  `);
  ordenId = (await una<{ id: string }>(`select id from public.ordenes_servicio`)).id;
  token = (await una<{ token_publico: string }>(`select token_publico from public.ordenes_servicio`)).token_publico;
  await db.query(`insert into public.orden_repuestos (orden_id, inventario_id, cantidad_usada) select $1, id, 1 from public.inventario`, [ordenId]);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("el costo del repuesto como egreso de la orden", () => {
  it("la categoría «repuesto» existe y un gasto con ese valor se liga a la orden", async () => {
    await db.query(
      `insert into public.gastos_caja_menor (categoria, monto, descripcion, orden_id) values ('repuesto', $1, 'Repuesto instalado: Compresor', $2)`,
      [COSTO_APARTE, ordenId]
    );
    const g = await una<{ categoria: string; orden_id: string }>(`select categoria, orden_id from public.gastos_caja_menor`);
    expect(g).toEqual({ categoria: "repuesto", orden_id: ordenId });
  });

  it("descuenta de la rentabilidad de la orden junto con el costo de sus líneas de inventario", async () => {
    const r = await una<{ costo_repuestos: string; gastos_directos: string; utilidad_facturada: string }>(
      `select costo_repuestos, gastos_directos, utilidad_facturada from public.v_rentabilidad_orden where orden_id = $1`,
      [ordenId]
    );
    expect(Number(r.costo_repuestos)).toBe(COSTO_LINEA);
    expect(Number(r.gastos_directos)).toBe(COSTO_APARTE);
    expect(Number(r.utilidad_facturada)).toBe(500000 - COSTO_LINEA - COSTO_APARTE);
  });

  it("entra al balance del mes como egreso y baja la utilidad (no figura como ganancia)", async () => {
    await db.exec(`update public.ordenes_servicio set estado = 'entregado', fecha_entrega = now()`);
    const b = await una<{ costo_repuestos: string; gastos: string }>(`select costo_repuestos, gastos from public.v_balance_real`);
    expect(Number(b.gastos)).toBe(COSTO_APARTE);
    expect(Number(b.costo_repuestos)).toBe(COSTO_LINEA);
    const m = await una<{ gastos_caja_menor: string; utilidad_real: string }>(
      `select gastos_caja_menor, utilidad_real from public.v_balance_mensual`
    );
    expect(Number(m.gastos_caja_menor)).toBe(COSTO_APARTE);
    expect(Number(m.utilidad_real)).toBe(500000 - COSTO_LINEA - COSTO_APARTE);
  });

  it("anular el egreso lo saca de la rentabilidad y del balance (queda el motivo)", async () => {
    const { id } = await una<{ id: string }>(`select id from public.gastos_caja_menor`);
    // Anular exige una sesión de staff: se hace como un operario real (JWT + rol `authenticated`).
    const OPERARIO = "11111111-1111-4111-8111-111111111111";
    await db.query(`insert into auth.users (id, email, raw_app_meta_data) values ($1, 'op@x.co', '{"rol":"operario"}')`, [OPERARIO]);
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: OPERARIO, role: "authenticated", app_metadata: { rol: "operario" } }),
    ]);
    await db.exec("set role authenticated");
    try {
      await db.query(`select public.anular_gasto($1, 'Costo mal digitado', null)`, [id]);
    } finally {
      await db.exec("reset role");
      await db.exec("select set_config('request.jwt.claims', '', false)");
    }
    const r = await una<{ gastos_directos: string }>(`select gastos_directos from public.v_rentabilidad_orden where orden_id = $1`, [ordenId]);
    expect(Number(r.gastos_directos)).toBe(0);
    const g = await una<{ anulado: boolean; anulado_motivo: string }>(`select anulado, anulado_motivo from public.gastos_caja_menor where id = $1`, [id]);
    expect(g).toEqual({ anulado: true, anulado_motivo: "Costo mal digitado" });
  });
});

describe("el portal del cliente no ve costos", () => {
  it("entrega avance, fotos y el precio de venta, pero ni el costo de compra ni los egresos de la orden", async () => {
    await db.query(
      `insert into public.gastos_caja_menor (categoria, monto, descripcion, orden_id) values ('repuesto', $1, 'Repuesto instalado: Compresor', $2)`,
      [COSTO_APARTE, ordenId]
    );
    const r = await una<{ obtener_orden_publica: unknown }>(`select public.obtener_orden_publica($1) as obtener_orden_publica`, [token]);
    const texto = JSON.stringify(r.obtener_orden_publica);
    expect(texto).toContain("Chevrolet");
    expect(texto).toContain(String(PRECIO_LINEA)); // el precio de venta sí lo ve
    expect(texto).not.toContain(String(COSTO_LINEA));
    expect(texto).not.toContain(String(COSTO_APARTE));
    expect(texto).not.toMatch(/costo|gasto|egreso/i);
  });
});
