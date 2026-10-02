import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { iniciarSesion } from "@/app/login/actions";
import { crearSupabaseFalso, type ErrorFalso, type Llamada, type Respuesta } from "@/test/supabase-falso";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const AHORA = new Date("2026-10-02T15:00:00Z");
const PROHIBIDO_EN_CLAVES = ["polo@example.com", "203.0.113.7", "203.0.113.8"];

type ResultadoAuth = { data: { user: { app_metadata: Record<string, unknown> } | null }; error: { status?: number; code?: string; message: string } | null };
const bien = (rol: unknown = "operario"): ResultadoAuth => ({ data: { user: { app_metadata: { rol } } }, error: null });
const mal = (status = 400): ResultadoAuth => ({ data: { user: null }, error: { status, message: "Invalid login credentials" } });

type Escenario = {
  auth?: ResultadoAuth;
  ip?: string | null;
  bloqueadoHasta?: string | null;
  /** Lo que devuelve registrar_fallo_login (el bloqueo que ese intento activa). */
  bloqueaAlFallar?: string | null;
  errorRpc?: ErrorFalso;
  sinAdmin?: boolean;
};

function preparar({ auth = bien(), ip = "203.0.113.7", bloqueadoHasta = null, bloqueaAlFallar = null, errorRpc, sinAdmin = false }: Escenario = {}) {
  const signIn = vi.fn(async () => auth);
  const signOut = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({ auth: { signInWithPassword: signIn, signOut } } as never);

  const admin = crearSupabaseFalso({
    responder: (l: Llamada): Respuesta | undefined => {
      if (l.op !== "rpc") return undefined;
      if (errorRpc) return { error: errorRpc };
      if (l.rpc === "login_bloqueado") return { data: bloqueadoHasta };
      if (l.rpc === "registrar_fallo_login") return { data: bloqueaAlFallar };
      return { data: null };
    },
  });
  vi.mocked(createAdminClient).mockReturnValue(sinAdmin ? null : (admin.cliente as never));

  const cabeceras = new Headers();
  if (ip) cabeceras.set("x-forwarded-for", `${ip}, 10.0.0.1`);
  vi.mocked(headers).mockResolvedValue(cabeceras as never);
  return { signIn, signOut, admin };
}

function formulario(extra: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ email: "polo@example.com", password: "secreta123", next: "/agenda", ...extra })) fd.set(k, v);
  return fd;
}
const llamadasRpc = (admin: ReturnType<typeof preparar>["admin"], nombre: string) => admin.de("rpc", nombre);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "clave-de-servicio-de-prueba");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ingreso correcto", () => {
  it("entra, borra los contadores del correo y del par (no el de la IP) y va a la pantalla pedida", async () => {
    const { signIn, admin } = preparar();
    await expect(iniciarSesion({}, formulario())).rejects.toThrow("REDIRECT:/agenda");
    expect(signIn).toHaveBeenCalledWith({ email: "polo@example.com", password: "secreta123" });
    const limpiezas = llamadasRpc(admin, "limpiar_login").map((l) => (l.payload as { p_clave: string }).p_clave);
    expect(limpiezas.map((c) => c.split(":")[0]).sort()).toEqual(["correo", "par"]);
    expect(llamadasRpc(admin, "registrar_fallo_login")).toHaveLength(0);
  });

  it("un usuario válido pero sin rol no entra y se le cierra la sesión", async () => {
    const { signOut } = preparar({ auth: bien(null) });
    const r = await iniciarSesion({}, formulario());
    expect(r.error).toMatch(/no tiene un rol asignado/);
    expect(signOut).toHaveBeenCalled();
  });
});

describe("contraseña incorrecta", () => {
  it("responde igual que siempre y anota el fallo en los tres contadores, cada uno con su límite", async () => {
    const { admin } = preparar({ auth: mal() });
    expect(await iniciarSesion({}, formulario())).toEqual({ error: "Correo o contraseña incorrectos." });
    const fallos = llamadasRpc(admin, "registrar_fallo_login").map((l) => l.payload as { p_clave: string; p_max: number; p_ventana_seg: number; p_bloqueo_seg: number });
    const porTipo = Object.fromEntries(fallos.map((f) => [f.p_clave.split(":")[0], f.p_max]));
    expect(porTipo).toEqual({ correo: 20, par: 5, ip: 40 });
    for (const f of fallos) expect([f.p_ventana_seg, f.p_bloqueo_seg]).toEqual([900, 900]);
  });

  it("las claves son huellas: ni el correo ni la IP aparecen en la base", async () => {
    const { admin } = preparar({ auth: mal() });
    await iniciarSesion({}, formulario());
    const claves = JSON.stringify(llamadasRpc(admin, "registrar_fallo_login").map((l) => l.payload));
    for (const secreto of PROHIBIDO_EN_CLAVES) expect(claves).not.toContain(secreto);
    expect(claves).not.toContain("secreta123");
    expect(claves).toMatch(/"correo:[0-9a-f]{32}"/);
  });

  it("el intento que activa el bloqueo ya avisa cuánto esperar (no hace falta un intento más)", async () => {
    preparar({ auth: mal(), bloqueaAlFallar: new Date(AHORA.getTime() + 15 * 60_000).toISOString() });
    const r = await iniciarSesion({}, formulario());
    expect(r.error).toMatch(/Demasiados intentos fallidos/);
    expect(r.error).toMatch(/15 minutos/);
  });

  it("un ayudante desactivado recibe un mensaje claro y eso NO suma al contador de contraseñas malas", async () => {
    const { admin } = preparar({ auth: { data: { user: null }, error: { status: 400, code: "user_banned", message: "User is banned" } } });
    expect(await iniciarSesion({}, formulario())).toEqual({ error: "Tu acceso está desactivado. Habla con el dueño del taller." });
    expect(llamadasRpc(admin, "registrar_fallo_login")).toHaveLength(0);
  });

  it("el límite propio de Supabase (429) se explica aparte y NO suma al contador", async () => {
    const { admin } = preparar({ auth: mal(429) });
    const r = await iniciarSesion({}, formulario());
    expect(r.error).toMatch(/Demasiados intentos en poco tiempo/);
    expect(llamadasRpc(admin, "registrar_fallo_login")).toHaveLength(0);
  });
});

