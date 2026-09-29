import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseEnv } from "@/utils/supabase/env";

/**
 * Cliente anónimo y sin sesión (no lee ni escribe cookies) para el portal
 * público: solo puede ejecutar las RPC concedidas a `anon`.
 */
export function createPublicClient() {
  const { url, anonKey } = supabaseEnv();
  return createClient<Database>(
    url,
    anonKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
