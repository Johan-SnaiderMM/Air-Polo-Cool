/**
 * Analítica de uso (módulo puro). Mide qué pantallas se usan y qué tan rápido cargan, SIN cookies y sin datos
 * personales. Para eso, antes de enviar cada evento se limpia la dirección:
 *  - el portal del cliente (/orden/…) no se mide nunca (su dirección lleva el token de acceso a la orden);
 *  - se quitan los parámetros y el fragmento (?next=…, #…);
 *  - los identificadores de una orden, vehículo o cotización (uuid) y cualquier segmento largo y opaco se
 *    reemplazan por un marcador, así «/ordenes/<uuid>» se cuenta como «/ordenes/:id».
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPACO = /^[A-Za-z0-9_-]{16,}$/;

/** Devuelve la dirección ya limpia, o null si ese evento no debe medirse. */
export function limpiarUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url, "https://app.invalida");
  } catch {
    return null;
  }
  if (u.pathname === "/orden" || u.pathname.startsWith("/orden/")) return null;

  const ruta = u.pathname
    .split("/")
    .map((segmento) => (UUID.test(segmento) ? ":id" : OPACO.test(segmento) ? ":token" : segmento))
    .join("/");
  // Una dirección absoluta conserva su origen; una relativa se devuelve como ruta.
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? `${u.origin}${ruta}` : ruta;
}

/** Para `beforeSend` de la analítica y de Speed Insights: limpia la dirección o descarta el evento. */
export function filtrarEvento<T extends { url: string }>(evento: T): T | null {
  const url = limpiarUrl(evento.url);
  return url === null ? null : { ...evento, url };
}
