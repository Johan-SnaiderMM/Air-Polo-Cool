import { describe, expect, it } from "vitest";
import { citaDeLaEleccion, ELECCION_APARTE, eleccionPorDefecto, faltaElegirCita, type CitaDeVehiculo } from "@/lib/agenda";

/** Qué cita se propone, cuándo se pregunta y cuál cierra la orden al recibir un vehículo. */
const cita = (id: string, esHoy: boolean): CitaDeVehiculo => ({
  id,
  fechaHora: "2026-10-02T14:30:00.000Z",
  tipo: "servicio",
  esHoy,
  etiquetaDia: esHoy ? "Hoy" : "Mañana",
  horaTexto: "9:30 a. m.",
});
const hoy = cita("hoy", true);
const manana = cita("manana", false);

describe("citas del vehículo al crear una orden", () => {
  it("la cita de hoy viene elegida; las de los próximos días NO se asumen (hay que preguntar)", () => {
    expect(eleccionPorDefecto([hoy, manana], null)).toBe("hoy");
    expect(eleccionPorDefecto([manana], null)).toBeUndefined();
    expect(eleccionPorDefecto([], null)).toBeUndefined();
  });

  it("si se llega desde la agenda, esa cita viene elegida aunque sea de otro día; si ya no está, cae a la de hoy", () => {
    expect(eleccionPorDefecto([hoy, manana], "manana")).toBe("manana");
    expect(eleccionPorDefecto([hoy], "otra")).toBe("hoy");
    expect(eleccionPorDefecto([manana], "otra")).toBeUndefined();
  });

  it("solo se pregunta cuando hay citas y falta responder; «aparte» es una respuesta que no cierra nada", () => {
    expect(faltaElegirCita([manana], undefined)).toBe(true);
    expect(faltaElegirCita([manana], ELECCION_APARTE)).toBe(false);
    expect(faltaElegirCita([manana], "manana")).toBe(false);
    expect(faltaElegirCita([], undefined)).toBe(false); // sin citas no hay nada que preguntar
  });

  it("la orden cierra la cita elegida y ninguna si es un ingreso aparte o no se eligió", () => {
    expect(citaDeLaEleccion("manana")).toBe("manana");
    expect(citaDeLaEleccion(ELECCION_APARTE)).toBeNull();
    expect(citaDeLaEleccion(undefined)).toBeNull();
  });
});
