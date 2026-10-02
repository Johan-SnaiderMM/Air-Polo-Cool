import { describe, expect, it, vi } from "vitest";
import { cambiarMiContrasena } from "@/app/(app)/cuenta/actions";
import { crearSupabaseFalso, sesionFalsa, type OpcionesFalso } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());

const USUARIO: OpcionesFalso["usuario"] = { id: "u1", email: "carlos@x.co", app_metadata: { rol: "operario" } };
type ErrorAuth = { status?: number; code?: string; message: string } | null;

function preparar(opciones: { usuario?: OpcionesFalso["usuario"]; errorActual?: ErrorAuth; errorCambio?: ErrorAuth } = {}) {
  const signInWithPassword = vi.fn(async () => ({ data: {}, error: opciones.errorActual ?? null }));
  const updateUser = vi.fn(async () => ({ data: {}, error: opciones.errorCambio ?? null }));
  sesionFalsa.cliente = crearSupabaseFalso({ usuario: opciones.usuario === undefined ? USUARIO : opciones.usuario, auth: { signInWithPassword, updateUser } }).cliente;
  return { signInWithPassword, updateUser };
}

describe("cambiarMiContrasena", () => {
  it("verifica la actual y fija la nueva", async () => {
    const { signInWithPassword, updateUser } = preparar();
    expect(await cambiarMiContrasena({ actual: "ClaveVieja123", nueva: "ClaveNueva2026Larga" })).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "carlos@x.co", password: "ClaveVieja123" });
    expect(updateUser).toHaveBeenCalledWith({ password: "ClaveNueva2026Larga" });
  });

  it("sin sesión o sin correo no hace nada", async () => {
    let p = preparar({ usuario: null });
    expect(await cambiarMiContrasena({ actual: "a", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });
    expect(p.updateUser).not.toHaveBeenCalled();
    p = preparar({ usuario: { id: "u", app_metadata: { rol: "operario" } } });
    expect(await cambiarMiContrasena({ actual: "a", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("correo") });
  });

  it("valida la nueva antes de preguntar nada: corta, sin números, igual a la actual", async () => {
    const { signInWithPassword, updateUser } = preparar();
    expect(await cambiarMiContrasena({ actual: "", nueva: "ClaveNueva2026Larga" })).toEqual({ ok: false, error: "Escribe tu contraseña actual." });
    expect(await cambiarMiContrasena({ actual: "x", nueva: "Corta1" })).toMatchObject({ ok: false, error: expect.stringContaining("al menos 12") });
    expect(await cambiarMiContrasena({ actual: "x", nueva: "SoloLetrasMuyLargas" })).toMatchObject({ ok: false, error: expect.stringContaining("letras y números") });
    expect(await cambiarMiContrasena({ actual: "ClaveNueva2026Larga", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("distinta") });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("si la actual es incorrecta (o hay demasiados intentos) no cambia nada", async () => {
    let p = preparar({ errorActual: { status: 400, message: "Invalid login credentials" } });
    expect(await cambiarMiContrasena({ actual: "mala", nueva: "ClaveNueva2026Larga" })).toEqual({ ok: false, error: "La contraseña actual no es correcta." });
    expect(p.updateUser).not.toHaveBeenCalled();
    p = preparar({ errorActual: { status: 429, message: "rate limit" } });
    expect(await cambiarMiContrasena({ actual: "x", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("Demasiados intentos") });
    expect(p.updateUser).not.toHaveBeenCalled();
  });

  it("traduce los rechazos de Supabase a la nueva contraseña", async () => {
    preparar({ errorCambio: { code: "same_password", message: "x" } });
    expect(await cambiarMiContrasena({ actual: "a1", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("distinta") });
    preparar({ errorCambio: { code: "weak_password", message: "x" } });
    expect(await cambiarMiContrasena({ actual: "a1", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("débil") });
    preparar({ errorCambio: { message: "boom" } });
    expect(await cambiarMiContrasena({ actual: "a1", nueva: "ClaveNueva2026Larga" })).toMatchObject({ ok: false, error: expect.stringContaining("boom") });
  });
});
