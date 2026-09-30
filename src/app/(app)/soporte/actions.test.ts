import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { cambiarMantenimiento, cambiarModoPrueba } from "@/app/(app)/soporte/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type OpcionesFalso, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SOPORTE = { id: "u-soporte", app_metadata: { rol: "admin", soporte: true } };

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(usuario?: OpcionesFalso["usuario"], responder?: (l: Llamada) => Respuesta | undefined) {
  const f = crearSupabaseFalso({ usuario, responder });
  sesionFalsa.cliente = f.cliente;
  return f;
}

describe("cambiar de modo", () => {
  it("soporte: llama a la función de la base y refresca toda la app", async () => {
    const f = usar(SOPORTE);
    expect(await cambiarModoPrueba(true)).toEqual({ ok: true });
    expect(f.de("rpc", "cambiar_modo_prueba")[0].payload).toEqual({ p_activo: true });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    await cambiarModoPrueba(false);
    expect(f.de("rpc", "cambiar_modo_prueba")[1].payload).toEqual({ p_activo: false });
  });

  it("Polo no puede, y ni siquiera llega a la base", async () => {
    const f = usar({ id: "u-polo", app_metadata: { rol: "operario" } });
    expect(await cambiarModoPrueba(true)).toEqual({ ok: false, error: "Esta acción es solo para el usuario de soporte." });
    expect(f.llamadas).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin sesión: la sesión expiró", async () => {
    const f = usar(null);
    expect(await cambiarModoPrueba(true)).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });
    expect(f.llamadas).toHaveLength(0);
  });

  it("un error de la base se devuelve sin refrescar", async () => {
    usar(SOPORTE, () => ({ error: { code: "42501", message: "Solo el usuario de soporte puede cambiar de modo." } }));
    expect(await cambiarModoPrueba(true)).toEqual({ ok: false, error: "No tienes permisos para esta acción (revisa el rol del usuario)." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("mantenimiento", () => {
  it("soporte lo activa con un motivo y lo desactiva", async () => {
    const f = usar(SOPORTE);
    expect(await cambiarMantenimiento(true, "Actualizando precios")).toEqual({ ok: true });
    expect(await cambiarMantenimiento(false, "")).toEqual({ ok: true });
    expect(f.de("rpc", "cambiar_mantenimiento").map((l) => l.payload)).toEqual([
      { p_activo: true, p_motivo: "Actualizando precios" },
      { p_activo: false, p_motivo: "" },
    ]);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("Polo no puede activarlo", async () => {
    const f = usar({ id: "u-polo", app_metadata: { rol: "operario" } });
    expect(await cambiarMantenimiento(true, "x")).toMatchObject({ ok: false });
    expect(f.llamadas).toHaveLength(0);
  });
});
