/**
 * PRUEBA DE CONTRATO: `database.ts` (escrito a mano, con tipos de dominio) contra el esquema REAL
 * que producen las migraciones `polo_air_cool_fase*.sql`.
 *
 * Levanta un Postgres en memoria (PGlite), ejecuta las fases en orden (las últimas dos veces,
 * para comprobar que son re-ejecutables) y compara con los tipos: tablas, vistas, columnas,
 * nulabilidad, columnas opcionales al insertar, enums y funciones expuestas a `authenticated`.
 * Si una migración cambia el esquema y `database.ts` no se actualiza (o al revés), falla aquí,
 * antes de llegar a producción. Corre en CI sin secretos.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const FASES = ["fase1", "fase2", "fase3", "fase4", "fase5", "fase3", "fase4", "fase5"];

/**
 * Objetos que siguen en la base (los crean las migraciones) pero que la app YA NO usa y por eso
 * no están tipados: la caja física se retiró. Si algún día se vuelven a usar, se tipan y se
 * quitan de aquí.
 */
const SIN_TIPAR = {
  tablas: ["cierres_caja", "caja_movimientos"],
  vistas: ["v_caja_diaria"],
  funciones: ["cerrar_caja", "anular_cierre", "anular_movimiento_caja", "fn_saldo_caja"],
  enums: ["tipo_mov_caja"],
};

// ---------------------------------------------------------------------
// Lado TypeScript: se leen los tipos con el compilador, no con expresiones regulares.
// ---------------------------------------------------------------------
type ColumnaTs = { nullable: boolean; enInsert: "ausente" | "opcional" | "obligatoria" };
type EsquemaTs = {
  tablas: Map<string, Map<string, ColumnaTs>>;
  vistas: Map<string, Map<string, ColumnaTs>>;
  funciones: Set<string>;
  enums: Map<string, string[]>;
};

function leerTipos(): EsquemaTs {
  const archivo = path.join(RAIZ, "src", "types", "database.ts");
  const programa = ts.createProgram([archivo], {
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const checker = programa.getTypeChecker();
  const fuente = programa.getSourceFile(archivo)!;
  const modulo = checker.getSymbolAtLocation(fuente)!;
  const simboloDb = checker.getExportsOfModule(modulo).find((s) => s.name === "Database")!;
  const tipoDb = checker.getDeclaredTypeOfSymbol(simboloDb);

  const propiedad = (t: ts.Type, nombre: string): ts.Type => {
    const s = t.getProperty(nombre);
    if (!s) throw new Error(`database.ts: falta la propiedad «${nombre}»`);
    return checker.getTypeOfSymbolAtLocation(s, fuente);
  };
  const esNulo = (t: ts.Type) =>
    t.isUnion() ? t.types.some((x) => x.flags & ts.TypeFlags.Null) : !!(t.flags & ts.TypeFlags.Null);

  const publico = propiedad(tipoDb, "public");
  const columnas = (tabla: ts.Type): Map<string, ColumnaTs> => {
    const row = propiedad(tabla, "Row");
    const insert = tabla.getProperty("Insert") ? propiedad(tabla, "Insert") : null;
    const m = new Map<string, ColumnaTs>();
    for (const s of row.getProperties()) {
      const tipo = checker.getTypeOfSymbolAtLocation(s, fuente);
      const enInsert = insert?.getProperty(s.name);
      m.set(s.name, {
        nullable: esNulo(tipo),
        enInsert: !enInsert ? "ausente" : enInsert.flags & ts.SymbolFlags.Optional ? "opcional" : "obligatoria",
      });
    }
    return m;
  };
  const mapa = (contenedor: ts.Type) =>
    new Map(contenedor.getProperties().map((s) => [s.name, checker.getTypeOfSymbolAtLocation(s, fuente)] as const));

  const tablas = new Map([...mapa(propiedad(publico, "Tables"))].map(([n, t]) => [n, columnas(t)] as const));
  const vistas = new Map([...mapa(propiedad(publico, "Views"))].map(([n, t]) => [n, columnas(t)] as const));
  const funciones = new Set(propiedad(publico, "Functions").getProperties().map((s) => s.name));
  const enums = new Map(
    [...mapa(propiedad(publico, "Enums"))].map(([n, t]) => [
      n,
      (t.isUnion() ? t.types : [t]).map((x) => (x as ts.StringLiteralType).value).sort(),
    ])
  );
  return { tablas, vistas, funciones, enums };
}

/**
 * Columnas NOT NULL sin valor por defecto que la app puede omitir al insertar porque un trigger
 * BEFORE INSERT las completa (snapshot del costo y precio del inventario en fn_orden_repuestos_stock).
 */
const SIN_COMPARAR_INSERT = new Set(["orden_repuestos.costo_unitario", "orden_repuestos.precio_unitario"]);

// ---------------------------------------------------------------------
// Lado Postgres
// ---------------------------------------------------------------------
type ColumnaDb = { nullable: boolean; conValorPorDefecto: boolean; esJson: boolean };
let db: PGlite;

async function consulta<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  // Piezas de Supabase que las migraciones dan por existentes.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema extensions; create schema auth; create schema storage;
    grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const fase of FASES) {
    await db.exec(fs.readFileSync(path.join(RAIZ, `polo_air_cool_${fase}.sql`), "utf8"));
  }
}, 180_000);

afterAll(async () => {
  await db?.close();
});

