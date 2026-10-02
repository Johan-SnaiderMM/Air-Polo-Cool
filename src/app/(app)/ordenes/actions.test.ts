import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  asignarFotoARepuesto,
  cambiarEstadoOrden,
  eliminarEvidencia,
  guardarOrden,
} from "@/app/(app)/ordenes/actions";
import { cargarContextoOrden, enviarWhatsApp, envioAutomaticoActivo } from "@/lib/notificaciones";
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
const FOTO = "223e4567-e89b-12d3-a456-426614174000";
const LINEA = "323e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(envioAutomaticoActivo).mockReset().mockReturnValue(false);
  vi.mocked(cargarContextoOrden).mockReset();
  vi.mocked(enviarWhatsApp).mockReset();
});

function usar(responder?: (l: Llamada) => Respuesta | undefined, usuario?: null | { app_metadata?: { rol?: string } }) {
  const f = crearSupabaseFalso({ responder, usuario });
  sesionFalsa.cliente = f.cliente;
  return f;
}

// ---------------------------------------------------------------------
// Cambio rápido de estado
// ---------------------------------------------------------------------
describe("cambiarEstadoOrden", () => {
  const previa = (estado: string, notas: string | null = null) => (l: Llamada): Respuesta | undefined => {
    if (l.tabla === "ordenes_servicio" && l.op === "select") return { data: [{ estado, notas }] };
    if (l.op === "update") return { data: [{ id: ORDEN }] };
    return undefined;
  };
  const cambiar = (estado: string, extra: { nota?: string; meses?: number | null } = {}) =>
    cambiarEstadoOrden({ ordenId: ORDEN, estado, nota: extra.nota ?? "", mantenimientoMeses: extra.meses ?? null });

  it("valida orden, estado y el motivo de una cancelación", async () => {
    const f = usar(previa("recibido"));
    expect(await cambiarEstadoOrden({ ordenId: "x", estado: "listo", nota: "", mantenimientoMeses: null })).toEqual({ ok: false, error: "Orden inválida." });
    expect(await cambiar("volando")).toEqual({ ok: false, error: "Estado inválido." });
    expect(await cambiar("cancelado", { nota: " a " })).toEqual({ ok: false, error: "Escribe el motivo de la cancelación." });
    expect(f.llamadas).toHaveLength(0);
  });

  it("sin sesión, orden inexistente o mismo estado: no actualiza", async () => {
    let f = usar(previa("recibido"), null);
    expect(await cambiar("listo")).toMatchObject({ ok: false, error: expect.stringContaining("sesión expiró") });
    expect(f.de("update")).toHaveLength(0);

    f = usar(() => ({ data: [] }));
    expect(await cambiar("listo")).toEqual({ ok: false, error: "La orden no existe o no tienes permisos." });

    f = usar(previa("listo"));
    expect(await cambiar("listo")).toEqual({ ok: false, error: "La orden ya está en ese estado." });
    expect(f.de("update")).toHaveLength(0);
  });

  it("actualiza solo estado, mantenimiento, bitácora y fecha de entrega; la bitácora conserva lo anterior", async () => {
    const f = usar(previa("diagnostico", "nota previa del taller"));
    const r = await cambiar("listo", { nota: "  pruebas   de presión OK ", meses: 6 });
    expect(r).toEqual({ ok: true });
    const [u] = f.de("update", "ordenes_servicio");
    expect(u.filtros).toEqual([{ col: "id", op: "eq", valor: ORDEN }]);
    const p = u.payload as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(["estado", "fecha_entrega", "mantenimiento_meses", "notas"]);
    expect(p).toMatchObject({ estado: "listo", mantenimiento_meses: 6, fecha_entrega: null });
    const notas = String(p.notas).split("\n");
    expect(notas[0]).toBe("nota previa del taller");
    expect(notas[1]).toMatch(/· Polo · Diagnóstico → Listo · pruebas de presión OK$/);
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/ordenes", `/ordenes/${ORDEN}`, "/garantias", "/cartera", "/"]);
  });

  it("entregado NO toca fecha_entrega (la sella el trigger); salir de entregado la limpia", async () => {
    let f = usar(previa("listo"));
    await cambiar("entregado", { meses: 12 });
    expect(Object.keys(f.de("update")[0].payload as object)).not.toContain("fecha_entrega");

    f = usar(previa("entregado"));
    await cambiar("en_proceso");
    expect(f.de("update")[0].payload).toMatchObject({ estado: "en_proceso", fecha_entrega: null });
  });

  it("el mantenimiento solo vale 3/6/12 y solo en Listo/Entregado", async () => {
    let f = usar(previa("recibido"));
    await cambiar("listo", { meses: 5 });
    expect(f.de("update")[0].payload).toMatchObject({ mantenimiento_meses: null });

    f = usar(previa("recibido"));
    await cambiar("en_proceso", { meses: 6 });
    expect(f.de("update")[0].payload).toMatchObject({ mantenimiento_meses: null });
  });

  it("cancelar guarda el motivo en la bitácora", async () => {
    const f = usar(previa("en_proceso"));
    await cambiar("cancelado", { nota: "el cliente desistió" });
    const notas = String((f.de("update")[0].payload as { notas: string }).notas);
    expect(notas).toContain("En proceso → Cancelado · el cliente desistió");
  });

  it("la bitácora lleva el nombre del perfil de la sesión (el teléfono no puede poner otro)", async () => {
    const perfil = { data: [{ nombre: "Carlos Pérez", rol: "operario", activo: true, es_soporte: false }] };
    const f = usar((l) => (l.rpc === "mi_perfil" ? perfil : previa("recibido")(l)));
    await cambiar("diagnostico");
    const notas = String((f.de("update")[0].payload as { notas: string }).notas);
    expect(notas).toMatch(/· Carlos Pérez · Recibido → Diagnóstico/);
    expect(notas).not.toContain("· Polo ·");
  });

  it("si la actualización no toca ninguna fila (permisos) o falla, lo dice y no refresca", async () => {
    usar((l) => (l.op === "update" ? { data: [] } : previa("recibido")(l)));
    expect(await cambiar("listo")).toEqual({ ok: false, error: "No se pudo actualizar la orden." });
    usar((l) => (l.op === "update" ? { error: { code: "42501", message: "permission denied" } } : previa("recibido")(l)));
    expect(await cambiar("listo")).toMatchObject({ ok: false, error: expect.stringContaining("permisos") });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  describe("aviso automático por WhatsApp", () => {
    const contexto = { estado: "listo", telefono: "+573001234567", urlPublica: "u", mensajes: { recepcion: "r", listo: "MENSAJE LISTO", entregado: "e" } };

    it("al pasar a Listo con el envío activo manda el mensaje; si falla, el cambio NO se revierte", async () => {
      vi.mocked(envioAutomaticoActivo).mockReturnValue(true);
      vi.mocked(cargarContextoOrden).mockResolvedValue(contexto as never);
      vi.mocked(enviarWhatsApp).mockResolvedValue({ ok: true });
      usar(previa("en_proceso"));
      expect(await cambiar("listo")).toEqual({ ok: true, aviso: "WhatsApp enviado al cliente." });
      expect(enviarWhatsApp).toHaveBeenCalledWith("+573001234567", "MENSAJE LISTO");

      vi.mocked(enviarWhatsApp).mockResolvedValue({ ok: false, error: "servidor caído" });
      usar(previa("en_proceso"));
      expect(await cambiar("listo")).toEqual({ ok: true, aviso: "No se pudo enviar el WhatsApp: servidor caído" });
    });

    it("no avisa en otros estados ni con el envío desactivado", async () => {
      vi.mocked(envioAutomaticoActivo).mockReturnValue(true);
      usar(previa("recibido"));
      expect(await cambiar("diagnostico")).toEqual({ ok: true });
      vi.mocked(envioAutomaticoActivo).mockReturnValue(false);
      usar(previa("recibido"));
      expect(await cambiar("listo")).toEqual({ ok: true });
      expect(enviarWhatsApp).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------
// Guardar (editar) la orden desde el formulario
// ---------------------------------------------------------------------
describe("guardarOrden", () => {
  function formulario(extra: Record<string, string> = {}) {
    const fd = new FormData();
    const base: Record<string, string> = {
      orden_id: ORDEN, kilometraje: "85000", diagnostico_inicial: " Fuga ", trabajos_a_realizar: "",
      mano_obra: "200000", total_cobrado: "450000", dias_garantia: "90", estado: "en_proceso",
      pertenencias: "", mantenimiento_meses: "",
    };
    for (const [k, v] of Object.entries({ ...base, ...extra })) fd.set(k, v);
    return fd;
  }
  const correr = (fd: FormData, previo = "recibido") => {
    const f = usar((l) => {
      if (l.op === "select") return { data: [{ estado: previo }] };
      if (l.op === "update") return { data: [{ id: ORDEN }] };
      return undefined;
    });
    return guardarOrden({}, fd).then((r) => ({ r, f }));
  };

  it("sin sesión redirige al login", async () => {
    usar(undefined, null);
    await expect(guardarOrden({}, formulario())).rejects.toThrow("REDIRECT:/login");
  });

  it("valida kilometraje, cobros, garantía y estado", async () => {
    const casos: [Record<string, string>, string][] = [
      [{ orden_id: "x" }, "Orden inválida."],
      [{ kilometraje: "-1" }, "El kilometraje debe ser un número entero mayor o igual a 0."],
      [{ kilometraje: "1.5" }, "El kilometraje debe ser un número entero mayor o igual a 0."],
      [{ mano_obra: "-5" }, "La mano de obra debe ser un valor mayor o igual a 0."],
      [{ total_cobrado: "abc" }, "El total cobrado debe ser un valor mayor o igual a 0."],
      [{ dias_garantia: "45" }, "Selecciona un plazo de garantía válido."],
      [{ estado: "volando" }, "Estado inválido."],
      [{ pertenencias: "{no es json" }, "Las pertenencias no tienen un formato válido."],
    ];
    for (const [extra, error] of casos) {
      const f = usar();
      expect(await guardarOrden({}, formulario(extra)), JSON.stringify(extra)).toEqual({ error });
      expect(f.de("update"), JSON.stringify(extra)).toHaveLength(0);
    }
  });

  it("actualiza la orden con los valores limpios y limpia fecha_entrega si no está entregada", async () => {
    const { r, f } = await correr(formulario({ kilometraje: "", mantenimiento_meses: "6" }));
    expect(r).toEqual({ ok: "Cambios guardados." });
    expect(f.de("update", "ordenes_servicio")[0].payload).toEqual({
      kilometraje: null,
      diagnostico_inicial: "Fuga",
      trabajos_a_realizar: null,
      mano_obra: 200000,
      total_cobrado: 450000,
      dias_garantia: 90,
      estado: "en_proceso",
      pertenencias: null,
      mantenimiento_meses: 6,
      fecha_entrega: null,
    });
  });

  it("avisa por WhatsApp solo si cambió a Listo/Entregado con el envío activo", async () => {
    vi.mocked(envioAutomaticoActivo).mockReturnValue(true);
    vi.mocked(cargarContextoOrden).mockResolvedValue({ telefono: "+57300", mensajes: { listo: "M", entregado: "E", recepcion: "R" } } as never);
    vi.mocked(enviarWhatsApp).mockResolvedValue({ ok: true });
    expect((await correr(formulario({ estado: "listo" }))).r).toEqual({ ok: "Cambios guardados. WhatsApp enviado al cliente." });
    expect((await correr(formulario({ estado: "listo" }), "listo")).r).toEqual({ ok: "Cambios guardados." }); // no cambió de estado
  });
});

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------
describe("eliminarEvidencia y asignarFotoARepuesto", () => {
  it("eliminar: borra la fila y su archivo; con cero filas (RLS) avisa que solo el admin borra", async () => {
    let f = usar((l) => (l.op === "delete" ? { data: [{ id: FOTO }] } : { data: [{ url_imagen: `${ORDEN}/${FOTO}.webp` }] }));
    expect(await eliminarEvidencia({ ordenId: ORDEN, evidenciaId: FOTO })).toEqual({ ok: true });
    expect(f.borrados).toEqual([{ bucket: "evidencias-ordenes", rutas: [`${ORDEN}/${FOTO}.webp`] }]);

    f = usar((l) => (l.op === "delete" ? { data: [] } : { data: [{ url_imagen: "x" }] }));
    expect(await eliminarEvidencia({ ordenId: ORDEN, evidenciaId: FOTO })).toMatchObject({ ok: false, error: expect.stringContaining("administrador") });
    expect(f.borrados).toHaveLength(0); // no se toca el archivo si la fila no se pudo borrar
  });

  it("asignar: liga y desliga dentro de la MISMA orden; ids inválidos y foto inexistente fallan", async () => {
    const f = usar((l) => (l.op === "update" ? { data: [{ id: FOTO }] } : undefined));
    expect(await asignarFotoARepuesto({ ordenId: ORDEN, evidenciaId: FOTO, ordenRepuestoId: LINEA })).toEqual({ ok: true });
    expect(await asignarFotoARepuesto({ ordenId: ORDEN, evidenciaId: FOTO, ordenRepuestoId: null })).toEqual({ ok: true });
    const [liga, desliga] = f.de("update", "evidencias_fotograficas");
    expect(liga.payload).toEqual({ orden_repuesto_id: LINEA });
    expect(desliga.payload).toEqual({ orden_repuesto_id: null });
    expect(liga.filtros).toContainEqual({ col: "orden_id", op: "eq", valor: ORDEN });

    expect(await asignarFotoARepuesto({ ordenId: ORDEN, evidenciaId: "x", ordenRepuestoId: null })).toEqual({ ok: false, error: "Datos inválidos." });
    usar((l) => (l.op === "update" ? { data: [] } : undefined));
    expect(await asignarFotoARepuesto({ ordenId: ORDEN, evidenciaId: FOTO, ordenRepuestoId: LINEA })).toEqual({ ok: false, error: "No se encontró la foto." });
  });
});
