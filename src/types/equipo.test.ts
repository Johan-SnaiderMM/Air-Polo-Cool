/**
 * Comportamiento REAL del SQL de la fase 10 (equipo y perfiles) sobre un Postgres en memoria: los perfiles que
 * crea la migración para los usuarios que ya existían, que el autor lo ponga la base (no el teléfono), que
 * desactivar a alguien corte su acceso y que nadie pueda escribir en `perfiles` desde la app. Las consultas
 * se hacen como `authenticated` con el JWT de cada usuario, igual que PostgREST.
 */
import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseSupabase, DIR_MIGRACIONES, MIGRACIONES } from "@/test/base-supabase";

const DUENO = "11111111-1111-4111-8111-111111111111";
const SOPORTE = "22222222-2222-4222-8222-222222222222";
const CARLOS = "33333333-3333-4333-8333-333333333333";
const SIN_ROL = "44444444-4444-4444-8444-444444444444";
const LEGADO = "55555555-5555-4555-8555-555555555555";

const FASE10 = MIGRACIONES.find((f) => f.includes("fase10"))!;
const ANTES_DE_FASE10 = MIGRACIONES.filter((f) => f !== FASE10);
const sqlFase10 = () => fs.readFileSync(path.join(DIR_MIGRACIONES, FASE10), "utf8");

const CLAIMS = {
  dueno: { sub: DUENO, role: "authenticated", app_metadata: { rol: "admin" } },
  soporte: { sub: SOPORTE, role: "authenticated", app_metadata: { rol: "admin", soporte: true } },
  carlos: { sub: CARLOS, role: "authenticated", app_metadata: { rol: "operario" } },
  // Un usuario con rol pero SIN perfil (anterior a la migración, o creado a mano en el panel).
  legado: { sub: LEGADO, role: "authenticated", app_metadata: { rol: "operario" } },
} as const;
type Usuario = keyof typeof CLAIMS | "servicio";

let db: PGlite;

async function como(usuario: Usuario) {
  await db.exec("reset role");
  if (usuario === "servicio") {
    // Sin JWT ni rol: como el SQL Editor / service role (hay que borrar el JWT del usuario anterior).
    await db.exec("select set_config('request.jwt.claims', '', false)");
    return;
  }
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(CLAIMS[usuario])]);
  await db.exec("set role authenticated");
}

const codigoDeError = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

async function una<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
const contar = async (tabla: string, donde = "true") => (await una<{ n: number }>(`select count(*)::int as n from public.${tabla} where ${donde}`)).n;

