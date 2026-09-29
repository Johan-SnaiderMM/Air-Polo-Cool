/**
 * Lee y valida las variables públicas de Supabase con mensajes claros
 * (en vez del críptico "Invalid supabaseUrl" que llega desde la librería).
 *
 * Las referencias a process.env.NEXT_PUBLIC_* deben ser literales para que
 * Next.js las sustituya en el bundle del navegador.
 */
export function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY (revisa .env.local o las variables del despliegue)."
    );
  }

  let valida = false;
  try {
    valida = /^https?:$/.test(new URL(url).protocol);
  } catch {
    valida = false;
  }
  if (!valida) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL no es una URL válida (empieza con "${url.slice(0, 12)}…"). Debe verse como https://xxxx.supabase.co`
    );
  }

  return { url, anonKey };
}
