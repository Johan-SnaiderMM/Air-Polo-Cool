"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { mensajeDeError } from "@/lib/errores";
import { nombreClave, validarCorreo, validarNombre } from "@/lib/equipo";
import { generarContrasena } from "@/lib/servidor/equipo";
import { createAdminClient } from "@/utils/supabase/admin";
import { obtenerSesion, SESION_EXPIRADA } from "@/utils/supabase/sesion";

/**
 * Gestión del equipo (solo el dueño, con rol «admin»): crear un ayudante, desactivarlo o reactivarlo y
 * darle una contraseña nueva. Crear usuarios y cambiar contraseñas exige la clave de servicio de Supabase,
 * que solo existe en el servidor. Un ayudante siempre nace como «operario» (no borra ni administra).
 *
 * Solo se pueden gestionar ayudantes: nunca administradores ni la cuenta de soporte, para que nadie pueda
 * dejar sin acceso al dueño ni tomar su cuenta desde aquí.
 */
type Fallo = { ok: false; error: string };
export type AccionEquipo = { ok: true } | Fallo;
export type AccionConContrasena = { ok: true; correo: string; contrasena: string } | Fallo;

const SOLO_DUENO: Fallo = { ok: false, error: "Solo el dueño del taller (administrador) puede gestionar el equipo." };
const SIN_CLAVE: Fallo = {
  ok: false,
  error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para gestionar el equipo.",
};
/** ~100 años: Supabase no tiene «para siempre», pero esto equivale a lo mismo. */
const BLOQUEO_INDEFINIDO = "876000h";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function exigirDueno(): Promise<{ ok: true; user: User; admin: Admin } | Fallo> {
  const { user } = await obtenerSesion();
  if (!user) return SESION_EXPIRADA;
  if (user.app_metadata?.rol !== "admin") return SOLO_DUENO;
  const admin = createAdminClient();
  if (!admin) return SIN_CLAVE;
  return { ok: true, user, admin };
}

export async function crearAyudante(datos: { nombre: string; correo: string }): Promise<AccionConContrasena> {
  const ctx = await exigirDueno();
  if (!ctx.ok) return ctx;
  const { user, admin } = ctx;

  const nombre = validarNombre(datos?.nombre);
  if (!nombre.ok) return { ok: false, error: nombre.error };
  const correo = validarCorreo(datos?.correo);
  if (!correo.ok) return { ok: false, error: correo.error };

  // El nombre es el sello que queda en cada registro: debe identificar a una sola persona.
  const { data: perfiles, error: errLista } = await admin.from("perfiles").select("nombre");
  if (errLista) return { ok: false, error: mensajeDeError(errLista) };
  if ((perfiles ?? []).some((p) => nombreClave(p.nombre) === nombreClave(nombre.valor))) {
    return { ok: false, error: "Ya hay una persona con ese nombre. Agrega el apellido para distinguirlas." };
  }

  const contrasena = generarContrasena();
  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: correo.valor,
    password: contrasena,
    email_confirm: true,
    app_metadata: { rol: "operario" },
  });
  if (errCrear || !creado.user) {
    if (errCrear?.code === "email_exists" || /already|registered/i.test(errCrear?.message ?? "")) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    return { ok: false, error: `No se pudo crear el usuario: ${errCrear?.message ?? "error desconocido"}` };
  }

  const { error: errPerfil } = await admin.from("perfiles").insert({
    id: creado.user.id,
    nombre: nombre.valor,
    correo: correo.valor,
    rol: "operario",
    creado_por: user.id,
  });
  if (errPerfil) {
    // Sin perfil el usuario firmaría como «Polo»: se deshace la creación entera.
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false, error: errPerfil.code === "23505" ? "Ya hay una persona con ese nombre." : mensajeDeError(errPerfil) };
  }

  revalidatePath("/equipo");
  return { ok: true, correo: correo.valor, contrasena };
}

/** Busca al ayudante y comprueba que se puede gestionar (existe, no es admin ni soporte, no soy yo). */
async function ayudanteGestionable(admin: Admin, id: unknown, yo: string): Promise<{ ok: true; perfil: { id: string } } | Fallo> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Persona inválida." };
  const { data: p, error } = await admin.from("perfiles").select("id, rol, es_soporte, activo").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!p) return { ok: false, error: "Esa persona ya no existe." };
  if (p.id === yo || p.es_soporte || p.rol !== "operario") {
    return { ok: false, error: "Solo se pueden gestionar los ayudantes (no administradores ni tu propia cuenta)." };
  }
  return { ok: true, perfil: p };
}

export async function cambiarEstadoAyudante(datos: { id: string; activo: boolean }): Promise<AccionEquipo> {
  const ctx = await exigirDueno();
  if (!ctx.ok) return ctx;
  const { user, admin } = ctx;

  const g = await ayudanteGestionable(admin, datos?.id, user.id);
  if (!g.ok) return g;
  const activo = datos.activo === true;

  if (activo) {
    // Reactivar: primero se levanta el bloqueo de Auth; con el perfil activo vuelve el acceso a los datos.
    const { error: errBan } = await admin.auth.admin.updateUserById(g.perfil.id, { ban_duration: "none" });
    if (errBan) return { ok: false, error: `No se pudo reactivar: ${errBan.message}` };
  }

  // Desactivar: el perfil primero, porque es lo que corta YA el acceso a los datos (es_staff()); el bloqueo
  // de Auth además impide que vuelva a iniciar sesión o renovar la suya.
  const { error } = await admin
    .from("perfiles")
    .update({ activo, desactivado_at: activo ? null : new Date().toISOString() })
    .eq("id", g.perfil.id);
  if (error) return { ok: false, error: mensajeDeError(error) };

  if (!activo) {
    const { error: errBan } = await admin.auth.admin.updateUserById(g.perfil.id, { ban_duration: BLOQUEO_INDEFINIDO });
    if (errBan) {
      return { ok: false, error: `Quedó sin acceso a los datos, pero no se pudo bloquear su ingreso: ${errBan.message}. Inténtalo de nuevo.` };
    }
  }

  revalidatePath("/equipo");
  return { ok: true };
}

export async function restablecerContrasenaAyudante(datos: { id: string }): Promise<AccionConContrasena> {
  const ctx = await exigirDueno();
  if (!ctx.ok) return ctx;
  const { user, admin } = ctx;

  const g = await ayudanteGestionable(admin, datos?.id, user.id);
  if (!g.ok) return g;

  const { data: auth, error: errAuth } = await admin.auth.admin.getUserById(g.perfil.id);
  const correo = auth?.user?.email;
  if (errAuth || !correo) return { ok: false, error: "No se encontró el usuario de esa persona." };

  const contrasena = generarContrasena();
  const { error } = await admin.auth.admin.updateUserById(g.perfil.id, { password: contrasena });
  if (error) return { ok: false, error: `No se pudo cambiar la contraseña: ${error.message}` };

  return { ok: true, correo, contrasena };
}