beforeAll(async () => {
  db = await crearBaseSupabase(ANTES_DE_FASE10);
  // Los usuarios ya existen cuando se ejecuta la migración: lo normal en el taller.
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data) values
       ($1, 'dueno@aircool.com',   '{"rol":"admin"}'),
       ($2, 'soporte@aircool.com', '{"rol":"admin","soporte":true}'),
       ($3, 'carlos@aircool.com',  '{"rol":"operario"}'),
       ($4, 'sinrol@aircool.com',  '{}'),
       ('${LEGADO}', 'legado@aircool.com', '{"rol":"operario"}')`,
    [DUENO, SOPORTE, CARLOS, SIN_ROL]
  );
  await db.exec(sqlFase10());
  // El usuario «legado» no tiene perfil: se borra el que la migración le creó (si se lo creó).
  await db.exec(`delete from public.perfiles where id = '${LEGADO}'`);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("perfiles de los usuarios que ya existían", () => {
  it("soporte → «Soporte técnico»; el admin → «Polo»; otro operario → la parte inicial de su correo; sin rol → sin perfil", async () => {
    await como("servicio");
    const filas = (await db.query<{ id: string; nombre: string; rol: string; es_soporte: boolean; correo: string }>(
      `select id, nombre, rol, es_soporte, correo from public.perfiles order by nombre`
    )).rows;
    expect(filas.map((f) => [f.nombre, f.rol, f.es_soporte, f.correo])).toEqual([
      ["Carlos", "operario", false, "carlos@aircool.com"],
      ["Polo", "admin", false, "dueno@aircool.com"],
      ["Soporte técnico", "admin", true, "soporte@aircool.com"],
    ]);
    expect(filas.some((f) => f.id === SIN_ROL)).toBe(false);
  });

  it("es re-ejecutable: ejecutar la migración otra vez no duplica ni falla (y crea el perfil de quien aún no lo tenga)", async () => {
    await como("servicio");
    await db.exec(sqlFase10());
    expect(await contar("perfiles", "nombre in ('Polo', 'Carlos', 'Soporte técnico')")).toBe(3);
    expect(await contar("perfiles", `id = '${LEGADO}'`)).toBe(1);
    await db.exec(`delete from public.perfiles where id = '${LEGADO}'`); // vuelve a quedar sin perfil
  });

  it("dos usuarios que darían el mismo nombre no rompen la migración (uno queda sin perfil)", async () => {
    const otra = await crearBaseSupabase(ANTES_DE_FASE10);
    try {
      await otra.exec(`insert into auth.users (id, email, raw_app_meta_data) values
        ('a0000000-0000-4000-8000-000000000001', 'ana@uno.com', '{"rol":"operario"}'),
        ('a0000000-0000-4000-8000-000000000002', 'ana@dos.com', '{"rol":"operario"}'),
        ('a0000000-0000-4000-8000-000000000003', 'dueno@uno.com', '{"rol":"admin"}')`);
      await otra.exec(sqlFase10());
      const nombres = (await otra.query<{ nombre: string }>(`select nombre from public.perfiles order by nombre`)).rows.map((f) => f.nombre);
      expect(nombres).toEqual(["Ana", "Polo"]);
    } finally {
      await otra.close();
    }
  });
});

describe("el autor lo estampa la base según la sesión", () => {
  async function datosBase() {
    await como("dueno");
    await db.exec(`insert into public.clientes (nombre, telefono) values ('Cliente', '+573001112233')`);
    await db.exec(`insert into public.vehiculos (cliente_id, placa, marca, modelo) select id, 'AAA111', 'Renault', 'Logan' from public.clientes`);
  }
  const autorDe = async (tabla: string, donde = "true") => (await una<{ autor: string | null }>(`select autor from public.${tabla} where ${donde} order by created_at desc limit 1`)).autor;

  it("con perfil, el autor es su nombre aunque el teléfono mande otro", async () => {
    await datosBase();
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, 'Polo' from public.vehiculos`);
    expect(await autorDe("ordenes_servicio")).toBe("Polo"); // el dueño se llama Polo

    await como("carlos");
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, 'Polo' from public.vehiculos`);
    expect(await autorDe("ordenes_servicio", "autor <> 'Polo'")).toBe("Carlos");
    expect(await contar("ordenes_servicio", "autor = 'Carlos'")).toBe(1);

    await db.exec(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, null from public.vehiculos`);
    expect(await contar("ordenes_servicio", "autor = 'Carlos'")).toBe(2); // sin autor, también el suyo
  });

  it("soporte firma como «Soporte técnico» aunque diga otra cosa", async () => {
    await como("soporte");
    await db.exec(`insert into public.clientes (nombre, telefono) values ('Cliente soporte', '+573009990000')`);
    await db.exec(`insert into public.gastos_caja_menor (fecha, categoria, monto, descripcion, autor) values (current_date, 'otros', 1000, 'prueba', 'Carlos')`);
    expect(await autorDe("gastos_caja_menor")).toBe("Soporte técnico");
  });

  it("también en pagos, cotizaciones y citas (todas las tablas con autor)", async () => {
    await como("carlos");
    const { id: orden } = await una<{ id: string }>(`select id from public.ordenes_servicio limit 1`);
    await db.query(`insert into public.pagos_orden (orden_id, monto, autor) values ($1, 50000, 'Polo')`, [orden]);
    await db.exec(`insert into public.cotizaciones (vehiculo_id, autor) select id, 'Polo' from public.vehiculos`);
    await db.exec(`insert into public.citas (vehiculo_id, fecha_hora, autor) select id, now(), 'Polo' from public.vehiculos`);
    for (const tabla of ["pagos_orden", "cotizaciones", "citas"]) expect(await autorDe(tabla), tabla).toBe("Carlos");
  });

  it("un usuario SIN perfil solo conserva los sellos de siempre; cualquier otro nombre se descarta", async () => {
    await como("legado");
    const insertar = (autor: string) => db.query(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, $1 from public.vehiculos`, [autor]);
    await insertar("Polo");
    expect(await autorDe("ordenes_servicio", "true")).toBe("Polo");
    await insertar("Hacker");
    expect(await autorDe("ordenes_servicio", "true")).toBeNull();
    await insertar("Soporte técnico");
    expect(await autorDe("ordenes_servicio", "true")).toBe("Soporte técnico");
  });

  it("sin sesión de usuario (SQL Editor / service role) se respeta el nombre dado, si tiene forma de nombre", async () => {
    await como("servicio");
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, 'María del Mar' from public.vehiculos`);
    expect(await autorDe("ordenes_servicio")).toBe("María del Mar");
    // Un nombre demasiado largo no se guarda a medias: queda sin autor (y la restricción cubre cualquier UPDATE).
    await db.exec(`insert into public.ordenes_servicio (vehiculo_id, autor) select id, '${"x".repeat(41)}' from public.vehiculos`);
    expect(await autorDe("ordenes_servicio")).toBeNull();
    expect(await codigoDeError(db.exec(`update public.ordenes_servicio set autor = '${"x".repeat(41)}'`))).toBe("23514");
  });

  it("la app no puede ejecutar las funciones internas del sello", async () => {
    await como("carlos");
    expect(await codigoDeError(db.exec(`select public.autor_efectivo('x')`))).toBe("42501");
    expect(await codigoDeError(db.exec(`select public.autor_valido('x')`))).toBe("42501");
  });
});

