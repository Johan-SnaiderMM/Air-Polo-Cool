import { describe, expect, it } from "vitest";
import { validarContrasena } from "@/lib/equipo";
import { generarContrasena } from "@/lib/servidor/equipo";

describe("generarContrasena", () => {
  it("14 caracteres con mayúscula, minúscula y número, y sin los que se confunden (0 O 1 l I)", () => {
    for (let i = 0; i < 200; i++) {
      const c = generarContrasena();
      expect(c).toHaveLength(14);
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[a-z]/);
      expect(c).toMatch(/\d/);
      expect(c).not.toMatch(/[0O1lI]/);
    }
  });

  it("siempre cumple las reglas de contraseña de la app y no se repite", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = generarContrasena();
      expect(validarContrasena(c).ok, c).toBe(true);
      vistas.add(c);
    }
    expect(vistas.size).toBe(200);
  });

  it("respeta el largo pedido (nunca menos que las tres obligatorias)", () => {
    expect(generarContrasena(20)).toHaveLength(20);
    expect(generarContrasena(3)).toHaveLength(3);
  });
});
