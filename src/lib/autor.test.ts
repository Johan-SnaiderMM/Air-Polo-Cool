import { describe, expect, it } from "vitest";
import { AUTOR_MAX, autorDeUsuario, autorONull, esUsuarioSoporte } from "@/lib/autor";

describe("sello de autoría desde la sesión", () => {
  it("con perfil, el sello es el nombre del perfil (aunque sea soporte o admin)", () => {
    expect(autorDeUsuario({ app_metadata: { rol: "operario" } }, { nombre: "Carlos Pérez" })).toBe("Carlos Pérez");
    expect(autorDeUsuario({ app_metadata: { rol: "admin", soporte: true } }, { nombre: "Soporte técnico" })).toBe("Soporte técnico");
  });

  it("sin perfil (migración sin ejecutar o usuario anterior): soporte firma como «Soporte técnico»; el resto, como «Polo»", () => {
    expect(autorDeUsuario({ app_metadata: { rol: "admin", soporte: true } })).toBe("Soporte técnico");
    expect(autorDeUsuario({ app_metadata: { rol: "operario" } })).toBe("Polo");
    expect(autorDeUsuario({ app_metadata: { rol: "admin" } }, null)).toBe("Polo");
    expect(autorDeUsuario(null)).toBe("Polo");
  });

  it("solo cuenta la marca booleana true (no un texto ni un número)", () => {
    for (const valor of ["true", 1, "soporte", null, undefined]) {
      expect(esUsuarioSoporte({ app_metadata: { soporte: valor } }), String(valor)).toBe(false);
    }
    expect(esUsuarioSoporte({ app_metadata: { soporte: true } })).toBe(true);
    expect(esUsuarioSoporte(undefined)).toBe(false);
  });

  it("un valor externo solo se acepta si tiene forma de nombre (texto de 1 a 40 caracteres, recortado)", () => {
    expect(autorONull("Polo")).toBe("Polo");
    expect(autorONull("  Ana María  ")).toBe("Ana María");
    expect(autorONull("a".repeat(AUTOR_MAX))).toHaveLength(AUTOR_MAX);
    for (const malo of ["", "   ", "a".repeat(AUTOR_MAX + 1), 7, null, undefined, {}, ["Polo"]]) {
      expect(autorONull(malo), String(malo)).toBeNull();
    }
  });
});
