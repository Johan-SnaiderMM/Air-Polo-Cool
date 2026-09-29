import { describe, expect, it } from "vitest";
import {
  esCategoria,
  etiquetaMes,
  mesActual,
  mesAnterior,
  mesSiguiente,
  normalizarMes,
  rangoMes,
} from "@/lib/caja";

describe("meses", () => {
  it("calcula mes anterior y siguiente cruzando el año", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSiguiente("2026-12")).toBe("2027-01");
    expect(mesSiguiente("2026-02")).toBe("2026-03");
  });
  it("rango semiabierto del mes", () => {
    expect(rangoMes("2026-02")).toEqual({ desde: "2026-02-01", hasta: "2026-03-01" });
    expect(rangoMes("2026-12")).toEqual({ desde: "2026-12-01", hasta: "2027-01-01" });
  });
  it("normalizarMes rechaza basura y cae al mes actual", () => {
    expect(normalizarMes("2026-05")).toBe("2026-05");
    expect(normalizarMes("2026-13")).toBe(mesActual());
    expect(normalizarMes("abc")).toBe(mesActual());
    expect(normalizarMes(undefined)).toBe(mesActual());
    expect(normalizarMes("2026-05'; drop")).toBe(mesActual());
  });
  it("etiqueta en español con mayúscula inicial", () => {
    expect(etiquetaMes("2026-09")).toBe("Septiembre de 2026");
  });
});

describe("esCategoria", () => {
  it("solo acepta las categorías del enum", () => {
    expect(esCategoria("ayudante")).toBe(true);
    expect(esCategoria("flete_acarreo")).toBe(true);
    expect(esCategoria("otra")).toBe(false);
    expect(esCategoria(undefined)).toBe(false);
  });
});
