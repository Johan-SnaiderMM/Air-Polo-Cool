import { describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/agenda";
import { cargarAgenda, contarAgendaInicio } from "@/lib/datos/agenda";
import { crearSupabaseFalso, type Llamada, type Respuesta } from "@/test/supabase-falso";

const HOY = "2026-10-01";
const VEH_A = "123e4567-e89b-12d3-a456-426614174001";
const VEH_B = "123e4567-e89b-12d3-a456-426614174002";
const VEH_C = "123e4567-e89b-12d3-a456-426614174003";

const fila = (id: string, vehiculoId: string, fecha: string, hora: string, extra: Record<string, unknown> = {}) => ({
  id,
  vehiculo_id: vehiculoId,
  fecha_hora: instanteBogota(fecha, hora),
  tipo: "servicio",
  notas: null,
  recordatorio_enviado_at: null,
  vehiculos: {
    placa: "ABC123",
    marca: "Chevrolet",
    modelo: "Spark GT",
    anio: 2018,
    clientes: { nombre: "Juan Pérez López", telefono: "+573001234567" },
  },
  ...extra,
});

const mantenimiento = (vehiculoId: string, placa: string | null, dias: number) => ({
  vehiculo_id: vehiculoId,
  placa,
  marca: "Renault",
  modelo: "Duster",
  anio: 2020,
  cliente: "Luis Gómez",
  telefono: "+573009998877",
  proximo_mantenimiento: "2026-10-02",
  dias_restantes: dias,
});

function base(citas: unknown[], mantenimientos: unknown[] = [], errorCitas?: { code?: string; message: string }) {
  return (l: Llamada): Respuesta | undefined => {
    if (l.tabla === "citas") return errorCitas ? { error: errorCitas } : { data: citas };
    if (l.tabla === "v_mantenimientos") return { data: mantenimientos };
    return undefined;
  };
}

describe("cargarAgenda", () => {
  it("agrupa por día, deja aparte las atrasadas y arma el recordatorio de WhatsApp", async () => {
    const f = crearSupabaseFalso({
      responder: base([
        fila("a", VEH_A, "2026-09-29", "10:00"),
        fila("b", VEH_A, "2026-10-02", "09:30"),
        fila("c", VEH_B, "2026-10-02", "15:00", { tipo: "mantenimiento", notas: "Trae el filtro" }),
      ]),
    });
    const r = await cargarAgenda(f.cliente, HOY);

    expect(r.error).toBeNull();
    expect(r.total).toBe(3);
    expect(r.atrasadas.map((c) => c.id)).toEqual(["a"]);
    expect(r.dias.map((d) => [d.etiqueta, d.citas.map((c) => c.id)])).toEqual([["Mañana", ["b", "c"]]]);

    const b = r.dias[0].citas[0];
    expect(b).toMatchObject({ fecha: "2026-10-02", hora: "09:30", placa: "ABC123", vehiculo: "Chevrolet Spark GT 2018", cliente: "Juan Pérez López", tipo: "servicio" });
    expect(b.whatsappHref).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
    const texto = decodeURIComponent(b.whatsappHref!.split("?text=")[1]);
    expect(texto).toContain("Hola Juan,");
    expect(texto).toContain("mañana a las 9:30");
    expect(r.dias[0].citas[1].notas).toBe("Trae el filtro");
  });

  it("pide solo las pendientes desde hace 14 días (a medianoche de Colombia), en orden", async () => {
    const f = crearSupabaseFalso({ responder: base([]) });
    await cargarAgenda(f.cliente, HOY);
    const [consulta] = f.de("select", "citas");
    expect(consulta.filtros).toEqual([
      { col: "estado", op: "eq", valor: "pendiente" },
      { col: "fecha_hora", op: "gte", valor: instanteBogota("2026-09-17", "00:00") },
    ]);
  });

  it("los mantenimientos por programar excluyen a quien ya tiene su cita de mantenimiento", async () => {
    const f = crearSupabaseFalso({
      responder: base(
        [fila("m", VEH_A, "2026-10-02", "09:00", { tipo: "mantenimiento" }), fila("s", VEH_B, "2026-10-03", "09:00")],
        [mantenimiento(VEH_A, "ABC123", 1), mantenimiento(VEH_B, "XYZ987", 1), mantenimiento(VEH_C, "QWE456", -3)]
      ),
    });
    const r = await cargarAgenda(f.cliente, HOY);
    // VEH_A ya tiene cita de mantenimiento; VEH_B solo tiene una de servicio, así que sigue pendiente de programar.
    expect(r.porProgramar.map((p) => p.vehiculoId)).toEqual([VEH_B, VEH_C]);
    expect(r.porProgramar[1]).toMatchObject({ placa: "QWE456", marca: "Renault", modelo: "Duster", anio: 2020, vehiculo: "Renault Duster 2020", cliente: "Luis Gómez", dias: -3, proximo: "2026-10-02" });
    expect(r.porProgramar[1].whatsappHref).toMatch(/^https:\/\/wa\.me\/573009998877\?text=/);
    // Si le toca hoy o más adelante se sugiere ese día; si ya venció, mañana.
    expect(r.porProgramar[0].fechaSugerida).toBe("2026-10-02"); // proximo = 2 de octubre, hoy es 1
    expect(r.porProgramar[1].fechaSugerida).toBe("2026-10-02");
    const vencido = await cargarAgenda(
      crearSupabaseFalso({ responder: base([], [{ ...mantenimiento(VEH_C, "QWE456", -9), proximo_mantenimiento: "2026-09-22" }]) }).cliente,
      HOY
    );
    expect(vencido.porProgramar[0].fechaSugerida).toBe("2026-10-02"); // ya venció: mañana
  });

  it("descarta filas incompletas de la vista de mantenimientos", async () => {
    const f = crearSupabaseFalso({ responder: base([], [mantenimiento(VEH_A, null, 1), { ...mantenimiento(VEH_B, "XYZ987", 1), proximo_mantenimiento: null }]) });
    expect((await cargarAgenda(f.cliente, HOY)).porProgramar).toEqual([]);
  });

  it("si falta ejecutar la migración de la fase 7 devuelve un error legible y la lista vacía", async () => {
    const f = crearSupabaseFalso({ responder: base([], [], { code: "PGRST205", message: "Could not find the table 'public.citas'" }) });
    const r = await cargarAgenda(f.cliente, HOY);
    expect(r.error).toMatch(/Falta ejecutar las migraciones/);
    expect(r).toMatchObject({ atrasadas: [], dias: [], total: 0 });
  });

  it("un cliente sin teléfono no tiene botón de WhatsApp", async () => {
    const sinTelefono = fila("a", VEH_A, "2026-10-02", "09:30");
    sinTelefono.vehiculos.clientes.telefono = null as unknown as string;
    const f = crearSupabaseFalso({ responder: base([sinTelefono]) });
    expect((await cargarAgenda(f.cliente, HOY)).dias[0].citas[0].whatsappHref).toBeNull();
  });
});

describe("contarAgendaInicio", () => {
  it("cuenta las pendientes de hoy y de mañana (días de Colombia)", async () => {
    const f = crearSupabaseFalso({
      responder: (l) => {
        const desde = l.filtros.find((x) => x.col === "fecha_hora" && x.op === "gte")?.valor;
        return { data: [], count: desde === instanteBogota("2026-10-01", "00:00") ? 3 : 1 };
      },
    });
    expect(await contarAgendaInicio(f.cliente, HOY)).toEqual({ hoy: 3, manana: 1 });
    const [hoy] = f.de("select", "citas");
    expect(hoy.filtros).toEqual([
      { col: "estado", op: "eq", valor: "pendiente" },
      { col: "fecha_hora", op: "gte", valor: instanteBogota("2026-10-01", "00:00") },
      { col: "fecha_hora", op: "lt", valor: instanteBogota("2026-10-02", "00:00") },
    ]);
  });

  it("sin la tabla (migración pendiente) devuelve null para que el inicio lo oculte", async () => {
    const f = crearSupabaseFalso({ responder: () => ({ error: { code: "42P01", message: "no existe" } }) });
    expect(await contarAgendaInicio(f.cliente, HOY)).toBeNull();
  });
});
