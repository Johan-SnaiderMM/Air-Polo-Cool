/**
 * Comportamiento REAL del SQL de la fase 9 (límite de intentos de ingreso) en un Postgres en memoria:
 * conteo, bloqueo, vencimiento de la ventana y del bloqueo, claves independientes y permisos.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBaseSupabase } from "@/test/base-supabase";

let db: PGlite;
const MAX = 5;
const VENTANA = 900;
const BLOQUEO = 900;

beforeAll(async () => {
  db = await crearBaseSupabase();
}, 120_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("reset role; delete from public.login_intentos");
});

/** Anota un fallo y devuelve el bloqueo vigente (Date) o null. */
async function fallo(clave: string, max = MAX) {
  const r = await db.query<{ b: string | null }>("select public.registrar_fallo_login($1, $2, $3, $4) as b", [clave, max, VENTANA, BLOQUEO]);
  return r.rows[0].b ? new Date(r.rows[0].b) : null;
}
async function bloqueado(...claves: string[]) {
  const r = await db.query<{ b: string | null }>("select public.login_bloqueado($1::text[]) as b", [claves]);
  return r.rows[0].b ? new Date(r.rows[0].b) : null;
}
const fila = async (clave: string) =>
  (await db.query<{ fallos: number; bloqueado_hasta: string | null }>("select fallos, bloqueado_hasta from public.login_intentos where clave = $1", [clave])).rows[0];
const envejecer = (clave: string, minutos: number) =>
  db.query(
    "update public.login_intentos set desde = desde - make_interval(mins => $2), bloqueado_hasta = bloqueado_hasta - make_interval(mins => $2) where clave = $1",
    [clave, minutos]
  );

describe("conteo y bloqueo", () => {
  it("los primeros intentos fallidos no bloquean; el quinto sí, por el tiempo indicado", async () => {
    for (let i = 1; i < MAX; i++) expect(await fallo("par:a"), `intento ${i}`).toBeNull();
    expect(await bloqueado("par:a")).toBeNull();

    const antes = Date.now();
    const hasta = await fallo("par:a");
    expect(hasta).not.toBeNull();
    const segundos = (hasta!.getTime() - antes) / 1000;
    expect(segundos).toBeGreaterThan(BLOQUEO - 5);
    expect(segundos).toBeLessThan(BLOQUEO + 5);
    expect((await bloqueado("par:a"))?.getTime()).toBe(hasta!.getTime());
  });

  it("mientras dura el bloqueo, más intentos NO lo alargan (no se puede mantener a alguien bloqueado para siempre)", async () => {
    for (let i = 0; i < MAX; i++) await fallo("par:a");
    const primero = await bloqueado("par:a");
    await fallo("par:a");
    await fallo("par:a");
    expect((await bloqueado("par:a"))?.getTime()).toBe(primero?.getTime());
  });

  it("cada clave cuenta por separado y login_bloqueado devuelve el bloqueo más largo de las que se consultan", async () => {
    for (let i = 0; i < MAX; i++) await fallo("par:a");
    expect(await bloqueado("par:b")).toBeNull();
    expect(await bloqueado("correo:x", "ip:y")).toBeNull();
    expect(await bloqueado("par:b", "par:a")).not.toBeNull();

    for (let i = 0; i < 2; i++) await fallo("ip:y", 2); // otro límite más estricto
    const corto = await bloqueado("par:a");
    await db.query("update public.login_intentos set bloqueado_hasta = bloqueado_hasta + interval '10 minutes' where clave = 'ip:y'");
    expect((await bloqueado("par:a", "ip:y"))!.getTime()).toBeGreaterThan(corto!.getTime());
  });
});

describe("vencimiento", () => {
  it("una ventana vencida sin bloqueo empieza de nuevo en 1 (los fallos viejos no se acumulan)", async () => {
    await fallo("par:a");
    await fallo("par:a");
    await fallo("par:a");
    await envejecer("par:a", 20); // pasaron 20 min: la ventana de 15 ya venció
    expect(await fallo("par:a")).toBeNull();
    expect((await fila("par:a")).fallos).toBe(1);
  });

  it("cuando el bloqueo vence, deja de bloquear y el siguiente fallo vuelve a contar desde 1", async () => {
    for (let i = 0; i < MAX; i++) await fallo("par:a");
    expect(await bloqueado("par:a")).not.toBeNull();
    await envejecer("par:a", 20); // el bloqueo y la ventana ya vencieron
    expect(await bloqueado("par:a")).toBeNull();
    expect(await fallo("par:a")).toBeNull();
    expect((await fila("par:a")).fallos).toBe(1);
  });

  it("dentro de la ventana los fallos siguen sumando aunque hayan pasado unos minutos", async () => {
    await fallo("par:a");
    await fallo("par:a");
    await envejecer("par:a", 5);
    await fallo("par:a");
    expect((await fila("par:a")).fallos).toBe(3);
  });
});

describe("ingreso correcto y limpieza", () => {
  it("un ingreso correcto borra el contador de esa clave y deja las demás", async () => {
    await fallo("par:a");
    await fallo("correo:a");
    await db.query("select public.limpiar_login($1)", ["par:a"]);
    expect(await fila("par:a")).toBeUndefined();
    expect((await fila("correo:a")).fallos).toBe(1);
  });

  it("limpia de la tabla los contadores de hace más de un día (sin bloqueo vigente)", async () => {
    await fallo("viejo");
    await envejecer("viejo", 60 * 25);
    await fallo("nuevo"); // cada fallo hace la limpieza
    expect(await fila("viejo")).toBeUndefined();
    expect(await fila("nuevo")).toBeDefined();
  });
});

describe("permisos: solo el servidor", () => {
  const como = async (rol: "anon" | "authenticated") => {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: rol, sub: "11111111-1111-4111-8111-111111111111" })]);
    await db.exec(`set role ${rol}`);
  };
  const codigo = async (p: Promise<unknown>) => {
    try {
      await p;
      return null;
    } catch (e) {
      return (e as { code?: string }).code ?? String(e);
    }
  };

  it("ni la app con sesión ni un visitante pueden leer la tabla ni llamar a las funciones", async () => {
    for (const rol of ["anon", "authenticated"] as const) {
      await como(rol);
      expect(await codigo(db.exec("select * from public.login_intentos")), `${rol} lee`).toBe("42501");
      expect(await codigo(db.query("select public.registrar_fallo_login('x', 5, 900, 900)")), `${rol} registra`).toBe("42501");
      expect(await codigo(db.query("select public.login_bloqueado(array['x'])")), `${rol} consulta`).toBe("42501");
      expect(await codigo(db.query("select public.limpiar_login('x')")), `${rol} limpia`).toBe("42501");
      await db.exec("reset role");
    }
  });
});
