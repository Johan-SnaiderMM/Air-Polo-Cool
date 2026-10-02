import { describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/agenda";
import { citasDelVehiculo } from "@/lib/datos/agenda";
import { crearSupabaseFalso } from "@/test/supabase-falso";

const HOY = "2026-10-01";
const VEH = "123e4567-e89b-12d3-a456-426614174001";
const corta = (id: string, fecha: string, hora: string, tipo = "servicio") => ({ id, fecha_hora: instanteBogota(fecha, hora), tipo });

describe("citasDelVehiculo", () => {
  it("pide las pendientes del vehículo desde hoy a las 00:00 hasta el día 7 inclusive, y marca la de hoy", async () => {
    const f = crearSupabaseFalso({ responder: () => ({ data: [corta("a", "2026-10-01", "15:00"), corta("b", "2026-10-03", "09:30", "mantenimiento")] }) });
    const r = await citasDelVehiculo(f.cliente, VEH, null, HOY);

    expect(f.de("select", "citas")[0].filtros).toEqual([
      { col: "vehiculo_id", op: "eq", valor: VEH },
      { col: "estado", op: "eq", valor: "pendiente" },
      { col: "fecha_hora", op: "gte", valor: instanteBogota("2026-10-01", "00:00") },
      { col: "fecha_hora", op: "lt", valor: instanteBogota("2026-10-09", "00:00") }, // hoy + 7 días, hasta el final de ese día
    ]);
    expect(r.error).toBeNull();
    expect(r.citas.map((c) => [c.id, c.esHoy, c.etiquetaDia, c.tipo])).toEqual([
      ["a", true, "Hoy", "servicio"],
      ["b", false, "Sábado 3 de octubre", "mantenimiento"],
    ]);
    expect(r.citas[0].horaTexto.replace(/\s/g, " ")).toMatch(/^3:00 p\. ?m\.$/);
  });

  it("incluye la cita de la que se llega desde la agenda aunque caiga fuera de la ventana, sin duplicarla", async () => {
    const lejana = corta("lejana", "2026-10-20", "08:00");
    const f = crearSupabaseFalso({
      responder: (l) => (l.filtros.some((x) => x.col === "id") ? { data: [lejana] } : { data: [corta("a", "2026-10-02", "09:00")] }),
    });
    const r = await citasDelVehiculo(f.cliente, VEH, "lejana", HOY);
    expect(r.citas.map((c) => c.id)).toEqual(["a", "lejana"]);
    // La búsqueda extra es solo de esa cita, de ese vehículo y pendiente.
    expect(f.de("select", "citas")[1].filtros).toEqual([
      { col: "id", op: "eq", valor: "lejana" },
      { col: "vehiculo_id", op: "eq", valor: VEH },
      { col: "estado", op: "eq", valor: "pendiente" },
    ]);

    const yaEstaba = crearSupabaseFalso({ responder: () => ({ data: [corta("a", "2026-10-02", "09:00")] }) });
    await citasDelVehiculo(yaEstaba.cliente, VEH, "a", HOY);
    expect(yaEstaba.de("select", "citas")).toHaveLength(1); // ya venía: no se vuelve a pedir
  });

  it("sin citas, lista vacía; sin la tabla (migración pendiente) devuelve el error y ninguna cita", async () => {
    expect(await citasDelVehiculo(crearSupabaseFalso({ responder: () => ({ data: [] }) }).cliente, VEH, null, HOY)).toEqual({ citas: [], error: null });
    const r = await citasDelVehiculo(crearSupabaseFalso({ responder: () => ({ error: { code: "PGRST205", message: "no table" } }) }).cliente, VEH, null, HOY);
    expect(r.citas).toEqual([]);
    expect(r.error).toMatch(/Falta ejecutar las migraciones/);
  });
});
