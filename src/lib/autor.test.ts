import { describe, expect, it } from "vitest";
import { autorDeUsuario, autorONull, esUsuarioSoporte } from "@/lib/autor";

describe("sello de autoría desde la sesión", () => {
  it("soporte firma como «Soporte técnico»; cualquier otro usuario, como «Polo»", () => {
    expect(autorDeUsuario({ app_metadata: { rol: "admin", soporte: true } })).toBe("Soporte técnico");
    expect(autorDeUsuario({ app_metadata: { rol: "operario" } })).toBe("Polo");
    expect(autorDeUsuario({ app_metadata: { rol: "admin" } })).toBe("Polo");
    expect(autorDeUsuario(null)).toBe("Polo");
  });

  it("solo cuenta la marca booleana true (no un texto ni un número)", () => {
    for (const valor of ["true", 1, "soporte", null, undefined]) {
      expect(esUsuarioSoporte({ app_metadata: { soporte: valor } }), String(valor)).toBe(false);
    }
    expect(esUsuarioSoporte({ app_metadata: { soporte: true } })).toBe(true);
    expect(esUsuarioSoporte(undefined)).toBe(false);
  });

  it("un valor externo que no sea uno de los dos operadores se descarta", () => {
    expect(autorONull("Polo")).toBe("Polo");
    expect(autorONull("Soporte técnico")).toBe("Soporte técnico");
    expect(autorONull("Hacker")).toBeNull();
  });
});
