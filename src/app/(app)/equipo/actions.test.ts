import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { cambiarEstadoAyudante, crearAyudante, restablecerContrasenaAyudante } from "@/app/(app)/equipo/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type OpcionesFalso, type Respuesta } from "@/test/supabase-falso";
import { createAdminClient } from "@/utils/supabase/admin";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const DUENO: OpcionesFalso["usuario"] = { id: "11111111-1111-4111-8111-111111111111", email: "dueno@x.co", app_metadata: { rol: "admin" } };
const AYUDANTE: OpcionesFalso["usuario"] = { id: "22222222-2222-4222-8222-222222222222", app_metadata: { rol: "operario" } };
const ID = "33333333-3333-4333-8333-333333333333";

type Perfil = { id: string; rol: string; es_soporte: boolean; activo: boolean };
const ayudante = (extra: Partial<Perfil> = {}): Perfil => ({ id: ID, rol: "operario", es_soporte: false, activo: true, ...extra });

/** Prepara la sesión (quien llama) y el cliente de servicio, con los métodos de Auth vigilados. */
function preparar(opciones: { usuario?: OpcionesFalso["usuario"]; perfiles?: unknown[]; perfil?: Perfil | null; errorPerfiles?: { code: string; message: string }; sinAdmin?: boolean } = {}) {
  sesionFalsa.cliente = crearSupabaseFalso({ usuario: opciones.usuario ?? DUENO }).cliente;
  const auth = {
    createUser: vi.fn(async () => ({ data: { user: { id: ID } }, error: null as null | { code?: string; message: string } })),
    updateUserById: vi.fn(async () => ({ data: {}, error: null as null | { message: string } })),
    deleteUser: vi.fn(async () => ({ data: {}, error: null })),
    getUserById: vi.fn(async () => ({ data: { user: { email: "carlos@x.co" } }, error: null as null | { message: string } })),
  };
  const responder = (l: Llamada): Respuesta | undefined => {
    if (l.tabla !== "perfiles") return undefined;
    if (l.op === "select" && l.seleccion === "nombre") return { data: opciones.perfiles ?? [] };
    if (l.op === "select") return { data: opciones.perfil === undefined ? [ayudante()] : opciones.perfil ? [opciones.perfil] : [] };
    if (l.op === "insert" || l.op === "update") return { error: opciones.errorPerfiles ?? null };
    return undefined;
  };
  const admin = crearSupabaseFalso({ responder, auth: { admin: auth } });
  vi.mocked(createAdminClient).mockReturnValue(opciones.sinAdmin ? null : (admin.cliente as never));
  return { auth, admin };
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(createAdminClient).mockReset();
});

describe("quién puede gestionar el equipo", () => {
  it("sin sesión: sesión expirada; un ayudante (operario): no puede; sin clave de servicio: lo explica", async () => {
    sesionFalsa.cliente = crearSupabaseFalso({ usuario: null }).cliente;
    expect(await crearAyudante({ nombre: "Carlos", correo: "c@x.co" })).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });

    const a = preparar({ usuario: AYUDANTE });
    for (const r of [
      await crearAyudante({ nombre: "Carlos Pérez", correo: "c@x.co" }),
      await cambiarEstadoAyudante({ id: ID, activo: false }),
      await restablecerContrasenaAyudante({ id: ID }),
    ]) {
      expect(r).toMatchObject({ ok: false, error: expect.stringContaining("dueño") });
    }
    expect(a.auth.createUser).not.toHaveBeenCalled();
    expect(a.auth.updateUserById).not.toHaveBeenCalled();

    preparar({ sinAdmin: true });
    expect(await crearAyudante({ nombre: "Carlos Pérez", correo: "c@x.co" })).toMatchObject({ ok: false, error: expect.stringContaining("SUPABASE_SERVICE_ROLE_KEY") });
  });
});

