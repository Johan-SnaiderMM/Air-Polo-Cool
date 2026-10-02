/**
 * Lista del equipo para la pantalla Equipo. Si la migración de la fase 10 aún no se ejecutó, la tabla
 * `perfiles` no existe: se devuelve `migracionPendiente` en vez de romper la página.
 */
import { esErrorDeMigracion, mensajeDeError } from "@/lib/errores";
import type { RolUsuario } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type MiembroEquipo = {
  id: string;
  nombre: string;
  correo: string | null;
  rol: RolUsuario;
  esSoporte: boolean;
  activo: boolean;
  creadoEn: string;
};

export type EquipoCargado = {
  miembros: MiembroEquipo[];
  migracionPendiente: boolean;
  error: string | null;
};

/** La cuenta de soporte solo se muestra a sí misma: el dueño del taller no tiene por qué verla ni tocarla. */
export async function cargarEquipo(supabase: ClienteServidor, { verSoporte }: { verSoporte: boolean }): Promise<EquipoCargado> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, es_soporte, activo, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    const pendiente = esErrorDeMigracion(error);
    return { miembros: [], migracionPendiente: pendiente, error: pendiente ? null : mensajeDeError(error) };
  }

  const miembros = (data ?? [])
    .filter((p) => verSoporte || !p.es_soporte)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      correo: p.correo,
      rol: p.rol,
      esSoporte: p.es_soporte,
      activo: p.activo,
      creadoEn: p.created_at,
    }));
  return { miembros, migracionPendiente: false, error: null };
}