describe("las funciones que reciben el autor usan el del perfil", () => {
  it("editar y anular un gasto dejan el nombre real en el historial y en «anulado por»", async () => {
    await como("carlos");
    await db.exec(`insert into public.gastos_caja_menor (fecha, categoria, monto, descripcion) values (current_date, 'otros', 5000, 'Almuerzo')`);
    const { id } = await una<{ id: string }>(`select id from public.gastos_caja_menor where descripcion = 'Almuerzo'`);

    await db.query(`select public.editar_gasto($1, current_date, 'otros', 7000, 'Almuerzo', null, 'Polo')`, [id]);
    const g = await una<{ historial: { autor: string }[] }>(`select historial from public.gastos_caja_menor where id = $1`, [id]);
    expect(g.historial.at(-1)?.autor).toBe("Carlos");

    await db.query(`select public.anular_gasto($1, 'duplicado', 'Polo')`, [id]);
    expect((await una<{ anulado_autor: string }>(`select anulado_autor from public.gastos_caja_menor where id = $1`, [id])).anulado_autor).toBe("Carlos");
  });

  it("un autor sin forma de nombre se rechaza, como antes se rechazaba uno desconocido", async () => {
    await como("carlos");
    expect(await codigoDeError(db.exec(`select public.anular_gasto(gen_random_uuid(), 'x', '${"x".repeat(60)}')`))).toBe("23514");
  });

  it("cerrar la caja y convertir una cotización firman con el nombre del perfil", async () => {
    await como("carlos");
    const cierre = await una<{ autor: string }>(
      `select * from public.cerrar_caja((now() at time zone 'America/Bogota')::date, 100, '{}'::jsonb, null, 'Polo')`
    );
    expect(cierre.autor).toBe("Carlos");
    expect(await contar("caja_movimientos", "autor = 'Carlos'")).toBe(1); // el ajuste del arqueo

    const { id: cot } = await una<{ id: string }>(`select id from public.cotizaciones limit 1`);
    const { convertir_cotizacion: orden } = await una<{ convertir_cotizacion: string }>(`select public.convertir_cotizacion($1, 'Polo')`, [cot]);
    expect((await una<{ autor: string }>(`select autor from public.ordenes_servicio where id = $1`, [orden])).autor).toBe("Carlos");
  });
});

