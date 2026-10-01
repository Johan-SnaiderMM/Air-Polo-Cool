/**
 * Comportamiento REAL del SQL de la fase 6 (usuario de soporte) sobre un Postgres en memoria:
 * aislamiento entre datos reales y de prueba, y el interruptor de mantenimiento. Las consultas se
 * hacen como `authenticated` con el JWT de cada usuario, igual que PostgREST, para que el RLS y
 * los triggers se apliquen de verdad.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseSupabase } from "@/test/base-supabase";

const POLO = "11111111-1111-4111-8111-111111111111";
const SOPORTE = "22222222-2222-4222-8222-222222222222";

let db: PGlite;

async function como(usuario: "polo" | "soporte" | "servicio") {
  await db.exec("reset role");
  if (usuario === "servicio") return; // sin JWT ni rol: como el SQL Editor / service role
  const claims =
    usuario === "polo"
      ? { sub: POLO, role: "authenticated", app_metadata: { rol: "operario" } }
      : { sub: SOPORTE, role: "authenticated", app_metadata: { rol: "admin", soporte: true } };
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec("set role authenticated");
}

/** Filas visibles para el usuario actual. */
async function contar(tabla: string, donde = "true") {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from public.${tabla} where ${donde}`);
  return r.rows[0].n;
}

const codigoDeError = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

beforeAll(async () => {
  db = await crearBaseSupabase();
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data) values
       ($1, 'polo@aircool.com', '{"rol":"operario"}'),
       ($2, 'soporte@aircool.com', '{"rol":"admin","soporte":true}')`,
    [POLO, SOPORTE]
  );
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("modo prueba", () => {
  it("lo que crea Polo es real y lo ve soporte en modo real", async () => {
    await como("polo");
    await db.exec(`insert into public.clientes (nombre, telefono) values ('Cliente real', '+573001112233')`);
    expect(await contar("clientes", "es_prueba = false")).toBe(1);

    await como("soporte");
    expect(await contar("clientes")).toBe(1);
  });

  it("soporte en modo prueba no ve lo real, y lo que crea queda marcado y Polo no lo ve", async () => {
    await como("soporte");
    await db.exec(`select public.cambiar_modo_prueba(true)`);
    expect(await contar("clientes")).toBe(0);

    await db.exec(`insert into public.clientes (nombre, telefono) values ('Cliente de prueba', '+573009998877')`);
    expect(await contar("clientes", "es_prueba")).toBe(1);

    await como("polo");
    expect(await contar("clientes")).toBe(1);
    expect(await contar("clientes", "nombre = 'Cliente de prueba'")).toBe(0);
  });

  it("no se puede crear un registro con el modo equivocado", async () => {
    await como("polo");
    const polo = await codigoDeError(
      db.exec(`insert into public.clientes (nombre, telefono, es_prueba) values ('Falso', '+573001110000', true)`)
    );
    expect(polo).toBe("42501");

    await como("soporte"); // sigue en modo prueba
    const soporte = await codigoDeError(
      db.exec(`insert into public.clientes (nombre, telefono, es_prueba) values ('Falso', '+573001110001', false)`)
    );
    expect(soporte).toBe("42501");
  });

  it("Polo no puede modificar ni borrar lo de prueba, y soporte en modo prueba no toca lo real", async () => {
    await como("polo");
    await db.exec(`update public.clientes set nombre = 'Hackeado' where true`);
    expect(await contar("clientes", "nombre = 'Hackeado'")).toBe(1); // solo el real
    await db.exec(`update public.clientes set nombre = 'Cliente real' where true`);

    await como("soporte");
    await db.exec(`update public.clientes set nombre = 'Cliente de prueba' where true`);
    await como("polo");
    expect(await contar("clientes", "nombre = 'Cliente real'")).toBe(1);
  });

  it("la misma placa puede existir en los dos modos; en un mismo modo no", async () => {
    await como("polo");
    await db.exec(`
      insert into public.vehiculos (cliente_id, placa, marca, modelo)
      select id, 'ABC123', 'Renault', 'Logan' from public.clientes`);
    await como("soporte");
    await db.exec(`
      insert into public.vehiculos (cliente_id, placa, marca, modelo)
      select id, 'ABC123', 'Renault', 'Logan' from public.clientes`);
    expect(await contar("vehiculos", "placa = 'ABC123'")).toBe(1);

    const repetida = await codigoDeError(
      db.exec(`insert into public.vehiculos (cliente_id, placa, marca, modelo) select id, 'abc-123', 'X', 'Y' from public.clientes`)
    );
    expect(repetida).toBe("23505");
  });

  it("los datos de prueba no entran en las vistas de Polo (reposición de inventario)", async () => {
    await como("polo");
    await db.exec(`insert into public.inventario (codigo, nombre, stock_actual, stock_minimo) values ('REP-1', 'Filtro real', 1, 5)`);
    await como("soporte");
    await db.exec(`insert into public.inventario (codigo, nombre, stock_actual, stock_minimo) values ('REP-1', 'Filtro prueba', 0, 9)`);
    expect(await contar("v_inventario_reposicion")).toBe(1);
    expect(await contar("v_inventario_reposicion", "nombre = 'Filtro prueba'")).toBe(1);
    await como("polo");
    expect(await contar("v_inventario_reposicion")).toBe(1);
    expect(await contar("v_inventario_reposicion", "nombre = 'Filtro real'")).toBe(1);
  });

  it("una orden de prueba no puede descontar el stock REAL (ni por la función que salta el RLS)", async () => {
    await como("polo");
    await db.exec(`update public.inventario set stock_actual = 10 where nombre = 'Filtro real'`);
    const { rows } = await db.query<{ id: string }>(`select id from public.inventario where nombre = 'Filtro real'`);
    const realId = rows[0].id;

    await como("soporte");
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id) select id from public.vehiculos`);
    const { rows: o } = await db.query<{ id: string }>(`select id from public.ordenes_servicio`);
    const codigo = await codigoDeError(
      db.query(`insert into public.orden_repuestos (orden_id, inventario_id, cantidad_usada) values ($1, $2, 3)`, [o[0].id, realId])
    );
    expect(codigo).toBe("PC002");

    await como("polo");
    expect(await contar("inventario", "nombre = 'Filtro real' and stock_actual = 10")).toBe(1);
  });

  it("solo soporte puede cambiar de modo; para Polo el modo siempre es real", async () => {
    await como("polo");
    expect(await codigoDeError(db.exec(`select public.cambiar_modo_prueba(true)`))).toBe("42501");
    const r = await db.query<{ v: boolean }>(`select public.en_modo_prueba() as v`);
    expect(r.rows[0].v).toBe(false);
    await como("soporte");
    const s = await db.query<{ v: boolean }>(`select public.en_modo_prueba() as v`);
    expect(s.rows[0].v).toBe(true);
    await db.exec(`select public.cambiar_modo_prueba(false)`);
    expect(await contar("clientes", "nombre = 'Cliente real'")).toBe(1);
  });
});

describe("mantenimiento", () => {
  let pagoId: string;

  it("preparación: una orden con un pago de Polo", async () => {
    await como("polo");
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id) select id from public.vehiculos`);
    const { rows } = await db.query<{ id: string }>(`select id from public.ordenes_servicio`);
    await db.query(`insert into public.pagos_orden (orden_id, monto, registrado_por) values ($1, 50000, $2)`, [rows[0].id, POLO]);
    pagoId = (await db.query<{ id: string }>(`select id from public.pagos_orden`)).rows[0].id;
    expect(await contar("pagos_orden")).toBe(1);
  });

  it("Polo no puede activar el mantenimiento; soporte sí", async () => {
    await como("polo");
    expect(await codigoDeError(db.exec(`select public.cambiar_mantenimiento(true, 'x')`))).toBe("42501");
    expect(await codigoDeError(db.exec(`update public.mantenimiento set activo = true`))).toBe("42501");
    await como("soporte");
    await db.exec(`select public.cambiar_mantenimiento(true, '  Actualizando  ')`);
    const r = await db.query<{ activo: boolean; motivo: string }>(`select activo, motivo from public.mantenimiento`);
    expect(r.rows[0]).toEqual({ activo: true, motivo: "Actualizando" });
  });

  it("con mantenimiento activo Polo puede leer todo y el estado, pero no escribir", async () => {
    await como("polo");
    expect(await contar("clientes")).toBe(1);
    expect(await contar("mantenimiento", "activo")).toBe(1);
    const escribir = async (sql: string) => codigoDeError(db.exec(sql));
    expect(await escribir(`insert into public.clientes (nombre, telefono) values ('Nuevo', '+573005550000')`)).toBe("PC001");
    expect(await escribir(`update public.clientes set nombre = 'Otro'`)).toBe("PC001");
    await escribir(`delete from public.clientes`); // un operario nunca borra (RLS): no hay error, pero tampoco borra
    expect(await contar("clientes")).toBe(1);
  });

  it("tampoco por las funciones que se saltan el RLS (anular un pago)", async () => {
    await como("polo");
    expect(await codigoDeError(db.query(`select public.anular_pago($1, 'error de digitación')`, [pagoId]))).toBe("PC001");
    expect(await contar("pagos_orden", "anulado")).toBe(0);
  });

  it("soporte sí puede trabajar durante el mantenimiento; sin sesión (SQL Editor) tampoco se restringe", async () => {
    await como("soporte");
    await db.exec(`insert into public.clientes (nombre, telefono) values ('Soporte', '+573006660000')`);
    await como("servicio");
    await db.exec(`update public.clientes set nombre = 'Desde el editor' where nombre = 'Soporte'`);
  });

  it("al desactivarlo Polo vuelve a escribir", async () => {
    await como("soporte");
    await db.exec(`select public.cambiar_mantenimiento(false)`);
    await como("polo");
    await db.exec(`select public.anular_pago('${pagoId}', 'error de digitación')`);
    expect(await contar("pagos_orden", "anulado")).toBe(1);
    const r = await db.query<{ motivo: string | null }>(`select motivo from public.mantenimiento`);
    expect(r.rows[0].motivo).toBeNull();
  });
});

