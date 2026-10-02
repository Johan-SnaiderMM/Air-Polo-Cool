/**
 * Política del límite de intentos de ingreso (módulo puro; el SQL está en la migración de la fase 9).
 *
 * Tres contadores independientes, cada uno con su límite y su bloqueo:
 *  - «par»    correo + IP: el que frena a quien prueba contraseñas desde un mismo sitio (5 fallos).
 *  - «correo» el correo desde cualquier IP: frena un ataque repartido entre muchas direcciones (20 fallos).
 *  - «ip»     la IP con cualquier correo: frena a quien prueba muchos usuarios (40 fallos).
 *
 * Se separan a propósito: así alguien de fuera no puede dejar sin acceso al dueño del taller con solo
 * equivocarse 5 veces desde otra red (bloquearía solo su «par»), y aun el ataque repartido tiene techo.
 */
export type TipoClave = "par" | "correo" | "ip";

export type LimiteLogin = { max: number; ventanaSeg: number; bloqueoSeg: number };

const QUINCE_MINUTOS = 15 * 60;

export const POLITICA_LOGIN: Record<TipoClave, LimiteLogin> = {
  par: { max: 5, ventanaSeg: QUINCE_MINUTOS, bloqueoSeg: QUINCE_MINUTOS },
  correo: { max: 20, ventanaSeg: QUINCE_MINUTOS, bloqueoSeg: QUINCE_MINUTOS },
  ip: { max: 40, ventanaSeg: QUINCE_MINUTOS, bloqueoSeg: QUINCE_MINUTOS },
};

export const normalizarCorreo = (correo: string) => correo.trim().toLowerCase();

/**
 * IP del cliente según las cabeceras que pone la plataforma (Vercel las fija en el borde, el cliente no las
 * controla). Null si no hay una con aspecto de IP (p. ej. en desarrollo local): entonces solo cuenta el correo.
 */
export function ipDeCliente(cabeceras: { get(nombre: string): string | null }): string | null {
  const candidata = (cabeceras.get("x-forwarded-for")?.split(",")[0] ?? cabeceras.get("x-real-ip") ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidata) ? candidata : null;
}

/** Mensaje al bloqueado: dice cuánto esperar, redondeado hacia arriba, y no revela si el correo existe. */
export function mensajeBloqueo(hasta: Date, ahora: Date = new Date()): string {
  const minutos = Math.max(1, Math.ceil((hasta.getTime() - ahora.getTime()) / 60_000));
  return `Demasiados intentos fallidos. Por seguridad, espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} antes de volver a intentarlo.`;
}

export const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";
export const MENSAJE_ACCESO_DESACTIVADO = "Tu acceso está desactivado. Habla con el dueño del taller.";
export const MENSAJE_LIMITE_PROVEEDOR = "Demasiados intentos en poco tiempo. Espera unos minutos y vuelve a intentarlo.";
