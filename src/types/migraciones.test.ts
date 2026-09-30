/**
 * Reglas de la carpeta supabase/migrations (sin base de datos: solo lee los archivos):
 *  1. Nombre versionado y orden estricto: <14 dígitos>_<nombre>.sql. El orden de ejecución ES el
 *     orden alfabético, así que nunca queda ambiguo.
 *  2. Cada función, vista o política se define UNA sola vez. Así una edición posterior no puede
 *     "resucitar" una versión anterior copiada en otro archivo.
 *
 * Si necesitas cambiar una función o vista ya migrada, edita SU definición (y comprueba que la
 * prueba de huella en database.contract.test.ts cambia solo lo que quieres), o crea una migración
 * nueva. No pegues una segunda copia en otro archivo.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const contenido = new Map(archivos.map((f) => [f, fs.readFileSync(path.join(DIR, f), "utf8")]));

/**
 * Definiciones que se repiten a propósito, con el motivo. Cada una es una capa del esquema que
 * depende de columnas que aparecen en una fase posterior.
 */
const REPETIDAS_A_PROPOSITO: Record<string, string> = {
  "function:fn_orden_before_write":
    "El trigger de la fase 1 la necesita desde el principio; la fase 4 la amplía con el próximo mantenimiento.",
  "policy:gastos_staff_insert on gastos_caja_menor":
    "La fase 1 la crea; la fase 4 le añade la condición «no anulado» al agregar esa columna.",
};

/** Quita comentarios SQL de línea para no contar definiciones que solo se mencionan en texto. */
const sinComentarios = (sql: string) => sql.replace(/--[^\n]*/g, "");

function definiciones(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const agregar = (clave: string, archivo: string) => m.set(clave, [...(m.get(clave) ?? []), archivo]);
  for (const [archivo, sql] of contenido) {
    const limpio = sinComentarios(sql);
    for (const r of limpio.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)/gi)) {
      agregar(`function:${r[1]}`, archivo);
    }
    for (const r of limpio.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.([a-z_0-9]+)/gi)) {
      agregar(`view:${r[1]}`, archivo);
    }
    for (const r of limpio.matchAll(/create\s+policy\s+([a-z_0-9]+)\s+on\s+public\.([a-z_0-9]+)/gi)) {
      agregar(`policy:${r[1]} on ${r[2]}`, archivo);
    }
  }
  return m;
}

describe("supabase/migrations", () => {
  it("hay migraciones y sus nombres son <14 dígitos>_<nombre>.sql, únicos y en orden", () => {
    expect(archivos.length).toBeGreaterThan(0);
    for (const f of archivos) expect(f, f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    const versiones = archivos.map((f) => f.slice(0, 14));
    expect(new Set(versiones).size).toBe(versiones.length);
    expect(versiones).toEqual([...versiones].sort());
  });

  it("cada función, vista y política se define una sola vez (salvo las capas justificadas)", () => {
    const repetidas = [...definiciones()]
      .filter(([clave, donde]) => donde.length > 1 && !(clave in REPETIDAS_A_PROPOSITO))
      .map(([clave, donde]) => `${clave} → ${donde.join(", ")}`);
    expect(repetidas).toEqual([]);
  });

  it("las repeticiones permitidas siguen existiendo (si ya no se repiten, quítalas de la lista)", () => {
    const d = definiciones();
    for (const clave of Object.keys(REPETIDAS_A_PROPOSITO)) {
      expect(d.get(clave)?.length ?? 0, clave).toBeGreaterThan(1);
    }
  });
});
