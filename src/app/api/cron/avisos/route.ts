import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { enviarResumenDiario } from "@/lib/push/aviso-diario";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Resumen de la agenda por aviso (notificación push). Lo llama el programador de Vercel (vercel.json):
 *   /api/cron/avisos?franja=dia    → 7:00 a. m. de Colombia (citas de hoy)
 *   /api/cron/avisos?franja=tarde  → 5:30 p. m. de Colombia (citas de mañana)
 * Vercel manda `Authorization: Bearer <CRON_SECRET>`; sin el secreto correcto no se hace nada.
 */
export const dynamic = "force-dynamic";

function secretoValido(recibido: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !recibido) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const dado = Buffer.from(recibido);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

export async function GET(request: NextRequest) {
  if (!secretoValido(request.headers.get("authorization"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const franja = request.nextUrl.searchParams.get("franja");
  if (franja !== "dia" && franja !== "tarde") return Response.json({ error: "Franja inválida." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  try {
    return Response.json(await enviarResumenDiario(admin, franja));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error al enviar los avisos." }, { status: 500 });
  }
}