describe("database.ts vs migraciones SQL", () => {
  const ts_ = leerTipos();

  async function columnasDb(tipo: "BASE TABLE" | "VIEW") {
    const filas = await consulta<{
      table_name: string;
      column_name: string;
      is_nullable: string;
      column_default: string | null;
      is_generated: string;
      is_identity: string;
      data_type: string;
    }>(`
      select c.table_name, c.column_name, c.is_nullable, c.column_default, c.is_generated, c.is_identity, c.data_type
      from information_schema.columns c
      join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and t.table_type = '${tipo}'
      order by c.table_name, c.ordinal_position`);
    const m = new Map<string, Map<string, ColumnaDb>>();
    for (const f of filas) {
      if (!m.has(f.table_name)) m.set(f.table_name, new Map());
      m.get(f.table_name)!.set(f.column_name, {
        nullable: f.is_nullable === "YES",
        conValorPorDefecto: f.column_default !== null || f.is_generated === "ALWAYS" || f.is_identity === "YES",
        esJson: f.data_type === "jsonb" || f.data_type === "json",
      });
    }
    return m;
  }

  it("las mismas tablas y vistas (salvo las retiradas a propósito)", async () => {
    const tablasDb = [...(await columnasDb("BASE TABLE")).keys()].filter((t) => !SIN_TIPAR.tablas.includes(t));
    const vistasDb = [...(await columnasDb("VIEW")).keys()].filter((v) => !SIN_TIPAR.vistas.includes(v));
    expect([...ts_.tablas.keys()].sort()).toEqual(tablasDb.sort());
    expect([...ts_.vistas.keys()].sort()).toEqual(vistasDb.sort());
  });

  it("cada tabla: mismas columnas, misma nulabilidad y mismo carácter opcional al insertar", async () => {
    const enDb = await columnasDb("BASE TABLE");
    const problemas: string[] = [];
    for (const [tabla, colsTs] of ts_.tablas) {
      const colsDb = enDb.get(tabla);
      if (!colsDb) continue; // ya lo señala la prueba anterior
      // Tablas que solo se escriben por RPC declaran `Insert: Record<string, never>`.
      const insertVacio = [...colsTs.values()].every((x) => x.enInsert === "ausente");
      for (const c of new Set([...colsTs.keys(), ...colsDb.keys()])) {
        const t = colsTs.get(c);
        const d = colsDb.get(c);
        if (!t) problemas.push(`${tabla}.${c}: existe en la base pero NO en database.ts`);
        else if (!d) problemas.push(`${tabla}.${c}: existe en database.ts pero NO en la base`);
        else {
          // `Json` ya incluye null en su definición: para jsonb la nulabilidad no se puede comparar.
          if (!d.esJson && t.nullable !== d.nullable) {
            problemas.push(`${tabla}.${c}: nulabilidad distinta (tipos: ${t.nullable}, base: ${d.nullable})`);
          }
          if (insertVacio || SIN_COMPARAR_INSERT.has(`${tabla}.${c}`)) continue;
          const opcionalEnDb = d.nullable || d.conValorPorDefecto;
          if (!opcionalEnDb && t.enInsert !== "obligatoria") {
            problemas.push(`${tabla}.${c}: es obligatoria al insertar en la base, pero database.ts no la exige`);
          }
          if (opcionalEnDb && t.enInsert === "obligatoria") {
            problemas.push(`${tabla}.${c}: es opcional en la base, pero database.ts la exige al insertar`);
          }
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  it("cada vista: mismas columnas", async () => {
    const enDb = await columnasDb("VIEW");
    const problemas: string[] = [];
    for (const [vista, colsTs] of ts_.vistas) {
      const colsDb = enDb.get(vista);
      if (!colsDb) continue;
      for (const c of new Set([...colsTs.keys(), ...colsDb.keys()])) {
        if (!colsTs.has(c)) problemas.push(`${vista}.${c}: falta en database.ts`);
        if (!colsDb.has(c)) problemas.push(`${vista}.${c}: no existe en la base`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("los enums tienen los mismos valores", async () => {
    const filas = await consulta<{ nombre: string; valor: string }>(`
      select t.typname as nombre, e.enumlabel as valor
      from pg_enum e join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
      order by t.typname, e.enumsortorder`);
    const enDb = new Map<string, string[]>();
    for (const f of filas) enDb.set(f.nombre, [...(enDb.get(f.nombre) ?? []), f.valor]);
    for (const n of SIN_TIPAR.enums) enDb.delete(n);
    expect(new Map([...ts_.enums].map(([n, v]) => [n, [...v].sort()]))).toEqual(
      new Map([...enDb].map(([n, v]) => [n, [...v].sort()]))
    );
  });

  it("las funciones que la app puede llamar (RPC) coinciden", async () => {
    // RPC = funciones de `public` que no son de trigger y que `authenticated` puede ejecutar.
    const filas = await consulta<{ nombre: string }>(`
      select p.proname as nombre
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      where p.prorettype <> 'trigger'::regtype
        and has_function_privilege('authenticated', p.oid, 'execute')`);
    const enDb = new Set(filas.map((f) => f.nombre).filter((f) => !SIN_TIPAR.funciones.includes(f)));
    // Las que database.ts declara deben existir; las de la base ejecutables por la app, estar declaradas.
    const sobranEnTipos = [...ts_.funciones].filter((f) => !enDb.has(f) && !existeSinPermiso.has(f));
    const faltanEnTipos = [...enDb].filter((f) => !ts_.funciones.has(f));
    expect({ sobranEnTipos, faltanEnTipos }).toEqual({ sobranEnTipos: [], faltanEnTipos: [] });
  });
});

/** Funciones tipadas que existen pero cuya ejecución se revoca a `authenticated` a propósito. */
const existeSinPermiso = new Set<string>(["fn_generar_token_publico"]);
