import { describe, expect, it } from "vitest";
import { mensajeDeError } from "@/lib/errores";
import { admiteDecimales, nivelStock, redondearDinero } from "@/lib/inventario";

describe("nivelStock", () => {
  it("agotado, crítico y ok (crítico = stock <= mínimo, como la vista de reposición)", () => {
    expect(nivelStock(0, 5)).toBe("agotado");
    expect(nivelStock(5, 5)).toBe("critico");
    expect(nivelStock(3, 5)).toBe("critico");
    expect(nivelStock(6, 5)).toBe("ok");
    expect(nivelStock(1, 0)).toBe("ok");
  });
});

describe("unidades y dinero", () => {
  it("solo las unidades físicas prohíben decimales", () => {
    expect(admiteDecimales("unidad")).toBe(false);
    expect(admiteDecimales("gramo")).toBe(true);
    expect(admiteDecimales("libra")).toBe(true);
    expect(admiteDecimales("onza")).toBe(true);
  });
  it("redondea a 2 decimales sin ruido de punto flotante", () => {
    expect(redondearDinero(0.1 + 0.2)).toBe(0.3);
    expect(redondearDinero(19.999)).toBe(20);
    expect(redondearDinero(12.344)).toBe(12.34);
  });
});

describe("mensajeDeError", () => {
  it("conserva el mensaje del trigger de stock y agrega la pista", () => {
    const m = mensajeDeError({
      code: "23514",
      message: 'Stock insuficiente de "Filtro" (disponible: 1 unidad, requerido: 2)',
      hint: "Registra primero la compra/reposición en inventario.",
    });
    expect(m).toContain("Stock insuficiente de");
    expect(m).toContain("Registra primero");
  });
  it("traduce códigos comunes", () => {
    expect(mensajeDeError({ code: "42501", message: "permission denied for table x" })).toContain("permisos");
    expect(
      mensajeDeError({ code: "23505", message: 'duplicate key value violates unique constraint "k"' })
    ).toContain("Ya existe");
    expect(
      mensajeDeError({ code: "PGRST204", message: "Could not find the 'diagnostico_inicial' column" })
    ).toContain("fase 2");
    expect(mensajeDeError({ code: "PGRST202", message: "Could not find the function" })).toContain("supabase/migrations");
  });
  it("respeta los mensajes en español de nuestras funciones SQL", () => {
    expect(
      mensajeDeError({ code: "23514", message: "El motivo de la anulación es obligatorio" })
    ).toBe("El motivo de la anulación es obligatorio");
    expect(
      mensajeDeError({ code: "23505", message: "Ya existe un cierre vigente para 2026-09-29." })
    ).toContain("cierre vigente");
    expect(
      mensajeDeError({ code: "23514", message: 'new row for relation "x" violates check constraint "c"' })
    ).toContain("reglas");
  });
  it("orden cerrada", () => {
    expect(
      mensajeDeError({ code: "23514", message: "La orden está entregado y no admite cambios de repuestos" })
    ).toContain("no admite cambios");
  });
});
