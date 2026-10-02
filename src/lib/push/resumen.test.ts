import { describe, expect, it } from "vitest";
import { armarAviso } from "@/lib/push/resumen";

describe("aviso de las 7:00 a. m. (citas de hoy)", () => {
  const dia = (total: number, sinRecordar: number, atrasadas = 0) => armarAviso({ franja: "dia", total, sinRecordar, atrasadas });

  it("dice cuántas citas hay y cuántas faltan por recordar", () => {
    expect(dia(3, 2)).toEqual({ titulo: "Agenda de hoy", cuerpo: "3 citas hoy · 2 por recordar", url: "/agenda", etiqueta: "agenda-dia" });
  });

  it("si todas ya se recordaron, lo dice: no hay nada pendiente por avisar", () => {
    expect(dia(3, 0)?.cuerpo).toBe("3 citas hoy · todas ya recordadas");
    expect(dia(1, 0)?.cuerpo).toBe("1 cita hoy · ya recordada");
  });

  it("con una sola cita, «por recordar» sin repetir el número", () => {
    expect(dia(1, 1)?.cuerpo).toBe("1 cita hoy · por recordar");
  });

  it("menciona las atrasadas sin atender de días anteriores", () => {
    expect(dia(2, 1, 1)?.cuerpo).toBe("2 citas hoy · 1 por recordar · 1 atrasada sin atender");
    expect(dia(2, 0, 3)?.cuerpo).toBe("2 citas hoy · todas ya recordadas · 3 atrasadas sin atender");
    expect(dia(0, 0, 2)?.cuerpo).toBe("Sin citas hoy · 2 atrasadas sin atender");
  });

  it("sin citas ni atrasadas no avisa nada", () => {
    expect(dia(0, 0, 0)).toBeNull();
  });
});

describe("aviso de las 5:30 p. m. (citas de mañana)", () => {
  const tarde = (total: number, sinRecordar: number, atrasadas = 0) => armarAviso({ franja: "tarde", total, sinRecordar, atrasadas });

  it("resume las de mañana para recordarlas hoy", () => {
    expect(tarde(2, 2)).toEqual({ titulo: "Agenda de mañana", cuerpo: "2 citas mañana · 2 por recordar", url: "/agenda", etiqueta: "agenda-tarde" });
    expect(tarde(2, 0)?.cuerpo).toBe("2 citas mañana · todas ya recordadas");
    expect(tarde(1, 1)?.cuerpo).toBe("1 cita mañana · por recordar");
  });

  it("no mezcla las atrasadas (eso es del aviso de la mañana) ni avisa si mañana no hay nada", () => {
    expect(tarde(2, 1, 5)?.cuerpo).toBe("2 citas mañana · 1 por recordar");
    expect(tarde(0, 0, 5)).toBeNull();
  });

  it("cada franja tiene su etiqueta: el de la tarde no reemplaza al de la mañana", () => {
    const delDia = armarAviso({ franja: "dia", total: 1, sinRecordar: 1, atrasadas: 0 });
    expect(delDia?.etiqueta).toBe("agenda-dia");
    expect(tarde(1, 1)?.etiqueta).toBe("agenda-tarde");
  });
});
