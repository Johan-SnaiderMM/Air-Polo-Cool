/**
 * Ayudas del navegador para los avisos (push). Módulo puro: recibe lo que necesita (navegador,
 * clave) en vez de leer globales, así se prueba sin un navegador real.
 */

/** La clave pública VAPID (base64url) como bytes, que es lo que pide `pushManager.subscribe`. */
export function claveVapidABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export type EntornoAvisos = {
  /** navigator.userAgent */
  agente: string;
  /** ¿Está abierta como app instalada (pantalla de inicio)? */
  instalada: boolean;
  /** ¿Existen service worker, PushManager y Notification? */
  conPush: boolean;
};

export type DisponibilidadAvisos = "disponible" | "instalar_en_inicio" | "no_soportado";

/**
 * En iPhone/iPad los avisos solo existen cuando la app está instalada en la pantalla de inicio
 * (iOS 16.4 o posterior); desde el navegador normal no hay manera. En el resto, basta con que el
 * navegador los soporte.
 */
export function disponibilidadAvisos({ agente, instalada, conPush }: EntornoAvisos): DisponibilidadAvisos {
  const esIOS = /iPad|iPhone|iPod/.test(agente);
  if (esIOS && !instalada) return "instalar_en_inicio";
  return conPush ? "disponible" : "no_soportado";
}
