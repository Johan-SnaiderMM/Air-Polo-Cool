import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  anioVehiculo,
  autorSchema,
  campo,
  categoriaGasto,
  esFechaIso,
  fechaIso,
  idUuid,
  idUuidOpcional,
  montoPositivo,
  numeroDeTexto,
  placa,
  textoObligatorio,
  textoOpcional,
  validar,
  whatsapp,
} from "@/lib/esquemas/comunes";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("esFechaIso", () => {
  it("acepta solo fechas reales en formato AAAA-MM-DD", () => {
    expect(esFechaIso("2026-09-30")).toBe(true);
    expect(esFechaIso("2024-02-29")).toBe(true);
    for (const malo of ["2026-02-31", "2026-13-01", "30/09/2026", "2026-9-3", "", null, 20260930]) {
      expect(esFechaIso(malo), String(malo)).toBe(false);
    }
  });
});

describe("campos", () => {
  const uno = <T>(esquema: z.ZodType<T>, valor: unknown) => validar(esquema, valor);

  it("campo(): convierte o falla con su mensaje, también cuando el dato falta", () => {
    const s = z.object({ n: campo((v) => (v === 1 ? "uno" : undefined), "Debe ser uno") });
    expect(validar(s, { n: 1 })).toEqual({ ok: true, valor: { n: "uno" } });
    expect(validar(s, { n: 2 })).toEqual({ ok: false, error: "Debe ser uno" });
    expect(validar(s, {})).toEqual({ ok: false, error: "Debe ser uno" });
  });

  it("idUuid / idUuidOpcional", () => {
    expect(uno(idUuid("Id inválido"), ID)).toEqual({ ok: true, valor: ID });
    expect(uno(idUuid("Id inválido"), "x")).toEqual({ ok: false, error: "Id inválido" });
    expect(uno(idUuid("Id inválido"), 123)).toEqual({ ok: false, error: "Id inválido" });
    expect(uno(idUuidOpcional("Orden inválida"), null)).toEqual({ ok: true, valor: null });
    expect(uno(idUuidOpcional("Orden inválida"), undefined)).toEqual({ ok: true, valor: null });
    expect(uno(idUuidOpcional("Orden inválida"), "x")).toEqual({ ok: false, error: "Orden inválida" });
  });

  it("fechaIso, categoriaGasto y montoPositivo (redondea a centavos y respeta el tope)", () => {
    expect(uno(fechaIso(), "2026-09-30").ok).toBe(true);
    expect(uno(fechaIso(), "2026-02-31")).toEqual({ ok: false, error: "Fecha inválida." });
    expect(uno(categoriaGasto(), "flete_acarreo").ok).toBe(true);
    expect(uno(categoriaGasto(), "lujos")).toEqual({ ok: false, error: "Categoría inválida." });
    const m = montoPositivo("El monto debe ser mayor a 0.");
    expect(uno(m, 1234.567)).toEqual({ ok: true, valor: 1234.57 });
    for (const malo of [0, -1, Number.NaN, Infinity, "5", null, 10_000_000_000]) {
      expect(uno(m, malo).ok, String(malo)).toBe(false);
    }
  });

  it("textos: recortan, acotan y convierten lo vacío en null", () => {
    expect(uno(textoOpcional(5), "  abcdefgh ")).toEqual({ ok: true, valor: "abcde" });
    expect(uno(textoOpcional(), "   ")).toEqual({ ok: true, valor: null });
    expect(uno(textoOpcional(), 42)).toEqual({ ok: true, valor: null });
    expect(uno(textoObligatorio("Falta"), "  Ana ")).toEqual({ ok: true, valor: "Ana" });
    expect(uno(textoObligatorio("Falta"), " ")).toEqual({ ok: false, error: "Falta" });
  });

  it("autorSchema: un nombre de 1 a 40 caracteres (lo decide la base); lo demás se descarta sin rechazar", () => {
    expect(uno(autorSchema, "Polo")).toEqual({ ok: true, valor: "Polo" });
    expect(uno(autorSchema, "  Carlos Pérez ")).toEqual({ ok: true, valor: "Carlos Pérez" });
    expect(uno(autorSchema, "x".repeat(60))).toEqual({ ok: true, valor: null });
    expect(uno(autorSchema, "   ")).toEqual({ ok: true, valor: null });
    expect(uno(autorSchema, 42)).toEqual({ ok: true, valor: null });
    expect(uno(autorSchema, undefined)).toEqual({ ok: true, valor: null });
  });

  it("whatsapp y placa normalizan; año acepta texto o número", () => {
    const tel = uno(whatsapp(), "300 123 4567");
    expect(tel.ok && tel.valor).toMatch(/^\+57/);
    expect(uno(whatsapp(), "123")).toMatchObject({ ok: false, error: expect.stringContaining("WhatsApp") });
    expect(uno(placa(), "xyz-987")).toEqual({ ok: true, valor: "XYZ987" });
    expect(uno(placa(), "AB")).toMatchObject({ ok: false });
    expect(uno(anioVehiculo(), "2020")).toEqual({ ok: true, valor: 2020 });
    expect(uno(anioVehiculo(), 2018)).toEqual({ ok: true, valor: 2018 });
    expect(uno(anioVehiculo(), "")).toEqual({ ok: true, valor: null });
    expect(uno(anioVehiculo(), null)).toEqual({ ok: true, valor: null });
    for (const malo of ["1900", 2101, "20.5", "abc", true]) expect(uno(anioVehiculo(), malo).ok, String(malo)).toBe(false);
  });

  it("numeroDeTexto: vacío → valor por defecto, coma decimal, y la regla que se pida", () => {
    const entero = numeroDeTexto("Debe ser un entero ≥ 0", null, (n) => Number.isInteger(n) && n >= 0);
    expect(uno(entero, "")).toEqual({ ok: true, valor: null });
    expect(uno(entero, "85000")).toEqual({ ok: true, valor: 85000 });
    for (const malo of ["-1", "1.5", "abc"]) expect(uno(entero, malo), malo).toEqual({ ok: false, error: "Debe ser un entero ≥ 0" });
    expect(uno(numeroDeTexto("x", 0, (n) => n >= 0), "12,5")).toEqual({ ok: true, valor: 12.5 });
  });
});
