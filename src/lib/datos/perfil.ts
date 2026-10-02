/**
 * Perfil de la sesión (fase 10): nombre visible (el sello de autoría), rol y si el acceso sigue activo.
 * Si la migración aún no se ejecutó, o el usuario no tiene perfil, se devuelve null y la app sigue como
 * antes (el sello sale de la marca de soporte) en vez de romperse.
 */
import type { RolUsuario } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

export type PerfilSesion = {
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  esSoporte: boolean;
};

export async function cargarPerfil(supabase: ClienteServidor): Promise<PerfilSesion | null> {
  const { data, error } = await supabase.rpc("mi_perfil");
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const p = data[0];
  if (typeof p.nombre !== "string" || (p.rol !== "admin" && p.rol !== "operario")) return null;
  return { nombre: p.nombre, rol: p.rol, activo: p.activo !== false, esSoporte: p.es_soporte === true };
}
