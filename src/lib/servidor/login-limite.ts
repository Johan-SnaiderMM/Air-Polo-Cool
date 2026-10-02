import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POLITICA_LOGIN, type TipoClave } from "@/lib/login-limite";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type ClaveLogin = { tipo: TipoClave; clave: string };

/**
 * Claves de los contadores para un intento. Son HUELLAS (HMAC con un secreto del servidor), no el correo ni
 * la IP: si alguien leyera la tabla no vería datos personales ni podría deducirlos con una lista de correos.
 * Sin IP conocida solo hay contador por correo.
 */
export function clavesLogin(entrada: { correo: string; ip: string | null }, secreto: string): ClaveLogin[] {
  const huella = (dominio: string, valor: string) => createHmac("sha256", secreto).update(`${dominio}\0${valor}`).digest("hex").slice(0, 32);
  const claves: ClaveLogin[] = [{ tipo: "correo", clave: `correo:${huella("correo", entrada.correo)}` }];
  if (entrada.ip) {
    claves.push({ tipo: "par", clave: `par:${huella("par", `${entrada.correo}|${entrada.ip}`)}` });
    claves.push({ tipo: "ip", clave: `ip:${huella("ip", entrada.ip)}` });
  }
  return claves;
}

/**
 * El límite NUNCA debe dejar sin ingreso al taller por un fallo suyo: si la base no responde o la migración
 * de la fase 9 aún no está, se registra el problema y se sigue sin el límite adicional (Supabase Auth conserva
 * el suyo por IP).
 */
function alFallar(accion: string, e: unknown) {
  console.error(`[login] límite de intentos: no se pudo ${accion}`, e instanceof Error ? e.message : e);
}

/** El bloqueo vigente más largo entre estas claves, o null. */
export async function bloqueoVigente(admin: Admin, claves: ClaveLogin[]): Promise<Date | null> {
  try {
    const { data, error } = await admin.rpc("login_bloqueado", { p_claves: claves.map((c) => c.clave) });
    if (error) throw new Error(error.message);
    return data ? new Date(data) : null;
  } catch (e) {
    alFallar("consultar el bloqueo", e);
    return null;
  }
}

/**
 * Anota un intento fallido en cada contador, cada uno con su límite. Devuelve el bloqueo que este intento
 * acaba de activar (o el que ya había), para avisar de inmediato en vez de en el intento siguiente.
 */
export async function registrarFallo(admin: Admin, claves: ClaveLogin[]): Promise<Date | null> {
  const resultados = await Promise.allSettled(
    claves.map(async ({ tipo, clave }) => {
      const { max, ventanaSeg, bloqueoSeg } = POLITICA_LOGIN[tipo];
      const { data, error } = await admin.rpc("registrar_fallo_login", { p_clave: clave, p_max: max, p_ventana_seg: ventanaSeg, p_bloqueo_seg: bloqueoSeg });
      if (error) throw new Error(error.message);
      return data ? new Date(data) : null;
    })
  );
  let hasta: Date | null = null;
  for (const r of resultados) {
    if (r.status === "rejected") alFallar("anotar el intento", r.reason);
    else if (r.value && (!hasta || r.value > hasta)) hasta = r.value;
  }
  return hasta;
}

/** Un ingreso correcto borra los contadores del correo y del par (el de la IP no: puede ser una red compartida). */
export async function limpiarAcierto(admin: Admin, claves: ClaveLogin[]): Promise<void> {
  const resultados = await Promise.allSettled(
    claves
      .filter((c) => c.tipo !== "ip")
      .map(async ({ clave }) => {
        const { error } = await admin.rpc("limpiar_login", { p_clave: clave });
        if (error) throw new Error(error.message);
      })
  );
  for (const r of resultados) if (r.status === "rejected") alFallar("limpiar los contadores", r.reason);
}
