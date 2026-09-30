/**
 * Postgres en memoria (PGlite) con lo mínimo de Supabase que las migraciones dan por existente
 * (roles, auth.jwt()/auth.uid(), storage) y las migraciones de supabase/migrations ya aplicadas.
 * Lo comparten la prueba de contrato de tipos y las pruebas de comportamiento del SQL.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export const DIR_MIGRACIONES = path.join(process.cwd(), "supabase", "migrations");
export const MIGRACIONES = fs.readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();

const SUPABASE_MINIMO = `
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
`;

/** Crea la base y ejecuta los archivos indicados, en ese orden (por defecto, todas las migraciones una vez). */
export async function crearBaseSupabase(archivos: string[] = MIGRACIONES): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(SUPABASE_MINIMO);
  for (const archivo of archivos) {
    await db.exec(fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), "utf8"));
  }
  return db;
}
