import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseEnv } from "@/utils/supabase/env";

/**
 * Cliente con service role: SALTA el RLS. Solo para código de servidor y solo
 * para tareas acotadas (p. ej. firmar URLs de fotos para el portal público).
 * Devuelve null si SUPABASE_SERVICE_ROLE_KEY no está configurada.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createClient<Database>(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