describe("desactivar a alguien corta su acceso a los datos", () => {
  it("desactivado, ya no es staff: no ve ni escribe; su perfil sigue visible para él", async () => {
    await como("servicio");
    await db.query(`update public.perfiles set activo = false, desactivado_at = now() where id = $1`, [CARLOS]);

    await como("carlos");
    expect((await una<{ s: boolean }>(`select public.es_staff() as s`)).s).toBe(false);
    expect(await contar("clientes")).toBe(0);
    expect(await codigoDeError(db.exec(`insert into public.clientes (nombre, telefono) values ('X', '+573001230000')`))).toBe("42501");
    expect(await una(`select nombre, activo from public.mi_perfil()`)).toEqual({ nombre: "Carlos", activo: false });
  });

  it("reactivado, vuelve a entrar", async () => {
    await como("servicio");
    await db.query(`update public.perfiles set activo = true, desactivado_at = null where id = $1`, [CARLOS]);
    await como("carlos");
    expect((await una<{ s: boolean }>(`select public.es_staff() as s`)).s).toBe(true);
    expect(await contar("clientes")).toBeGreaterThan(0);
  });

  it("un admin desactivado tampoco es admin", async () => {
    await como("servicio");
    await db.query(`update public.perfiles set activo = false where id = $1`, [DUENO]);
    await como("dueno");
    expect((await una<{ a: boolean }>(`select public.es_admin() as a`)).a).toBe(false);
    await como("servicio");
    await db.query(`update public.perfiles set activo = true where id = $1`, [DUENO]);
    await como("dueno");
    expect((await una<{ a: boolean }>(`select public.es_admin() as a`)).a).toBe(true);
  });

  it("un usuario con rol y sin perfil conserva su acceso (solo una desactivación EXPLÍCITA lo corta)", async () => {
    await como("legado");
    expect((await una<{ s: boolean }>(`select public.es_staff() as s`)).s).toBe(true);
    expect(await una(`select count(*)::int as n from public.mi_perfil()`)).toEqual({ n: 0 });
  });
});

describe("la tabla perfiles", () => {
  it("el equipo puede leerla; nadie la escribe desde la app", async () => {
    await como("carlos");
    expect(await contar("perfiles")).toBe(3);
    for (const sql of [
      `insert into public.perfiles (id, nombre, rol) values (gen_random_uuid(), 'Intruso', 'admin')`,
      `update public.perfiles set rol = 'admin' where id = '${CARLOS}'`,
      `update public.perfiles set nombre = 'Polo 2' where id = '${DUENO}'`,
      `delete from public.perfiles`,
    ]) {
      expect(await codigoDeError(db.exec(sql)), sql).toBe("42501");
    }
  });

  it("alguien sin rol (o sin sesión) no la ve", async () => {
    await como("servicio");
    await db.exec("set role anon");
    expect(await codigoDeError(db.exec(`select * from public.perfiles`))).toBe("42501");
    await como("servicio");
  });

  it("no hay dos personas con el mismo nombre (ni con otra mayúscula o espacios)", async () => {
    await como("servicio");
    await db.exec(`insert into auth.users (id, email, raw_app_meta_data) values ('b0000000-0000-4000-8000-000000000001', 'x@y.com', '{"rol":"operario"}')`);
    const dup = (nombre: string) =>
      codigoDeError(db.query(`insert into public.perfiles (id, nombre, rol) values ('b0000000-0000-4000-8000-000000000001', $1, 'operario')`, [nombre]));
    expect(await dup("carlos")).toBe("23505");
    expect(await dup("  CARLOS ")).toBe("23505");
    expect(await dup("Ana")).toBeNull();
  });

  it("«Soporte técnico» solo puede llevarlo la cuenta de soporte; el largo del nombre está limitado", async () => {
    await como("servicio");
    await db.exec(`insert into auth.users (id, email, raw_app_meta_data) values ('b0000000-0000-4000-8000-000000000002', 'z@y.com', '{"rol":"operario"}')`);
    const poner = (nombre: string, soporte = false) =>
      codigoDeError(db.query(`insert into public.perfiles (id, nombre, rol, es_soporte) values ('b0000000-0000-4000-8000-000000000002', $1, 'operario', $2)`, [nombre, soporte]));
    expect(await poner("Soporte Técnico")).toBe("23514");
    expect(await poner("a")).toBe("23514");
    expect(await poner("a".repeat(41))).toBe("23514");
    expect(await poner("Luis")).toBeNull();
  });

  it("al borrar el usuario de Auth se borra su perfil (no quedan perfiles huérfanos)", async () => {
    await como("servicio");
    await db.exec(`delete from auth.users where id = 'b0000000-0000-4000-8000-000000000002'`);
    expect(await contar("perfiles", "id = 'b0000000-0000-4000-8000-000000000002'")).toBe(0);
  });
});