describe("agenda (citas)", () => {
  const insertarCita = (extra = "") =>
    `insert into public.citas (vehiculo_id, fecha_hora, tipo${extra ? ", " + extra.split("=")[0] : ""})
     select id, now() + interval '1 day', 'servicio'${extra ? ", " + extra.split("=")[1] : ""} from public.vehiculos limit 1`;

  it("una cita de Polo es real; la que soporte crea en modo prueba solo la ve soporte", async () => {
    await como("polo");
    await db.exec(insertarCita());
    expect(await contar("citas", "es_prueba = false")).toBe(1);

    await como("soporte");
    expect(await contar("citas")).toBe(1); // modo real: ve la de Polo
    await db.exec(`select public.cambiar_modo_prueba(true)`);
    expect(await contar("citas")).toBe(0);
    await db.exec(insertarCita());
    expect(await contar("citas", "es_prueba")).toBe(1);

    await como("polo");
    expect(await contar("citas")).toBe(1);
    expect(await contar("citas", "es_prueba")).toBe(0);

    await como("soporte");
    await db.exec(`select public.cambiar_modo_prueba(false)`);
  });

  it("Polo no puede marcar como cumplida una cita de prueba ni crear una con el modo equivocado", async () => {
    await como("polo");
    await db.exec(`update public.citas set estado = 'cancelada'`);
    expect(await contar("citas", "estado = 'cancelada'")).toBe(1); // solo la real; la de prueba ni la ve
    expect(await codigoDeError(db.exec(insertarCita("es_prueba=true")))).toBe("42501");
  });

  it("las reglas de la tabla: tipo y estado válidos, nota acotada", async () => {
    await como("polo");
    const malo = (campos: string, valores: string) =>
      codigoDeError(db.exec(`insert into public.citas (vehiculo_id, fecha_hora, ${campos}) select id, now(), ${valores} from public.vehiculos limit 1`));
    expect(await malo("tipo", "'otro'")).toBe("23514");
    expect(await malo("estado", "'perdida'")).toBe("23514");
    expect(await malo("notas", `'${"n".repeat(1001)}'`)).toBe("23514");
  });

  it("durante el mantenimiento Polo no agenda ni modifica citas; soporte sí", async () => {
    await como("soporte");
    await db.exec(`select public.cambiar_mantenimiento(true, 'prueba')`);
    await como("polo");
    expect(await codigoDeError(db.exec(insertarCita()))).toBe("PC001");
    expect(await codigoDeError(db.exec(`update public.citas set estado = 'cumplida'`))).toBe("PC001");
    expect(await contar("citas")).toBeGreaterThan(0); // consultar sí puede

    await como("soporte");
    await db.exec(insertarCita());
    await db.exec(`select public.cambiar_mantenimiento(false)`);
    await como("polo");
    await db.exec(insertarCita());
  });
});
