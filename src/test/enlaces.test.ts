import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auditoría de enlaces rotos: cada enlace o redirección interna del código (href, router.push, redirect…)
 * debe llevar a una ruta que exista en src/app. Si se renombra o borra una pantalla y queda un enlace
 * apuntándole, falla aquí en vez de aparecer como un 404 en el teléfono del taller.
 */
const RAIZ = join(process.cwd(), "src");

function archivos(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else salida.push(ruta);
  }
  return salida;
}
const todos = archivos(RAIZ);

/** Rutas reales: carpetas de src/app con page.tsx o route.ts (los grupos «(app)» no cuentan en la dirección). */
const rutas = todos
  .map((f) => relative(join(RAIZ, "app"), f).replace(/\\/g, "/"))
  .filter((rel) => /(^|\/)(page\.tsx|route\.ts)$/.test(rel))
  .map((rel) => "/" + rel.split("/").slice(0, -1).filter((s) => !/^\(.+\)$/.test(s)).join("/"));

const coincide = (ruta: string) =>
  rutas.some((r) => (r === "/" ? ruta === "/" : new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\//g, "\\/") + "$").test(ruta)));

/** Archivos que Next sirve por convención, sin page.tsx. */
const POR_CONVENCION = new Set(["/manifest.webmanifest", "/robots.txt", "/sw.js", "/offline.html", "/logo.png", "/icon.png", "/apple-icon.png"]);

const PATRON = /(?:href=|href: |push\(|replace\(|redirect\(|assign\()\s*\{?\s*(?:"(\/[^"]*)"|`(\/[^`]*)`|'(\/[^']*)')/g;
const enlaces = todos
  .filter((f) => /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f))
  .flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(PATRON)].map((m) => {
      const url = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, "X");
      return { archivo: relative(RAIZ, f).replace(/\\/g, "/"), url, ruta: url.split(/[?#]/)[0].replace(/\/+$/, "") || "/" };
    })
  )
  .filter((e) => !e.ruta.startsWith("//") && !POR_CONVENCION.has(e.ruta));

describe("enlaces internos", () => {
  it("encuentra las rutas y los enlaces (si cambia la estructura, este chequeo avisa en vez de pasar en falso)", () => {
    expect(rutas).toEqual(expect.arrayContaining(["/", "/login", "/ordenes", "/ordenes/[id]", "/agenda", "/orden/[token]", "/legal/privacidad"]));
    expect(enlaces.length).toBeGreaterThan(40);
  });

  it("ningún enlace o redirección interna apunta a una ruta que no existe", () => {
    const rotos = enlaces.filter((e) => !coincide(e.ruta)).map((e) => `${e.archivo}: ${e.url}`);
    expect(rotos).toEqual([]);
  });

  it("las pantallas principales están enlazadas desde algún lado (nada queda huérfano por accidente)", () => {
    const destinos = new Set(enlaces.map((e) => e.ruta));
    for (const esperada of ["/agenda", "/ordenes", "/vehiculos", "/inventario", "/caja-menor", "/cartera", "/cotizaciones", "/garantias", "/legal/privacidad", "/legal/aviso", "/login"]) {
      expect(destinos.has(esperada), esperada).toBe(true);
    }
  });
});
