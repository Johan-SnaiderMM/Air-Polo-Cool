/**
 * Estado del usuario de soporte: si la sesión es de soporte, en qué modo trabaja (real o prueba) y
 * si la app está en mantenimiento. Si aún no se ejecutó la migración de la fase 6, las tablas no
 * existen: se devuelve el estado normal (real, sin mantenimiento) en vez de romper la app.
 */
import { esUsuarioSoporte } from "@/lib/autor";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type EstadoSoporte = {
  esSoporte: boolean;
  /** Solo puede ser true para soporte. */
  modoPrueba: boolean;
  mantenimiento: { activo: boolean; motivo: string | null; desde: string | null };
};

export const ESTADO_NORMAL: EstadoSoporte = {
  esSoporte: false,
  modoPrueba: false,
  mantenimiento: { activo: false, motivo: null, desde: null },
};

type UsuarioMinimo = { id: string; app_metadata?: Record<string, unknown> };

export async function cargarEstadoSoporte(supabase: ClienteServidor, user: UsuarioMinimo): Promise<EstadoSoporte> {
  const esSoporte = esUsuarioSoporte(user);
  const [mant, modo] = await Promise.all([
    supabase.from("mantenimiento").select("activo, motivo, desde").maybeSingle(),
    esSoporte
      ? supabase.from("soporte_modo").select("prueba").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    esSoporte,
    modoPrueba: esSoporte && modo.data?.prueba === true,
    mantenimiento: {
      activo: mant.data?.activo === true,
      motivo: mant.data?.motivo ?? null,
      desde: mant.data?.desde ?? null,
    },
  };
}
