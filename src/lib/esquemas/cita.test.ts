import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validar } from "@/lib/esquemas/comunes";
import {
  citaFormSchema,
  MSG_CITA_LEJANA,
  MSG_CITA_PASADA,
  MSG_FECHA_CITA,
  MSG_HORA_CITA,
  MSG_TIPO_CITA,
} from "@/lib/esquemas/cita";

const error = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);
const base = { fecha: "2026-10-02", hora: "09:30", tipo: "servicio", notas: "", autor: "Polo" };

// «Hoy» es el 1 de octubre de 2026 a las 10 a. m. en Colombia.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("formulario de cita", () => {
  it("normaliza: nota recortada (o null), autor válido o null", () => {
    expect(validar(citaFormSchema, { ...base, notas: "  Trae el compresor  " })).toEqual({
      ok: true,
      valor: { fecha: "2026-10-02", hora: "09:30", tipo: "servicio", notas: "Trae el compresor", autor: "Polo" },
    });
    expect(validar(citaFormSchema, { ...base, autor: "Hacker" })).toMatchObject({ ok: true, valor: { autor: null, notas: null } });
    const larga = validar(citaFormSchema, { ...base, notas: "n".repeat(900) });
    expect(larga.ok && larga.valor.notas).toHaveLength(500);
  });

  it("acepta hoy (aunque la hora ya pasó) y mañana, y el tipo mantenimiento", () => {
    expect(validar(citaFormSchema, { ...base, fecha: "2026-10-01", hora: "07:00" }).ok).toBe(true);
    expect(validar(citaFormSchema, { ...base, tipo: "mantenimiento" }).ok).toBe(true);
  });

  it("cada regla con su mensaje", () => {
    const e = (cambio: Record<string, unknown>) => error(validar(citaFormSchema, { ...base, ...cambio }));
    expect(e({ fecha: "" })).toBe(MSG_FECHA_CITA);
    expect(e({ fecha: "2026-02-31" })).toBe(MSG_FECHA_CITA);
    expect(e({ fecha: undefined })).toBe(MSG_FECHA_CITA);
    expect(e({ hora: "25:00" })).toBe(MSG_HORA_CITA);
    expect(e({ hora: "" })).toBe(MSG_HORA_CITA);
    expect(e({ tipo: "otro" })).toBe(MSG_TIPO_CITA);
    expect(e({ fecha: "2026-09-30" })).toBe(MSG_CITA_PASADA);
    expect(e({ fecha: "2027-10-01" })).toBeNull(); // justo un año
    expect(e({ fecha: "2027-10-02" })).toBe(MSG_CITA_LEJANA);
  });

  it("valida en el orden de los campos: primero la fecha, luego la hora, luego el tipo", () => {
    expect(error(validar(citaFormSchema, { fecha: "x", hora: "x", tipo: "x" }))).toBe(MSG_FECHA_CITA);
    expect(error(validar(citaFormSchema, { ...base, hora: "x", tipo: "x" }))).toBe(MSG_HORA_CITA);
  });
});
