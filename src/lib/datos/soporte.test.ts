import { describe, expect, it } from "vitest";
import { cargarEstadoSoporte, ESTADO_NORMAL } from "@/lib/datos/soporte";
import { crearSupabaseFalso } from "@/test/supabase-falso";

const POLO = { id: "u-polo", app_metadata: { rol: "operario" } };
const SOPORTE = { id: "u-soporte", app_metadata: { rol: "admin", soporte: true } };


describe("cargarEstadoSoporte", () => {
  it("Polo: nunca en modo prueba y ni siquiera consulta soporte_modo", async () => {
    const f = crearSupabaseFalso({
      responder: (l) => (l.tabla === "mantenimiento" ? { data: { activo: true, motivo: "Ajuste", desde: "2026-09-30T15:00:00Z" } } : undefined),
    });
    const estado = await cargarEstadoSoporte(f.cliente, POLO);
    expect(estado).toEqual({
      esSoporte: false,
      modoPrueba: false,
      mantenimiento: { activo: true, motivo: "Ajuste", desde: "2026-09-30T15:00:00Z" },
    });
    expect(f.de("select", "soporte_modo")).toHaveLength(0);
  });

  it("soporte: lee su propio modo", async () => {
    const f = crearSupabaseFalso({
      responder: (l) => (l.tabla === "soporte_modo" ? { data: { prueba: true } } : { data: { activo: false, motivo: null, desde: null } }),
    });
    const estado = await cargarEstadoSoporte(f.cliente, SOPORTE);
    expect(estado).toMatchObject({ esSoporte: true, modoPrueba: true, mantenimiento: { activo: false } });
    expect(f.de("select", "soporte_modo")[0].filtros).toEqual([{ col: "user_id", op: "eq", valor: "u-soporte" }]);
  });

  it("soporte sin fila de modo trabaja en modo real", async () => {
    const f = crearSupabaseFalso();
    expect((await cargarEstadoSoporte(f.cliente, SOPORTE)).modoPrueba).toBe(false);
  });

  it("si la migración aún no se ejecutó (las tablas no existen) la app sigue como siempre", async () => {
    const f = crearSupabaseFalso({ responder: () => ({ error: { code: "42P01", message: "relation does not exist" } }) });
    expect(await cargarEstadoSoporte(f.cliente, POLO)).toEqual(ESTADO_NORMAL);
    expect(await cargarEstadoSoporte(f.cliente, SOPORTE)).toEqual({ ...ESTADO_NORMAL, esSoporte: true });
  });
});
