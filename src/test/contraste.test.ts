import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auditoría de contraste (WCAG 2.1 AA) de los colores del sistema de diseño, en modo claro y oscuro. Lee los
 * colores de los propios archivos CSS, así que si alguien cambia un color y rompe la legibilidad, falla aquí.
 * Texto normal: 4,5:1. Iconos y elementos de interfaz: 3:1.
 */
const css = (nombre: string) => readFileSync(join(process.cwd(), "src", "app", nombre), "utf8");
const globales = css("globals.css");
const oscuroCss = css("tema-oscuro.css");

const variables = (texto: string) =>
  Object.fromEntries([...texto.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

const temaClaro: Record<string, string> = {
  white: "#ffffff",
  ...Object.fromEntries(Object.entries(variables(globales.slice(globales.indexOf("@theme {"), globales.indexOf("@theme inline")))).map(([k, v]) => [k.replace(/^color-/, ""), v])),
};
const bloqueOscuro = oscuroCss.slice(oscuroCss.indexOf(':root[data-tema="dark"] {'), oscuroCss.indexOf("/* Superficies */"));
const temaOscuro: Record<string, string> = {
  ...temaClaro,
  ...Object.fromEntries(Object.entries(variables(bloqueOscuro)).map(([k, v]) => [k.replace(/^color-/, ""), v])),
};

/** Color de texto que el tema oscuro fija para una clase (p. ej. .text-sage-700 → #9ccbad). */
function colorDeClaseOscura(clase: string): string {
  const m = oscuroCss.match(new RegExp(`${clase.replace(/\./g, "\\.")}[^{]*\\{\\s*color:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`El tema oscuro no define color para ${clase}`);
  return m[1];
}
/** Igual que arriba, pero para grises dentro de «.bg-ink» en cada tema. */
const colorEnTarjetaOscura = (css: string, selector: string) => {
  const m = css.match(new RegExp(`${selector.replace(/[.\[\]="-]/g, "\\$&")}\\s*\\{\\s*color:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`No encontré ${selector}`);
  return m[1];
};

const canal = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
const lineal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminancia = (h: string) => 0.2126 * lineal(canal(h, 1)) + 0.7152 * lineal(canal(h, 3)) + 0.0722 * lineal(canal(h, 5));
export const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("el lector de colores", () => {
  it("encuentra las paletas (si cambia el formato de los CSS, este chequeo avisa en vez de pasar en falso)", () => {
    expect(temaClaro["stone-500"]).toMatch(/^#/);
    expect(temaClaro.paper).toBe("#f4f7fb");
    expect(temaOscuro.paper).toBe("#0b1220");
    expect(temaOscuro.superficie).toMatch(/^#/);
    expect(temaOscuro["relleno-ink"]).toMatch(/^#/);
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});

describe("modo claro", () => {
  const texto = (t: string, fondos: string[], minimo = 4.5) =>
    it(`${t} se lee (≥ ${minimo}:1) sobre ${fondos.join(", ")}`, () => {
      for (const f of fondos) expect(contraste(temaClaro[t], temaClaro[f]), `${t} sobre ${f}`).toBeGreaterThanOrEqual(minimo);
    });

  texto("ink", ["white", "paper", "stone-50", "stone-100"]);
  texto("stone-700", ["white", "paper", "stone-100"]);
  texto("stone-600", ["white", "paper", "stone-100"]);
  // El gris de apoyo (220 usos): debe pasar AA hasta sobre el gris más oscuro donde se usa.
  texto("stone-500", ["white", "paper", "stone-50", "stone-100"]);
  // Iconos y elementos de interfaz.
  texto("stone-400", ["white"], 3);

  it("las insignias de estado (texto oscuro sobre tinte suave) pasan AA", () => {
    const pares = [["sage-700", "sage-50"], ["sage-800", "sage-100"], ["ochre-700", "ochre-50"], ["ochre-800", "ochre-100"], ["brick-700", "brick-50"], ["brick-700", "brick-100"], ["dusk-800", "dusk-100"], ["accent-700", "accent-100"]];
    for (const [t, f] of pares) expect(contraste(temaClaro[t], temaClaro[f]), `${t} sobre ${f}`).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto de estado sobre tarjeta blanca pasa AA (verde, ocre y rojo)", () => {
    for (const t of ["sage-700", "ochre-700", "brick-600", "brick-700"]) expect(contraste(temaClaro[t], "#ffffff"), t).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto blanco sobre los botones de color pasa AA", () => {
    for (const f of ["accent-600", "ink", "sage-700", "brick-600", "brick-700"]) expect(contraste("#ffffff", temaClaro[f]), f).toBeGreaterThanOrEqual(4.5);
  });

  it("los grises sobre las tarjetas oscuras (bg-ink) y el enlace hielo pasan AA", () => {
    const tarjeta = temaClaro.ink;
    for (const g of ["text-stone-300", "text-stone-400", "text-stone-500"]) {
      expect(contraste(colorEnTarjetaOscura(globales, `.bg-ink .${g}`), tarjeta), g).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(temaClaro["ice-300"], tarjeta)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(temaClaro.paper, tarjeta)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("modo oscuro", () => {
  const superficies = ["superficie", "paper", "stone-50", "stone-100"];

  it("el texto principal y los grises de texto se leen sobre todas las superficies", () => {
    for (const t of ["ink", "stone-700", "stone-600", "stone-500"]) {
      for (const f of superficies) expect(contraste(temaOscuro[t], temaOscuro[f]), `${t} sobre ${f}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("los iconos y el gris terciario pasan 3:1 (y AA sobre la tarjeta y la página)", () => {
    for (const f of superficies) expect(contraste(temaOscuro["stone-400"], temaOscuro[f]), f).toBeGreaterThanOrEqual(3);
    for (const f of ["superficie", "paper"]) expect(contraste(temaOscuro["stone-400"], temaOscuro[f]), f).toBeGreaterThanOrEqual(4.5);
  });

  it("las insignias de estado (texto claro sobre tinte oscuro) pasan AA", () => {
    const pares: [string, string][] = [
      [".text-sage-700", "sage-50"], [".text-sage-700", "sage-100"], [".text-ochre-700", "ochre-50"], [".text-ochre-700", "ochre-100"],
      [".text-brick-700", "brick-50"], [".text-brick-700", "brick-100"], [".text-dusk-800", "dusk-100"], [".text-accent-700", "accent-100"],
    ];
    for (const [clase, fondo] of pares) expect(contraste(colorDeClaseOscura(clase), temaOscuro[fondo]), `${clase} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto de estado sobre la tarjeta oscura pasa AA", () => {
    for (const clase of [".text-sage-700", ".text-ochre-700", ".text-brick-700"]) {
      expect(contraste(colorDeClaseOscura(clase), temaOscuro.superficie), clase).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("los botones (blanco sobre el relleno y los colores de acción) pasan AA", () => {
    for (const f of ["relleno-ink", "accent-600", "sage-700", "brick-600"]) expect(contraste("#ffffff", temaOscuro[f]), f).toBeGreaterThanOrEqual(4.5);
  });

  it("los textos sobre la tarjeta destacada (relleno azul) pasan AA", () => {
    const relleno = temaOscuro["relleno-ink"];
    expect(contraste(colorDeClaseOscura(".text-paper"), relleno)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(temaOscuro["ice-300"], relleno)).toBeGreaterThanOrEqual(4.5);
    for (const g of ["text-stone-300", "text-stone-400", "text-stone-500"]) {
      const c = colorEnTarjetaOscura(oscuroCss, `:root[data-tema="dark"] .bg-ink .${g}`);
      expect(contraste(c, relleno), g).toBeGreaterThanOrEqual(4.5);
    }
  });
});
