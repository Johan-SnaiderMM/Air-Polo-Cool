import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { cambiarEstadoCita, guardarCita, marcarRecordatorio } from "@/app/(app)/agenda/actions";
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
  vi.mocked(revalidatePath).mockClear();
});
afterEach(() => vi.useRealTimers());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}

function formulario(extra: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    fecha: "2026-10-02",
    hora: "09:30",
    tipo: "servicio",
    notas: "",
    autor: "Polo",
    vehiculo: JSON.stringify({ modo: "existente", vehiculo: { id: VEH } }),
  };
  for (const [k, v] of Object.entries({ ...base, ...extra })) fd.set(k, v);
  return fd;
}

const nuevoVehiculo = (datos: Record<string, string> = {}) =>
  JSON.stringify({
    modo: "nuevo",
    datos: { cliente_nombre: "Luis", cliente_telefono: "3001234567", placa: "xyz-987", marca: "Renault", modelo: "Logan", anio: "", ...datos },
  });

describe("guardarCita: validación", () => {
  it("sin sesión redirige al login", async () => {
    usar(undefined, null);
    await expect(guardarCita({}, formulario())).rejects.toThrow("REDIRECT:/login");
  });

  it("rechaza con el mensaje de cada regla y sin tocar la base", async () => {
    const casos: [Record<string, string>, string][] = [
      [{ cita_id: "x" }, "Cita inválida."],
      [{ fecha: "" }, "Elige el día de la cita."],
      [{ hora: "" }, "Elige la hora de la cita."],
      [{ tipo: "otro" }, "El tipo de cita no es válido."],
      [{ fecha: "2026-09-30" }, "El día de la cita no puede ser anterior a hoy."],
      [{ vehiculo: "" }, "Selecciona un vehículo o registra uno nuevo."],
      [{ vehiculo: nuevoVehiculo({ cliente_nombre: "" }) }, "Ingresa el nombre del cliente."],
    ];
    for (const [extra, error] of casos) {
      const f = usar();
      expect(await guardarCita({}, formulario(extra)), JSON.stringify(extra)).toEqual({ error });
      expect(f.de("insert"), JSON.stringify(extra)).toHaveLength(0);
      expect(f.de("update"), JSON.stringify(extra)).toHaveLength(0);
    }
  });
});