describe("crearAyudante", () => {
  it("crea el usuario como «operario» con contraseña temporal aleatoria y su perfil; devuelve la contraseña una vez", async () => {
    const { auth, admin } = preparar();
    const r = await crearAyudante({ nombre: "  Carlos   Pérez ", correo: " Carlos@X.co " });
    expect(r).toMatchObject({ ok: true, correo: "carlos@x.co" });
    if (!r.ok) return;
    expect(r.contrasena).toHaveLength(14);

    const [llamada] = auth.createUser.mock.calls as unknown as [[{ email: string; password: string; email_confirm: boolean; app_metadata: unknown }]];
    expect(llamada[0]).toEqual({ email: "carlos@x.co", password: r.contrasena, email_confirm: true, app_metadata: { rol: "operario" } });
    expect(admin.de("insert", "perfiles")[0].payload).toEqual({
      id: ID, nombre: "Carlos Pérez", correo: "carlos@x.co", rol: "operario", creado_por: DUENO!.id,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/equipo");
  });

  it("valida nombre y correo antes de tocar Auth", async () => {
    const { auth } = preparar();
    expect(await crearAyudante({ nombre: "A", correo: "c@x.co" })).toMatchObject({ ok: false, error: expect.stringContaining("al menos 2") });
    expect(await crearAyudante({ nombre: "Polo", correo: "c@x.co" })).toMatchObject({ ok: false, error: expect.stringContaining("reservado") });
    expect(await crearAyudante({ nombre: "Carlos", correo: "no-es-correo" })).toEqual({ ok: false, error: "Escribe un correo válido." });
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("no permite repetir un nombre (sin importar mayúsculas ni tildes)", async () => {
    const { auth } = preparar({ perfiles: [{ nombre: "Carlos Pérez" }] });
    expect(await crearAyudante({ nombre: "carlos perez", correo: "otro@x.co" })).toMatchObject({ ok: false, error: expect.stringContaining("Ya hay una persona") });
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("un correo ya usado se explica claro", async () => {
    const { auth } = preparar();
    auth.createUser.mockResolvedValueOnce({ data: { user: null } as never, error: { code: "email_exists", message: "A user with this email address has already been registered" } });
    expect(await crearAyudante({ nombre: "Carlos Pérez", correo: "c@x.co" })).toEqual({ ok: false, error: "Ya existe un usuario con ese correo." });
  });

  it("si falla guardar el perfil se deshace el usuario (nadie queda firmando como «Polo»)", async () => {
    const { auth } = preparar({ errorPerfiles: { code: "23505", message: "duplicado" } });
    expect(await crearAyudante({ nombre: "Carlos Pérez", correo: "c@x.co" })).toEqual({ ok: false, error: "Ya hay una persona con ese nombre." });
    expect(auth.deleteUser).toHaveBeenCalledWith(ID);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("cambiarEstadoAyudante", () => {
  it("desactivar: primero el perfil (corta ya el acceso a los datos) y luego bloquea el ingreso en Auth", async () => {
    const { auth, admin } = preparar();
    expect(await cambiarEstadoAyudante({ id: ID, activo: false })).toEqual({ ok: true });
    const [u] = admin.de("update", "perfiles");
    expect(u.payload).toMatchObject({ activo: false, desactivado_at: expect.any(String) });
    expect(u.filtros).toEqual([{ col: "id", op: "eq", valor: ID }]);
    expect(auth.updateUserById).toHaveBeenCalledWith(ID, { ban_duration: "876000h" });
    expect(revalidatePath).toHaveBeenCalledWith("/equipo");
  });

  it("reactivar: levanta el bloqueo de Auth y reactiva el perfil", async () => {
    const { auth, admin } = preparar({ perfil: ayudante({ activo: false }) });
    expect(await cambiarEstadoAyudante({ id: ID, activo: true })).toEqual({ ok: true });
    expect(auth.updateUserById).toHaveBeenCalledWith(ID, { ban_duration: "none" });
    expect(admin.de("update", "perfiles")[0].payload).toEqual({ activo: true, desactivado_at: null });
  });

  it("si Auth falla al bloquear, lo dice (ya quedó sin acceso a los datos)", async () => {
    const { auth } = preparar();
    auth.updateUserById.mockResolvedValueOnce({ data: {}, error: { message: "caído" } });
    expect(await cambiarEstadoAyudante({ id: ID, activo: false })).toMatchObject({ ok: false, error: expect.stringContaining("sin acceso a los datos") });
  });

  it("no se puede gestionar a un administrador, a soporte, a uno mismo, ni a quien no existe o un id raro", async () => {
    for (const perfil of [ayudante({ rol: "admin" }), ayudante({ es_soporte: true }), ayudante({ id: DUENO!.id! })]) {
      const { auth } = preparar({ perfil });
      const r = await cambiarEstadoAyudante({ id: perfil.id, activo: false });
      expect(r, JSON.stringify(perfil)).toMatchObject({ ok: false, error: expect.stringContaining("Solo se pueden gestionar los ayudantes") });
      expect(auth.updateUserById).not.toHaveBeenCalled();
    }
    preparar({ perfil: null });
    expect(await cambiarEstadoAyudante({ id: ID, activo: false })).toEqual({ ok: false, error: "Esa persona ya no existe." });
    preparar();
    expect(await cambiarEstadoAyudante({ id: "no-es-un-id", activo: false })).toEqual({ ok: false, error: "Persona inválida." });
  });
});

describe("restablecerContrasenaAyudante", () => {
  it("genera una contraseña nueva, la fija en Auth y la devuelve una vez con el correo", async () => {
    const { auth } = preparar();
    const r = await restablecerContrasenaAyudante({ id: ID });
    expect(r).toMatchObject({ ok: true, correo: "carlos@x.co" });
    if (!r.ok) return;
    expect(r.contrasena).toHaveLength(14);
    expect(auth.updateUserById).toHaveBeenCalledWith(ID, { password: r.contrasena });
  });

  it("solo a ayudantes; un fallo de Auth se informa", async () => {
    let p = preparar({ perfil: ayudante({ rol: "admin" }) });
    expect(await restablecerContrasenaAyudante({ id: ID })).toMatchObject({ ok: false });
    expect(p.auth.updateUserById).not.toHaveBeenCalled();

    p = preparar();
    p.auth.updateUserById.mockResolvedValueOnce({ data: {}, error: { message: "boom" } });
    expect(await restablecerContrasenaAyudante({ id: ID })).toMatchObject({ ok: false, error: expect.stringContaining("boom") });

    p = preparar();
    p.auth.getUserById.mockResolvedValueOnce({ data: { user: null } as never, error: { message: "no" } });
    expect(await restablecerContrasenaAyudante({ id: ID })).toMatchObject({ ok: false });
  });
});
