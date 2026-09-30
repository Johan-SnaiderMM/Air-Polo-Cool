import { describe, expect, it } from "vitest";
import { agregarHistorial, armarLineaHistorial, formatoMomento, lineasHistorial } from "@/lib/historial-estado";
import { resumenNotasTecnicas, resumenPertenencias } from "@/lib/pertenencias";
import type { Pertenencias } from "@/types/database";

describe("historial de estados", () => {
  const momento = new Date("2026-09-30T15:12:00Z"); // 10:12 en Colombia (UTC-5)

  it("formatea el momento en hora de Colombia", () => {
    expect(formatoMomento(momento)).toBe("30 sep 10:12");
    expect(formatoMomento(new Date("2027-01-01T03:05:00Z"))).toBe("31 dic 22:05");
  });

  it("arma la línea con autor, transición y nota", () => {
    expect(armarLineaHistorial({ momento, autor: "Polo", de: "diagnostico", a: "en_proceso", nota: "  llegó el  compresor " })).toBe(
      "30 sep 10:12 · Polo · Diagnóstico → En proceso · llegó el compresor"
    );
    expect(armarLineaHistorial({ momento, autor: null, de: "listo", a: "entregado", nota: "" })).toBe(
      "30 sep 10:12 · Listo → Entregado"
    );
  });

  it("agrega al final conservando lo anterior y muestra lo más reciente primero", () => {
    const n = agregarHistorial(agregarHistorial(null, "uno"), "dos");
    expect(n).toBe("uno\ndos");
    expect(lineasHistorial(n)).toEqual(["dos", "uno"]);
    expect(agregarHistorial("nota previa libre", "nueva")).toBe("nota previa libre\nnueva");
    expect(lineasHistorial(null)).toEqual([]);
  });

  it("si el texto crece demasiado descarta las líneas más antiguas, nunca la nueva", () => {
    const larga = Array.from({ length: 60 }, (_, i) => `${i} ${"x".repeat(80)}`).join("\n");
    const n = agregarHistorial(larga, "última");
    expect(n.length).toBeLessThanOrEqual(4000);
    expect(n.endsWith("última")).toBe(true);
    expect(n.startsWith("0 ")).toBe(false);
  });
});

describe("resúmenes de acordeones", () => {
  const base: Pertenencias = {
    carroceria: "sin_danos",
    llanta_repuesto: false,
    herramientas: false,
    documentos: false,
    objetos_valor: "",
    notas: "",
  };
  it("pertenencias", () => {
    expect(resumenPertenencias(null)).toBe("Sin registrar");
    expect(resumenPertenencias(base)).toBe("Registrado · sin novedades");
    expect(resumenPertenencias({ ...base, llanta_repuesto: true })).toBe("1 ítem registrado");
    expect(
      resumenPertenencias({ ...base, llanta_repuesto: true, documentos: true, carroceria: "rayones", objetos_valor: "gafas" })
    ).toBe("4 ítems registrados");
  });
  it("notas técnicas", () => {
    expect(resumenNotasTecnicas("", " ")).toBe("Sin notas");
    expect(resumenNotasTecnicas("fuga", "")).toBe("Diagnóstico registrado");
    expect(resumenNotasTecnicas("", "cambio")).toBe("Trabajos registrados");
    expect(resumenNotasTecnicas("a", "b")).toBe("Diagnóstico y trabajos registrados");
  });
});
