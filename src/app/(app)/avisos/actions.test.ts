import { beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { enviarAvisoDePrueba, guardarSuscripcion, quitarSuscripcion } from "@/app/(app)/avisos/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type OpcionesFalso, type Respuesta } from "@/test/supabase-falso";
import { createAdminClient } from "@/utils/supabase/admin";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

const USUARIO = "123e4567-e89b-12d3-a456-426614174000";
const POLO: OpcionesFalso["usuario"] = { id: USUARIO, app_metadata: { rol: "operario" } };
const SOPORTE: OpcionesFalso["usuario"] = { id: USUARIO, app_metadata: { rol: "admin", soporte: true } };

const suscripcion = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  expirationTime: null,
  keys: { p256dh: "BEl62iUYgUivxIkv69yViEuiBIa-ZEWBy5ArzT-mHRC5wH1G3vdHB5eKA9eUJy3cZ5oQ6S2oY-MjYy1kQGv7lSU", auth: "tBHItJI5svbpez7KI4CCXg" },
};

/** Sesión del usuario y «base» de servicio (las suscripciones solo las toca el servidor). */
function usar(usuario: OpcionesFalso["usuario"], responder?: (l: Llamada) => Respuesta | undefined) {
  sesionFalsa.cliente = crearSupabaseFalso({ usuario }).cliente;
  const admin = crearSupabaseFalso({ responder });
  vi.mocked(createAdminClient).mockReturnValue(admin.cliente as never);
  return admin;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "publica");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
  vi.stubEnv("VAPID_SUBJECT", "mailto:taller@example.com");
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(webpush.sendNotification).mockReset().mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});

describe("guardarSuscripcion", () => {
  it("guarda el teléfono a nombre del usuario de la sesión (nunca de otro) y limita el user agent", async () => {
    const admin = usar(POLO);
    expect(await guardarSuscripcion(suscripcion, "Mozilla/5.0 " + "x".repeat(500))).toEqual({ ok: true });
    const [u] = admin.de("upsert", "push_suscripciones");
    expect(u.payload).toEqual({
      user_id: USUARIO,
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.keys.p256dh,
      auth: suscripcion.keys.auth,
      es_soporte: false,
      user_agent: expect.stringMatching(/^Mozilla\/5\.0 x+$/),
    });
    expect((u.payload as { user_agent: string }).user_agent).toHaveLength(300);
  });

  it("marca los teléfonos del usuario de soporte", async () => {
    const admin = usar(SOPORTE);
    await guardarSuscripcion(suscripcion);
    expect(admin.de("upsert", "push_suscripciones")[0].payload).toMatchObject({ es_soporte: true, user_agent: null });
  });

  it("rechaza una suscripción inválida sin tocar la base", async () => {
    const admin = usar(POLO);
    expect(await guardarSuscripcion({ ...suscripcion, endpoint: "http://insegura.example" })).toEqual({ ok: false, error: "La suscripción a los avisos no es válida." });
    expect(await guardarSuscripcion(null)).toMatchObject({ ok: false });
    expect(admin.llamadas).toHaveLength(0);
  });

  it("sin sesión no guarda nada; sin claves o sin clave de servicio avisa que falta configurar", async () => {
    const admin = usar(null as never);
    expect(await guardarSuscripcion(suscripcion)).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });
    expect(admin.llamadas).toHaveLength(0);

    usar(POLO);
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await guardarSuscripcion(suscripcion)).toEqual({ ok: false, error: "Los avisos aún no están configurados en el servidor." });
    vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
    vi.mocked(createAdminClient).mockReturnValue(null);
    expect(await guardarSuscripcion(suscripcion)).toMatchObject({ ok: false });
  });

  it("devuelve el error de la base", async () => {
    usar(POLO, () => ({ error: { code: "42P01", message: "no existe" } }));
    expect((await guardarSuscripcion(suscripcion)) as { error: string }).toMatchObject({ ok: false, error: expect.stringMatching(/Falta ejecutar las migraciones/) });
  });
});

describe("quitarSuscripcion", () => {
  it("borra solo ese teléfono y solo si es del usuario de la sesión", async () => {
    const admin = usar(POLO);
    expect(await quitarSuscripcion({ endpoint: suscripcion.endpoint })).toEqual({ ok: true });
    expect(admin.de("delete", "push_suscripciones")[0].filtros).toEqual([
      { col: "endpoint", op: "eq", valor: suscripcion.endpoint },
      { col: "user_id", op: "eq", valor: USUARIO },
    ]);
  });

  it("valida el dato y la sesión", async () => {
    const admin = usar(POLO);
    expect(await quitarSuscripcion({ endpoint: "" })).toEqual({ ok: false, error: "Suscripción inválida." });
    expect(await quitarSuscripcion(null as never)).toEqual({ ok: false, error: "Suscripción inválida." });
    expect(admin.llamadas).toHaveLength(0);
    usar(null as never);
    expect(await quitarSuscripcion({ endpoint: suscripcion.endpoint })).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });
  });
});

describe("enviarAvisoDePrueba (solo soporte, solo a sus teléfonos)", () => {
  const propias = [{ id: "s1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" }];

  it("manda el aviso de prueba únicamente a los teléfonos suscritos del propio usuario de soporte", async () => {
    const admin = usar(SOPORTE, (l) => (l.tabla === "push_suscripciones" && l.op === "select" ? { data: propias } : undefined));
    expect(await enviarAvisoDePrueba()).toEqual({ ok: true, enviados: 1 });
    expect(admin.de("select", "push_suscripciones")[0].filtros).toEqual([{ col: "user_id", op: "eq", valor: USUARIO }]);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(webpush.sendNotification).mock.calls[0][1]))).toMatchObject({ titulo: "Prueba de avisos", etiqueta: "prueba" });
  });

  it("Polo no puede: ni siquiera se consulta la base", async () => {
    const admin = usar(POLO);
    expect(await enviarAvisoDePrueba()).toEqual({ ok: false, error: "Esta acción es solo para el usuario de soporte." });
    expect(admin.llamadas).toHaveLength(0);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("si este teléfono no está suscrito, o no se pudo entregar, lo dice claro", async () => {
    usar(SOPORTE, (l) => (l.tabla === "push_suscripciones" && l.op === "select" ? { data: [] } : undefined));
    expect(await enviarAvisoDePrueba()).toMatchObject({ ok: false, error: expect.stringContaining("no está suscrito") });

    usar(SOPORTE, (l) => (l.tabla === "push_suscripciones" && l.op === "select" ? { data: propias } : undefined));
    vi.mocked(webpush.sendNotification).mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    expect(await enviarAvisoDePrueba()).toMatchObject({ ok: false, error: expect.stringContaining("No se pudo entregar") });
  });
});
