import { describe, expect, it } from "vitest";
import {
  agruparCitas,
  cuandoCita,
  diaLegible,
  esHora,
  etiquetaDiaAgenda,
  horaLegible,
  instanteBogota,
  partesBogota,
  sumarDias,
} from "@/lib/agenda";

describe("hora de Colombia", () => {
  it("convierte fecha + hora del taller a instante (UTC-5, sin horario de verano) y de vuelta", () => {
    expect(instanteBogota("2026-10-02", "09:30")).toBe("2026-10-02T14:30:00.000Z");
    expect(partesBogota("2026-10-02T14:30:00.000Z")).toEqual({ fecha: "2026-10-02", hora: "09:30" });
  });

  it("una cita de la noche cae en el día correcto aunque en UTC ya sea el siguiente", () => {
    const noche = instanteBogota("2026-10-02", "21:15"); // 02:15 UTC del día 3
    expect(noche).toBe("2026-10-03T02:15:00.000Z");
    expect(partesBogota(noche)).toEqual({ fecha: "2026-10-02", hora: "21:15" });
    expect(partesBogota(instanteBogota("2026-12-31", "23:59"))).toEqual({ fecha: "2026-12-31", hora: "23:59" });
  });

  it("la medianoche es 00:00 (no 24:00)", () => {
    expect(partesBogota(instanteBogota("2026-10-02", "00:00"))).toEqual({ fecha: "2026-10-02", hora: "00:00" });
  });

  it("valida el formato de hora de <input type=time>", () => {
    for (const bien of ["00:00", "09:30", "23:59"]) expect(esHora(bien), bien).toBe(true);
    for (const mal of ["24:00", "9:30", "09:60", "09:30:00", "", null, undefined, 930]) expect(esHora(mal), String(mal)).toBe(false);
  });

  it("suma días cruzando mes y año", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("textos", () => {
  it("hora y día legibles", () => {
    expect(horaLegible("2026-10-02T14:30:00.000Z").replace(/\s/g, " ")).toMatch(/^9:30 a\. ?m\.$/);
    expect(horaLegible("2026-10-02T20:05:00.000Z").replace(/\s/g, " ")).toMatch(/^3:05 p\. ?m\.$/);
    expect(diaLegible("2026-10-02")).toBe("viernes 2 de octubre");
  });

  it("encabezado del día: Hoy, Mañana o la fecha", () => {
    expect(etiquetaDiaAgenda("2026-10-01", "2026-10-01")).toBe("Hoy");
    expect(etiquetaDiaAgenda("2026-10-02", "2026-10-01")).toBe("Mañana");
    expect(etiquetaDiaAgenda("2026-10-05", "2026-10-01")).toBe("Lunes 5 de octubre");
  });

  it("frase del mensaje de recordatorio", () => {
    const hora = "a las 9:30";
    expect(cuandoCita("2026-10-02T14:30:00.000Z", "2026-10-01").replace(/\s/g, " ")).toMatch(new RegExp(`^mañana ${hora} a\. ?m\.$`));
    expect(cuandoCita("2026-10-01T14:30:00.000Z", "2026-10-01")).toMatch(/^hoy a las 9:30/);
    expect(cuandoCita("2026-10-05T14:30:00.000Z", "2026-10-01")).toMatch(/^el lunes 5 de octubre a las 9:30/);
  });
});

describe("agruparCitas", () => {
  const c = (id: string, fecha: string, hora: string) => ({ id, fechaHora: instanteBogota(fecha, hora) });

  it("separa las atrasadas de las de hoy en adelante y agrupa por día conservando el orden", () => {
    const { atrasadas, dias } = agruparCitas(
      [c("a", "2026-09-29", "10:00"), c("b", "2026-10-01", "08:00"), c("c", "2026-10-01", "15:00"), c("d", "2026-10-02", "09:00"), c("e", "2026-10-07", "09:00")],
      "2026-10-01"
    );
    expect(atrasadas.map((x) => x.id)).toEqual(["a"]);
    expect(dias.map((g) => [g.etiqueta, g.citas.map((x) => x.id)])).toEqual([
      ["Hoy", ["b", "c"]],
      ["Mañana", ["d"]],
      ["Miércoles 7 de octubre", ["e"]],
    ]);
  });

  it("una cita de las 11 p. m. de hoy sigue siendo de hoy (no pasa al día siguiente por la zona horaria)", () => {
    const { atrasadas, dias } = agruparCitas([c("n", "2026-10-01", "23:00")], "2026-10-01");
    expect(atrasadas).toHaveLength(0);
    expect(dias[0].etiqueta).toBe("Hoy");
  });

  it("sin citas, todo vacío", () => {
    expect(agruparCitas([], "2026-10-01")).toEqual({ atrasadas: [], dias: [] });
  });
});
