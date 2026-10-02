import { beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { instanteBogota } from "@/lib/agenda";
import { enviarResumenDiario } from "@/lib/push/aviso-diario";
import { crearSupabaseFalso, type ErrorFalso, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

const HOY = "2026-10-01";
const enviar = vi.mocked(webpush.sendNotification);
const vapid = vi.mocked(webpush.setVapidDetails);

const suscripciones = [
  { id: "s1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
  { id: "s2", endpoint: "https://push.example/2", p256dh: "k2", auth: "a2" },
];
const cita = (id: string, recordada: boolean) => ({ id, recordatorio_enviado_at: recordada ? "2026-10-01T12:00:00Z" : null });

type Opciones = { citas?: unknown[]; atrasadas?: number; suscripciones?: unknown[]; errorReserva?: ErrorFalso };

/** La «base»: citas reales del día, atrasadas, teléfonos suscritos y la reserva del envío. */
function base({ citas = [], atrasadas = 0, suscripciones: subs = suscripciones, errorReserva }: Opciones = {}) {
  return (l: Llamada): Respuesta | undefined => {
    if (l.tabla === "citas") return l.seleccion === "id" ? { data: [], count: atrasadas } : { data: citas };
    if (l.tabla === "push_suscripciones" && l.op === "select") return { data: subs };
    if (l.tabla === "push_envios" && l.op === "insert") return errorReserva ? { error: errorReserva } : { data: [] };
    return undefined;
  };
}
function usar(opciones?: Opciones) {
  return crearSupabaseFalso({ responder: base(opciones) });
}
const ejecutar = (f: ReturnType<typeof usar>, franja: "dia" | "tarde" = "dia") => enviarResumenDiario(f.cliente as never, franja, HOY);
const payloads = () => enviar.mock.calls.map((c) => JSON.parse(String(c[1])) as { titulo: string; cuerpo: string; url: string; etiqueta: string });

beforeEach(() => {
  enviar.mockReset().mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  vapid.mockReset();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "publica");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
  vi.stubEnv("VAPID_SUBJECT", "mailto:taller@example.com");
});

describe("aviso de las 7:00 a. m.", () => {
  it("manda a TODOS los teléfonos suscritos el resumen de hoy: cuántas citas y cuántas faltan por recordar", async () => {
    const f = usar({ citas: [cita("a", false), cita("b", false), cita("c", true)], atrasadas: 0 });
    const r = await ejecutar(f);

    expect(r).toMatchObject({ estado: "enviado", cuerpo: "3 citas hoy · 2 por recordar", enviados: 2, retiradas: 0, fallidas: 0 });
    expect(enviar.mock.calls.map((c) => (c[0] as { endpoint: string }).endpoint)).toEqual(["https://push.example/1", "https://push.example/2"]);
    expect(payloads()[0]).toEqual({ titulo: "Agenda de hoy", cuerpo: "3 citas hoy · 2 por recordar", url: "/agenda", etiqueta: "agenda-dia" });
    expect(enviar.mock.calls[0][0]).toEqual({ endpoint: "https://push.example/1", keys: { p256dh: "k1", auth: "a1" } });
    expect(vapid).toHaveBeenCalledWith("mailto:taller@example.com", "publica", "privada");
  });

  it("cuenta SOLO citas reales: las de prueba de soporte quedan fuera (el cliente de servicio salta el RLS)", async () => {
    const f = usar({ citas: [cita("a", false)] });
    await ejecutar(f);
    for (const consulta of f.de("select", "citas")) {
      expect(consulta.filtros).toContainEqual({ col: "es_prueba", op: "eq", valor: false });
      expect(consulta.filtros).toContainEqual({ col: "estado", op: "eq", valor: "pendiente" });
    }
  });

  it("pide las citas de hoy (de las 00:00 a las 00:00 siguientes, hora de Colombia) y cuenta las atrasadas hasta 14 días atrás", async () => {
    const f = usar({ citas: [cita("a", false)], atrasadas: 2 });
    const r = await ejecutar(f);
    const [delDia, atrasadas] = f.de("select", "citas");
    expect(delDia.filtros).toContainEqual({ col: "fecha_hora", op: "gte", valor: instanteBogota("2026-10-01", "00:00") });
    expect(delDia.filtros).toContainEqual({ col: "fecha_hora", op: "lt", valor: instanteBogota("2026-10-02", "00:00") });
    expect(atrasadas.filtros).toContainEqual({ col: "fecha_hora", op: "gte", valor: instanteBogota("2026-09-17", "00:00") });
    expect(atrasadas.filtros).toContainEqual({ col: "fecha_hora", op: "lt", valor: instanteBogota("2026-10-01", "00:00") });
    expect(r).toMatchObject({ cuerpo: "1 cita hoy · por recordar · 2 atrasadas sin atender" });
  });

  it("si todas ya se recordaron lo dice, sin pedirle nada al taller", async () => {
    const r = await ejecutar(usar({ citas: [cita("a", true), cita("b", true)] }));
    expect(r).toMatchObject({ estado: "enviado", cuerpo: "2 citas hoy · todas ya recordadas" });
  });
});

describe("aviso de las 5:30 p. m.", () => {
  it("resume las citas de MAÑANA y no consulta las atrasadas", async () => {
    const f = usar({ citas: [cita("a", false), cita("b", true)], atrasadas: 9 });
    const r = await ejecutar(f, "tarde");
    expect(r).toMatchObject({ estado: "enviado", cuerpo: "2 citas mañana · 1 por recordar" });
    expect(payloads()[0]).toMatchObject({ titulo: "Agenda de mañana", etiqueta: "agenda-tarde" });
    expect(f.de("select", "citas")).toHaveLength(1);
    expect(f.de("select", "citas")[0].filtros).toContainEqual({ col: "fecha_hora", op: "gte", valor: instanteBogota("2026-10-02", "00:00") });
    expect(f.de("select", "citas")[0].filtros).toContainEqual({ col: "fecha_hora", op: "lt", valor: instanteBogota("2026-10-03", "00:00") });
  });
});

describe("cuándo NO manda nada", () => {
  it("sin las claves de los avisos no consulta ni envía", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const f = usar({ citas: [cita("a", false)] });
    expect(await ejecutar(f)).toEqual({ estado: "sin_configurar" });
    expect(f.llamadas).toHaveLength(0);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("sin citas no molesta con un aviso vacío, ni toca suscripciones ni reserva el envío", async () => {
    const f = usar({ citas: [], atrasadas: 0 });
    expect(await ejecutar(f)).toEqual({ estado: "nada_que_avisar" });
    expect(f.de("select", "push_suscripciones")).toHaveLength(0);
    expect(f.de("insert", "push_envios")).toHaveLength(0);
  });

  it("sin teléfonos suscritos no envía ni deja el día marcado como enviado", async () => {
    const f = usar({ citas: [cita("a", false)], suscripciones: [] });
    expect(await ejecutar(f)).toEqual({ estado: "sin_suscripciones" });
    expect(f.de("insert", "push_envios")).toHaveLength(0);
  });

  it("un reintento el mismo día (el programador lo repite) no manda el aviso otra vez", async () => {
    const f = usar({ citas: [cita("a", false)], errorReserva: { code: "23505", message: "duplicate key" } });
    expect(await ejecutar(f)).toEqual({ estado: "ya_enviado" });
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("el envío", () => {
  it("reserva (fecha, franja) ANTES de enviar y al terminar anota a cuántos llegó", async () => {
    let enviadosAlReservar = -1;
    const normal = base({ citas: [cita("a", false)] });
    const f = crearSupabaseFalso({
      responder: (l) => {
        if (l.tabla === "push_envios" && l.op === "insert") enviadosAlReservar = enviar.mock.calls.length;
        return normal(l);
      },
    });
    await ejecutar(f, "tarde");
    expect(f.de("insert", "push_envios")[0].payload).toEqual({ fecha: HOY, franja: "tarde" });
    expect(enviadosAlReservar).toBe(0); // al reservar todavía no se había enviado nada
    expect(f.de("update", "push_envios")[0].payload).toEqual({ enviados: 2 });
  });

  it("borra del servidor los teléfonos que ya no existen (404/410) y cuenta aparte los demás fallos", async () => {
    enviar
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    const f = usar({ citas: [cita("a", false)] });
    const r = await ejecutar(f);
    expect(r).toMatchObject({ estado: "enviado", enviados: 0, retiradas: 1, fallidas: 1 });
    const [borrado] = f.de("delete", "push_suscripciones");
    expect(borrado.filtros).toEqual([{ col: "id", op: "in", valor: ["s1"] }]);
  });

  it("un teléfono que falla no impide que lleguen los demás", async () => {
    enviar.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    const r = await ejecutar(usar({ citas: [cita("a", false)] }));
    expect(r).toMatchObject({ enviados: 1, fallidas: 1 });
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("si el envío se rompe por completo, libera la reserva para poder reintentar y avisa del error", async () => {
    vapid.mockImplementation(() => {
      throw new Error("clave VAPID inválida");
    });
    const f = usar({ citas: [cita("a", false)] });
    await expect(ejecutar(f)).rejects.toThrow("clave VAPID inválida");
    expect(f.de("delete", "push_envios")[0].filtros).toEqual([
      { col: "fecha", op: "eq", valor: HOY },
      { col: "franja", op: "eq", valor: "dia" },
    ]);
  });

  it("un error de la base al contar las citas se propaga (el programador lo verá fallar)", async () => {
    const f = crearSupabaseFalso({ responder: (l) => (l.tabla === "citas" ? { error: { code: "42P01", message: "no existe" } } : undefined) });
    await expect(enviarResumenDiario(f.cliente as never, "dia", HOY)).rejects.toThrow("no existe");
  });
});