describe("bloqueado", () => {
  it("no le pregunta a Supabase (no se puede seguir probando contraseñas) y dice cuánto esperar", async () => {
    const { signIn, admin } = preparar({ bloqueadoHasta: new Date(AHORA.getTime() + 7 * 60_000 + 10_000).toISOString() });
    const r = await iniciarSesion({}, formulario());
    expect(r.error).toBe("Demasiados intentos fallidos. Por seguridad, espera 8 minutos antes de volver a intentarlo.");
    expect(signIn).not.toHaveBeenCalled();
    expect(llamadasRpc(admin, "registrar_fallo_login")).toHaveLength(0);
  });

  it("estar bloqueado aplica igual aunque la contraseña fuera la correcta", async () => {
    const { signIn } = preparar({ auth: bien(), bloqueadoHasta: new Date(AHORA.getTime() + 60_000).toISOString() });
    const r = await iniciarSesion({}, formulario());
    expect(r.error).toMatch(/espera 1 minuto /);
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("las claves", () => {
  const clavesDe = async (extra: Record<string, string>, ip?: string | null) => {
    const { admin } = preparar({ auth: mal(), ip });
    await iniciarSesion({}, formulario(extra));
    return Object.fromEntries(llamadasRpc(admin, "registrar_fallo_login").map((l) => {
      const c = (l.payload as { p_clave: string }).p_clave;
      return [c.split(":")[0], c];
    }));
  };

  it("el correo cuenta igual con mayúsculas y espacios (no se evade cambiando la escritura)", async () => {
    const a = await clavesDe({ email: "polo@example.com" });
    const b = await clavesDe({ email: "  Polo@Example.COM " });
    expect(b).toEqual(a);
  });

  it("otra IP comparte el contador del correo pero tiene su propio par e IP (un extraño no bloquea al dueño desde su red)", async () => {
    const a = await clavesDe({}, "203.0.113.7");
    const b = await clavesDe({}, "203.0.113.8");
    expect(b.correo).toBe(a.correo);
    expect(b.par).not.toBe(a.par);
    expect(b.ip).not.toBe(a.ip);
  });

  it("sin una IP reconocible (p. ej. en desarrollo) solo cuenta el correo", async () => {
    expect(Object.keys(await clavesDe({}, null))).toEqual(["correo"]);
    const basura = await clavesDe({}, "no-es-una-ip!");
    expect(Object.keys(basura)).toEqual(["correo"]);
  });

  it("dos usuarios distintos no comparten contador", async () => {
    const a = await clavesDe({ email: "polo@example.com" });
    const b = await clavesDe({ email: "soporte@example.com" });
    expect(b.correo).not.toBe(a.correo);
    expect(b.par).not.toBe(a.par);
  });
});

describe("si el límite no está disponible, el taller sigue pudiendo entrar", () => {
  it("sin clave de servicio, entra normal y no toca la base del límite", async () => {
    const { admin } = preparar({ sinAdmin: true });
    await expect(iniciarSesion({}, formulario())).rejects.toThrow("REDIRECT:/agenda");
    expect(admin.llamadas).toHaveLength(0);
  });

  it("si la base del límite falla (o la migración no está), el ingreso correcto sigue funcionando", async () => {
    preparar({ errorRpc: { code: "PGRST202", message: "función no encontrada" } });
    await expect(iniciarSesion({}, formulario())).rejects.toThrow("REDIRECT:/agenda");
  });

  it("y un intento fallido con la base del límite caída responde el mensaje normal", async () => {
    preparar({ auth: mal(), errorRpc: { code: "42P01", message: "no existe" } });
    expect(await iniciarSesion({}, formulario())).toEqual({ error: "Correo o contraseña incorrectos." });
  });
});

describe("validación previa", () => {
  it("sin correo o contraseña no consulta nada", async () => {
    const { signIn, admin } = preparar();
    expect(await iniciarSesion({}, formulario({ email: "  " }))).toEqual({ error: "Ingresa tu correo y contraseña." });
    expect(await iniciarSesion({}, formulario({ password: "" }))).toEqual({ error: "Ingresa tu correo y contraseña." });
    expect(signIn).not.toHaveBeenCalled();
    expect(admin.llamadas).toHaveLength(0);
  });

  it("el destino tras entrar solo puede ser una ruta interna (nunca otro sitio)", async () => {
    preparar();
    await expect(iniciarSesion({}, formulario({ next: "https://malo.example" }))).rejects.toThrow("REDIRECT:/");
    preparar();
    await expect(iniciarSesion({}, formulario({ next: "//malo.example" }))).rejects.toThrow("REDIRECT:/");
  });
});
