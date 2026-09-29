import { describe, expect, it } from "vitest";
import {
  calcularFinGarantia,
  esUuid,
  normalizarPlaca,
  normalizarTelefono,
} from "@/lib/ordenes";

describe("normalizarTelefono", () => {
  it("asume Colombia para celulares de 10 dígitos", () => {
    expect(normalizarTelefono("300 123 4567")).toBe("+573001234567");
    expect(normalizarTelefono("(300) 123-4567")).toBe("+573001234567");
  });
  it("acepta 57 + 10 dígitos y formato internacional", () => {
    expect(normalizarTelefono("573001234567")).toBe("+573001234567");
    expect(normalizarTelefono("+57 300 123 4567")).toBe("+573001234567");
    expect(normalizarTelefono("+1 415 555 2671")).toBe("+14155552671");
  });
  it("rechaza números inválidos (misma regla que la BD)", () => {
    expect(normalizarTelefono("")).toBeNull();
    expect(normalizarTelefono("12345")).toBeNull();
    expect(normalizarTelefono("2001234567")).toBeNull(); // no empieza por 3
    expect(normalizarTelefono("+0123456789")).toBeNull();
    expect(normalizarTelefono("abc")).toBeNull();
  });
});

describe("normalizarPlaca", () => {
  it("pasa a mayúsculas y quita separadores (como el trigger)", () => {
    expect(normalizarPlaca("abc-123")).toBe("ABC123");
    expect(normalizarPlaca(" ab c 12d ")).toBe("ABC12D");
  });
});

describe("calcularFinGarantia", () => {
  it("suma los días al día calendario de Bogotá", () => {
    expect(calcularFinGarantia("2026-03-10T15:00:00Z", 30)).toBe("2026-04-09");
  });
  it("usa la fecha de Bogotá, no la UTC (madrugada UTC = noche anterior en Bogotá)", () => {
    // 2026-03-11 02:00 UTC = 2026-03-10 21:00 en Bogotá (UTC-5)
    expect(calcularFinGarantia("2026-03-11T02:00:00Z", 1)).toBe("2026-03-11");
  });
  it("cruza cambio de año", () => {
    expect(calcularFinGarantia("2026-12-20T12:00:00Z", 30)).toBe("2027-01-19");
  });
  it("devuelve null sin garantía", () => {
    expect(calcularFinGarantia("2026-03-10T15:00:00Z", 0)).toBeNull();
  });
});

describe("esUuid", () => {
  it("valida el formato", () => {
    expect(esUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(esUuid("no-es-uuid")).toBe(false);
    expect(esUuid("123e4567-e89b-12d3-a456-42661417400")).toBe(false);
  });
});
