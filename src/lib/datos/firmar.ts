import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Firma URLs temporales de un bucket privado (ruta → URL). Una sola llamada para todas las rutas
 * (sin repetir) y un Map vacío si no hay nada que firmar. Las rutas que no se puedan firmar
 * simplemente no aparecen en el Map: quien lo usa muestra «No disponible».
 */
export async function firmarRutas(
  cliente: Pick<SupabaseClient, "storage">,
  bucket: string,
  rutas: string[],
  vigenciaSegundos: number
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unicas = [...new Set(rutas)];
  if (unicas.length === 0) return urls;
  const { data } = await cliente.storage.from(bucket).createSignedUrls(unicas, vigenciaSegundos);
  for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  return urls;
}
