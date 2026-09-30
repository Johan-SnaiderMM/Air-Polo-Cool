import { describe, expect, it } from "vitest";
import { esErrorDeMigracion, mensajeDeError } from "@/lib/errores";
import { numeroOpcional, texto } from "@/lib/formularios";
import { MEDIO_PAGO_LABEL } from "@/lib/caja";

describe("formularios", () => {
  it("texto: recorta espacios y devuelve vacío si falta o no es texto", () => {
    const fd = new FormData();
    fd.set("a", "  hola  ");
    fd.set("archivo", new Blob(["x"]), "x.txt");
    expect(texto(fd, "a")).toBe("hola");
    expect(texto(fd, "no-existe")).toBe("");
    expect(texto(fd, "archivo")).toBe("");
  });

  it("numeroOpcional: vacío → null, coma decimal, y NaN para basura", () => {
    expect(numeroOpcional("")).toBeNull();
    expect(numeroOpcional("   ")).toBeNull();
    expect(numeroOpcional("12,5")).toBe(12.5);
    expect(numeroOpcional("0")).toBe(0);
    expect(numeroOpcional("abc")).toBeNaN();
    expect(numeroOpcional("Infinity")).toBeNaN();
  });
});

describe("errores de migración", () => {
  it("reconoce los códigos de tabla, función o columna ausentes", () => {
    for (const code of ["PGRST202", "PGRST204", "PGRST205", "42P01", "42703"]) {
      expect(esErrorDeMigracion({ code })).toBe(true);
    }
    expect(esErrorDeMigracion({ code: "23505" })).toBe(false);
    expect(esErrorDeMigracion({})).toBe(false);
    expect(esErrorDeMigracion(null)).toBe(false);
  });

  it("mensajeDeError los traduce a «falta ejecutar el SQL»", () => {
    expect(mensajeDeError({ code: "PGRST205", message: "no table" })).toMatch(/Falta ejecutar/);
  });
});

describe("medio de pago", () => {
  it("una sola tabla de etiquetas cubre todos los medios", () => {
    expect(Object.keys(MEDIO_PAGO_LABEL).sort()).toEqual(["efectivo", "otro", "tarjeta", "transferencia"]);
  });
});
