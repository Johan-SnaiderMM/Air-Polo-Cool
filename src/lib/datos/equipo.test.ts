import { describe, expect, it } from "vitest";
import { cargarEquipo } from "@/lib/datos/equipo";
import { cargarPerfil } from "@/lib/datos/perfil";
import { crearSupabaseFalso, type Respuesta } from "@/test/supabase-falso";

const perfil = (extra = {}) => ({ nombre: "Carlos Pérez", rol: "operario", activo: true, es_soporte: false, ...extra });

describe("cargarPerfil", () => {
  const con = (r: Respuesta) => crearSupabaseFalso({ responder: (l) => (l.rpc === "mi_perfil" ? r : undefined) }).cliente;

  it("devuelve el perfil de la sesión", async () => {
    expect(await cargarPerfil(con({ data: [perfil()] }))).toEqual({ nombre: "Carlos Pérez", rol: "operario", activo: true, esSoporte: false });
    expect(await cargarPerfil(con({ data: [perfil({ activo: false, rol: "admin", es_soporte: true })] }))).toEqual({
      nombre: "Carlos Pérez", rol: "admin", activo: false, esSoporte: true,
    });
  });

  it("sin perfil, con la migración sin ejecutar o con una fila rara: null (la app sigue como antes)", async () => {
    expect(await cargarPerfil(con({ data: [] }))).toBeNull();
    expect(await cargarPerfil(con({ data: null }))).toBeNull();
    expect(await cargarPerfil(con({ error: { code: "PGRST202", message: "función no encontrada" } }))).toBeNull();
    expect(await cargarPerfil(con({ data: [perfil({ rol: "superadmin" })] }))).toBeNull();
    expect(await cargarPerfil(con({ data: [{ ...perfil(), nombre: 7 }] }))).toBeNull();
  });
});

describe("cargarEquipo", () => {
  const fila = (id: string, extra = {}) => ({ id, nombre: id, correo: `${id}@x.co`, rol: "operario", es_soporte: false, activo: true, created_at: "2026-10-02T10:00:00Z", ...extra });
  const con = (r: Respuesta) => crearSupabaseFalso({ responder: (l) => (l.tabla === "perfiles" ? r : undefined) });

  it("lista el equipo y oculta la cuenta de soporte a quien no es soporte", async () => {
    const datos = [fila("polo", { rol: "admin" }), fila("ayudante"), fila("soporte", { es_soporte: true, rol: "admin" })];
    const f = con({ data: datos });
    const normal = await cargarEquipo(f.cliente, { verSoporte: false });
    expect(normal.miembros.map((m) => m.nombre)).toEqual(["polo", "ayudante"]);
    expect(normal.miembros[0]).toEqual({ id: "polo", nombre: "polo", correo: "polo@x.co", rol: "admin", esSoporte: false, activo: true, creadoEn: "2026-10-02T10:00:00Z" });
    const soporte = await cargarEquipo(f.cliente, { verSoporte: true });
    expect(soporte.miembros).toHaveLength(3);
    expect(soporte).toMatchObject({ migracionPendiente: false, error: null });
  });

  it("si falta la migración lo avisa sin romper; otro error se traduce", async () => {
    expect(await cargarEquipo(con({ error: { code: "42P01", message: "no existe perfiles" } }).cliente, { verSoporte: false })).toEqual({
      miembros: [], migracionPendiente: true, error: null,
    });
    const otro = await cargarEquipo(con({ error: { code: "XX000", message: "caído" } }).cliente, { verSoporte: false });
    expect(otro).toMatchObject({ miembros: [], migracionPendiente: false });
    expect(otro.error).toBeTruthy();
  });
});
