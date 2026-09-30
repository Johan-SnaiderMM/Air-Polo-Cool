import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { eliminarOrden } from "@/app/(app)/ordenes/actions";
import { crearSupabaseFalso, sesionFalsa, type Llamada, type Respuesta } from "@/test/supabase-falso";

vi.mock("@/utils/supabase/server", async () => (await import("@/test/supabase-falso")).moduloServidorFalso());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@/lib/notificaciones", () => ({
  cargarContextoOrden: vi.fn(),
  enviarWhatsApp: vi.fn(),
  envioAutomaticoActivo: vi.fn(),
}));

const ORDEN = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.mocked(revalidatePath).mockClear());

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null | { app_metadata?: { rol?: string } }) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}

type Caso = { estado?: string | null; pagos?: number; borradas?: number; error?: { code?: string; message: string } };

/** La «base»: una orden con dos fotos, en el estado y con los pagos que diga el caso. */
const caso = ({ estado = "recibido", pagos = 0, borradas = 1, error }: Caso = {}) => (l: Llamada): Respuesta | undefined => {
  if (l.tabla === "ordenes_servicio" && l.op === "select") return { data: estado ? [{ estado }] : [] };
  if (l.tabla === "pagos_orden") return { data: [], count: pagos };
  if (l.tabla === "evidencias_fotograficas") return { data: [{ url_imagen: `${ORDEN}/a.jpg` }, { url_imagen: `${ORDEN}/b.jpg` }] };
  if (l.tabla === "ordenes_servicio" && l.op === "delete") {
    return error ? { error } : { data: Array.from({ length: borradas }, () => ({ id: ORDEN })) };
  }
  return undefined;
};

describe("eliminarOrden", () => {
  it("borra la orden en Recibido sin pagos, quita sus fotos del almacenamiento y refresca", async () => {
    const f = usar(caso());
    expect(await eliminarOrden({ ordenId: ORDEN })).toEqual({ ok: true });
    const borrado = f.de("delete", "ordenes_servicio");
    expect(borrado).toHaveLength(1);
    expect(borrado[0].filtros).toEqual([
      { col: "id", op: "eq", valor: ORDEN },
      { col: "estado", op: "eq", valor: "recibido" },
    ]);
    expect(f.borrados).toEqual([{ bucket: "evidencias-ordenes", rutas: [`${ORDEN}/a.jpg`, `${ORDEN}/b.jpg`] }]);
    expect(revalidatePath).toHaveBeenCalledWith("/ordenes");
  });

  it("rechaza cualquier otro estado, una orden con pagos y una inexistente, sin borrar nada", async () => {
    const soloRecibido = "Solo se pueden eliminar órdenes en estado Recibido. Las demás se cancelan.";
    const casos: [Caso, string][] = [
      [{ estado: "en_proceso" }, soloRecibido],
      [{ estado: "entregado" }, soloRecibido],
      [{ pagos: 1 }, "La orden tiene pagos registrados: no se puede eliminar. Cancélala en su lugar."],
      [{ estado: null }, "La orden ya no existe."],
    ];
    for (const [opciones, error] of casos) {
      const f = usar(caso(opciones));
      expect(await eliminarOrden({ ordenId: ORDEN }), JSON.stringify(opciones)).toEqual({ ok: false, error });
      expect(f.de("delete")).toHaveLength(0);
      expect(f.borrados).toHaveLength(0);
    }
  });

  it("sin permiso (RLS devuelve 0 filas) avisa y no toca el almacenamiento", async () => {
    const f = usar(caso({ borradas: 0 }), { app_metadata: { rol: "operario" } });
    expect(await eliminarOrden({ ordenId: ORDEN })).toEqual({
      ok: false,
      error: "No se pudo eliminar. Solo el administrador puede borrar órdenes.",
    });
    expect(f.borrados).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("valida el id y la sesión, y devuelve el error de la base", async () => {
    expect(await eliminarOrden({ ordenId: "x" })).toEqual({ ok: false, error: "Datos inválidos." });
    usar(undefined, null);
    expect(await eliminarOrden({ ordenId: ORDEN })).toMatchObject({ ok: false, error: "Tu sesión expiró. Vuelve a ingresar." });
    usar(caso({ error: { code: "XX000", message: "falló" } }));
    expect(await eliminarOrden({ ordenId: ORDEN })).toEqual({ ok: false, error: "falló" });
  });
});