describe("guardarCita: crear", () => {
  const responder = (extra?: (l: Llamada) => Respuesta | undefined) => (l: Llamada): Respuesta | undefined => {
    const propio = extra?.(l);
    if (propio) return propio;
    if (l.tabla === "vehiculos" && l.op === "select") return { data: [{ id: VEH }] };
    if (l.tabla === "citas" && l.op === "select") return { data: [] };
    return undefined;
  };

  it("con un vehículo existente: inserta la cita con la hora de Colombia como instante y refresca", async () => {
    const f = usar(responder());
    expect(await guardarCita({}, formulario({ notas: "  Trae el compresor " }))).toEqual({ ok: true });
    expect(f.de("insert", "citas")[0].payload).toEqual({
      vehiculo_id: VEH,
      fecha_hora: instanteBogota("2026-10-02", "09:30"), // 14:30 UTC
      tipo: "servicio",
      notas: "Trae el compresor",
      autor: "Polo",
    });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/agenda", "/"]);
  });

  it("con un vehículo nuevo: da de alta cliente y vehículo con lo básico, y luego la cita", async () => {
    const f = usar((l) => (l.op === "select" ? { data: [] } : undefined));
    expect(await guardarCita({}, formulario({ vehiculo: nuevoVehiculo(), tipo: "mantenimiento" }))).toEqual({ ok: true });

    expect(f.de("insert").map((l) => l.tabla)).toEqual(["clientes", "vehiculos", "citas"]);
    expect(f.de("insert", "clientes")[0].payload).toMatchObject({ nombre: "Luis", telefono: "+573001234567" });
    expect(f.de("insert", "vehiculos")[0].payload).toMatchObject({ placa: "XYZ987", marca: "Renault", modelo: "Logan", anio: null });
    // La cita queda ligada al vehículo recién creado, sin pertenencias ni kilometraje de por medio.
    const vehiculoCreado = (f.de("insert", "vehiculos")[0].payload as { id: string }).id;
    expect(f.de("insert", "citas")[0].payload).toMatchObject({ vehiculo_id: vehiculoCreado, tipo: "mantenimiento" });
  });

  it("si la placa del vehículo nuevo ya existe, avisa y no crea la cita", async () => {
    const f = usar((l) => (l.tabla === "vehiculos" && l.filtros.some((x) => x.col === "placa") ? { data: [{ id: "otro" }] } : { data: [] }));
    const r = await guardarCita({}, formulario({ vehiculo: nuevoVehiculo({ placa: "ABC123" }) }));
    expect(r.error).toContain("ABC123 ya está registrada");
    expect(f.de("insert", "citas")).toHaveLength(0);
  });

  it("un vehículo existente que ya no existe se avisa", async () => {
    const f = usar((l) => (l.tabla === "vehiculos" ? { data: [] } : undefined));
    expect(await guardarCita({}, formulario())).toEqual({ error: "El vehículo ya no existe." });
    expect(f.de("insert")).toHaveLength(0);
  });

  it("no duplica: el mismo vehículo a la misma hora", async () => {
    const f = usar(responder((l) => (l.tabla === "citas" && l.op === "select" ? { data: [{ id: CITA }] } : undefined)));
    expect(await guardarCita({}, formulario())).toEqual({ error: "Ese vehículo ya tiene una cita a esa hora." });
    expect(f.de("insert", "citas")).toHaveLength(0);
    expect(f.de("select", "citas")[0].filtros).toEqual([
      { col: "vehiculo_id", op: "eq", valor: VEH },
      { col: "fecha_hora", op: "eq", valor: instanteBogota("2026-10-02", "09:30") },
      { col: "estado", op: "eq", valor: "pendiente" },
    ]);
  });

  it("devuelve el error de la base sin refrescar", async () => {
    usar(responder((l) => (l.tabla === "citas" && l.op === "insert" ? { error: { code: "42P01", message: "no existe" } } : undefined)));
    const r = await guardarCita({}, formulario());
    expect(r.error).toMatch(/Falta ejecutar las migraciones/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("guardarCita: reprogramar", () => {
  const previa = (estado: string, fechaHora: string) => (l: Llamada): Respuesta | undefined => {
    if (l.tabla === "citas" && l.op === "select") return { data: [{ estado, fecha_hora: fechaHora }] };
    if (l.op === "update") return { data: [{ id: CITA }] };
    return undefined;
  };

  it("cambia fecha, hora, tipo y nota; si cambia el momento, se puede volver a recordar", async () => {
    const f = usar(previa("pendiente", instanteBogota("2026-10-02", "09:30")));
    expect(await guardarCita({}, formulario({ cita_id: CITA, hora: "11:00", tipo: "mantenimiento" }))).toEqual({ ok: true });
    const [u] = f.de("update", "citas");
    expect(u.payload).toEqual({ fecha_hora: instanteBogota("2026-10-02", "11:00"), tipo: "mantenimiento", notas: null, recordatorio_enviado_at: null });
    expect(u.filtros).toEqual([
      { col: "id", op: "eq", valor: CITA },
      { col: "estado", op: "eq", valor: "pendiente" },
    ]);
    expect(f.de("insert")).toHaveLength(0); // reprogramar nunca crea vehículos ni citas
  });

  it("si solo cambia la nota, conserva la marca de «ya se le recordó»", async () => {
    const f = usar(previa("pendiente", instanteBogota("2026-10-02", "09:30")));
    await guardarCita({}, formulario({ cita_id: CITA, notas: "Nueva nota" }));
    expect(f.de("update", "citas")[0].payload).toEqual({ fecha_hora: instanteBogota("2026-10-02", "09:30"), tipo: "servicio", notas: "Nueva nota" });
  });

  it("no edita una cita inexistente ni una que ya no está pendiente", async () => {
    usar(() => ({ data: [] }));
    expect(await guardarCita({}, formulario({ cita_id: CITA }))).toEqual({ error: "La cita ya no existe." });
    const f = usar(previa("cancelada", instanteBogota("2026-10-02", "09:30")));
    expect(await guardarCita({}, formulario({ cita_id: CITA }))).toEqual({ error: "Solo se pueden editar citas pendientes." });
    expect(f.de("update")).toHaveLength(0);
  });
});

describe("cambiarEstadoCita", () => {
  it("marca como cumplida o cancelada solo si sigue pendiente", async () => {
    const f = usar((l) => (l.op === "update" ? { data: [{ id: CITA }] } : undefined));
    expect(await cambiarEstadoCita({ id: CITA, estado: "cumplida" })).toEqual({ ok: true });
    expect(await cambiarEstadoCita({ id: CITA, estado: "cancelada" })).toEqual({ ok: true });
    const [a, b] = f.de("update", "citas");
    expect(a.payload).toEqual({ estado: "cumplida" });
    expect(b.payload).toEqual({ estado: "cancelada" });
    expect(a.filtros).toEqual([
      { col: "id", op: "eq", valor: CITA },
      { col: "estado", op: "eq", valor: "pendiente" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/agenda");
  });

  it("si ya no estaba pendiente (otro la atendió) avisa", async () => {
    usar((l) => (l.op === "update" ? { data: [] } : undefined));
    expect(await cambiarEstadoCita({ id: CITA, estado: "cancelada" })).toEqual({ ok: false, error: "La cita ya no está pendiente." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("valida el id, el estado y la sesión", async () => {
    const f = usar();
    expect(await cambiarEstadoCita({ id: "x", estado: "cumplida" })).toEqual({ ok: false, error: "Cita inválida." });
    expect(await cambiarEstadoCita({ id: CITA, estado: "pendiente" as "cumplida" })).toEqual({ ok: false, error: "Estado inválido." });
    expect(f.llamadas).toHaveLength(0);
    usar(undefined, null);
    expect(await cambiarEstadoCita({ id: CITA, estado: "cumplida" })).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });
  });
});

describe("marcarRecordatorio", () => {
  it("anota la hora en que se tocó el botón de WhatsApp, solo en citas pendientes", async () => {
    const f = usar();
    expect(await marcarRecordatorio({ id: CITA })).toEqual({ ok: true });
    const [u] = f.de("update", "citas");
    expect(u.payload).toEqual({ recordatorio_enviado_at: "2026-10-01T15:00:00.000Z" });
    expect(u.filtros).toEqual([
      { col: "id", op: "eq", valor: CITA },
      { col: "estado", op: "eq", valor: "pendiente" },
    ]);
  });

  it("valida el id y la sesión; devuelve el error de la base", async () => {
    expect(await marcarRecordatorio({ id: "x" })).toEqual({ ok: false, error: "Cita inválida." });
    usar(undefined, null);
    expect(await marcarRecordatorio({ id: CITA })).toMatchObject({ ok: false });
    usar(() => ({ error: { code: "XX000", message: "falló" } }));
    expect(await marcarRecordatorio({ id: CITA })).toEqual({ ok: false, error: "falló" });
  });
});
