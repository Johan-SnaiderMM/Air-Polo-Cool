import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { citasDelVehiculo } from "@/app/(app)/agenda/actions";
import { instanteBogota } from "@/lib/agenda";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

const CITA = "123e4567-e89b-12d3-a456-426614174000";
const VEH = "223e4567-e89b-12d3-a456-426614174000";

// «Hoy» es el 1 de octubre de 2026 a las 10 a. m. en Colombia.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}

describe("citasDelVehiculo (acción)", () => {
  it("devuelve las citas pendientes del vehículo (hoy y próximos 7 días), con la de hoy marcada", async () => {
    usar((l) =>
      l.tabla === "citas"
        ? {
            data: [
              { id: CITA, fecha_hora: instanteBogota("2026-10-01", "15:00"), tipo: "servicio" },
              { id: "otra", fecha_hora: instanteBogota("2026-10-04", "09:00"), tipo: "mantenimiento" },
            ],
          }
        : undefined
    );
    const r = await citasDelVehiculo({ vehiculoId: VEH });
    expect(r.ok && r.citas.map((c) => [c.id, c.esHoy, c.etiquetaDia])).toEqual([
      [CITA, true, "Hoy"],
      ["otra", false, "Domingo 4 de octubre"],
    ]);
  });

  it("valida los ids (descarta el de la cita si no es uuid), la sesión y devuelve el error de la base", async () => {
    const f = usar(() => ({ data: [] }));
    expect(await citasDelVehiculo({ vehiculoId: "x" })).toEqual({ ok: false, error: "Vehículo inválido." });
    expect(f.llamadas).toHaveLength(0);
    expect(await citasDelVehiculo({ vehiculoId: VEH, incluirId: "x" })).toEqual({ ok: true, citas: [] });
    expect(f.de("select", "citas")).toHaveLength(1); // el id inválido no genera búsqueda extra

    usar(undefined, null);
    expect(await citasDelVehiculo({ vehiculoId: VEH })).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });

    usar(() => ({ error: { code: "XX000", message: "falló" } }));
    expect(await citasDelVehiculo({ vehiculoId: VEH })).toEqual({ ok: false, error: "falló" });
  });
});
