import { describe, expect, it } from "vitest";
import {
  CONTRASENA_MAX,
  CONTRASENA_MIN,
  instruccionesDeIngreso,
  nombreClave,
  validarContrasena,
  validarCorreo,
  validarNombre,
} from "@/lib/equipo";

const error = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

describe("nombreClave", () => {
  it("compara sin mayúsculas, tildes ni espacios de más", () => {
    expect(nombreClave("  PÓLO   Pérez ")).toBe("polo perez");
    expect(nombreClave("María")).toBe(nombreClave("maria"));
  });
});

describe("validarNombre", () => {
  it("recorta, junta espacios y acepta tildes, punto, guion y apóstrofo", () => {
    expect(validarNombre("  Carlos   Pérez ")).toEqual({ ok: true, valor: "Carlos Pérez" });
    expect(validarNombre("Ana-María O'Neil Jr.")).toEqual({ ok: true, valor: "Ana-María O'Neil Jr." });
    expect(validarNombre("Ñoño")).toMatchObject({ ok: true });
  });

  it("rechaza muy corto, muy largo, números o símbolos", () => {
    expect(error(validarNombre("A"))).toMatch(/al menos 2/);
    expect(error(validarNombre(""))).toMatch(/al menos 2/);
    expect(error(validarNombre(undefined))).toMatch(/al menos 2/);
    expect(error(validarNombre("a".repeat(41)))).toMatch(/hasta 40/);
    for (const malo of ["Carlos 2", "<b>Carlos</b>", "Carlos@x", "1Carlos", "-Carlos"]) {
      expect(error(validarNombre(malo)), malo).toMatch(/solo puede llevar letras/);
    }
  });

  it("«Polo» y «Soporte técnico» están reservados, con cualquier mayúscula o tilde", () => {
    for (const reservado of ["Polo", "polo", " PÓLO ", "Soporte técnico", "soporte tecnico", "Soporte"]) {
      expect(error(validarNombre(reservado)), reservado).toMatch(/reservado/);
    }
    expect(validarNombre("Polo Andrés")).toMatchObject({ ok: true });
  });
});

describe("validarCorreo", () => {
  it("normaliza a minúsculas y exige forma de correo", () => {
    expect(validarCorreo("  Ayudante@Correo.COM ")).toEqual({ ok: true, valor: "ayudante@correo.com" });
    for (const malo of ["", "sin-arroba", "a@b", "a b@c.com", "@c.com", undefined, 5, `${"a".repeat(120)}@x.com`]) {
      expect(error(validarCorreo(malo)), String(malo)).toBe("Escribe un correo válido.");
    }
  });
});

describe("validarContrasena", () => {
  it("acepta una larga con letras y números", () => {
    expect(validarContrasena("Taller2026Segura")).toMatchObject({ ok: true });
    expect(validarContrasena("Zx9Kp3Lm7Qw2Rt5")).toMatchObject({ ok: true });
    expect(validarContrasena("a1".repeat(CONTRASENA_MIN))).toMatchObject({ ok: false }); // solo dos caracteres distintos
  });

  it("rechaza corta, larga, sin números, sin letras o repetitiva", () => {
    expect(error(validarContrasena("Corta1"))).toMatch(new RegExp(`al menos ${CONTRASENA_MIN}`));
    expect(error(validarContrasena(`a1${"b".repeat(CONTRASENA_MAX)}`))).toMatch(new RegExp(`hasta ${CONTRASENA_MAX}`));
    expect(error(validarContrasena("SoloLetrasAquiMuyLarga"))).toMatch(/letras y números/);
    expect(error(validarContrasena("123456789012345"))).toMatch(/letras y números/);
    expect(error(validarContrasena("aaaaaaaaaaaa1"))).toMatch(/repetitiva/);
    expect(error(validarContrasena(undefined))).toMatch(/al menos/);
  });
});

describe("instruccionesDeIngreso", () => {
  it("lleva el enlace, el correo y la contraseña temporal, y dice dónde cambiarla", () => {
    const t = instruccionesDeIngreso({ url: "https://polo.example", correo: "a@b.co", contrasena: "Xy7abc" });
    expect(t).toContain("Enlace: https://polo.example");
    expect(t).toContain("Correo: a@b.co");
    expect(t).toContain("Contraseña temporal: Xy7abc");
    expect(t).toMatch(/Mi cuenta/);
  });
});
