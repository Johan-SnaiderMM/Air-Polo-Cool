import { describe, expect, it } from "vitest";
import { CLAVE_TEMA, COLOR_BARRA, esOscuro, SCRIPT_TEMA } from "@/lib/tema";

/** Ejecuta el script de <head> con un navegador simulado y devuelve el atributo data-tema que dejó. */
function correrScript({ guardada, sistemaOscuro, ruta = "/", fallaAlmacenamiento = false }: {
  guardada?: string;
  sistemaOscuro: boolean;
  ruta?: string;
  fallaAlmacenamiento?: boolean;
}) {
  const atributos: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => {
      if (fallaAlmacenamiento) throw new Error("bloqueado");
      return k === CLAVE_TEMA ? (guardada ?? null) : null;
    },
  };
  const window = { matchMedia: true };
  const matchMedia = (consulta: string) => ({ matches: consulta.includes("dark") && sistemaOscuro });
  const document = { documentElement: { setAttribute: (k: string, v: string) => (atributos[k] = v) } };
  const location = { pathname: ruta };
  new Function("localStorage", "window", "matchMedia", "document", "location", SCRIPT_TEMA)(localStorage, window, matchMedia, document, location);
  return atributos["data-tema"] ?? null;
}

describe("esOscuro", () => {
  it("la elección guardada manda sobre el sistema; sin elección, sigue al sistema", () => {
    expect(esOscuro("oscuro", false)).toBe(true);
    expect(esOscuro("claro", true)).toBe(false);
    expect(esOscuro(null, true)).toBe(true);
    expect(esOscuro(null, false)).toBe(false);
    expect(esOscuro("basura", true)).toBe(true); // un valor desconocido se ignora
    expect(esOscuro("basura", false)).toBe(false);
  });
});

describe("script que se aplica antes de pintar", () => {
  it("se comporta igual que esOscuro en todas las combinaciones", () => {
    for (const guardada of [undefined, "oscuro", "claro", "basura"]) {
      for (const sistemaOscuro of [true, false]) {
        const esperado = esOscuro(guardada ?? null, sistemaOscuro) ? "dark" : null;
        expect(correrScript({ guardada, sistemaOscuro }), `${guardada} / sistema ${sistemaOscuro}`).toBe(esperado);
      }
    }
  });

  it("el portal público del cliente (/orden/…) siempre queda claro, aunque el teléfono sea oscuro", () => {
    expect(correrScript({ guardada: "oscuro", sistemaOscuro: true, ruta: "/orden/abc123" })).toBeNull();
    expect(correrScript({ sistemaOscuro: true, ruta: "/orden/abc123" })).toBeNull();
    // «/ordenes» (la lista del taller) NO es el portal.
    expect(correrScript({ guardada: "oscuro", sistemaOscuro: false, ruta: "/ordenes" })).toBe("dark");
  });

  it("si el navegador bloquea el almacenamiento, no falla y sigue al sistema", () => {
    expect(correrScript({ sistemaOscuro: true, fallaAlmacenamiento: true })).toBe("dark");
    expect(correrScript({ sistemaOscuro: false, fallaAlmacenamiento: true })).toBeNull();
  });

  it("es una sola línea sin saltos ni comillas invertidas (va incrustado tal cual en el HTML)", () => {
    expect(SCRIPT_TEMA).not.toMatch(/[\n`]/);
  });
});

describe("color de la barra", () => {
  it("claro y oscuro coinciden con el papel de cada tema", () => {
    expect(COLOR_BARRA).toEqual({ claro: "#f4f7fb", oscuro: "#0b1220" });
  });
});
