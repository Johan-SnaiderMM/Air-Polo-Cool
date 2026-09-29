// En Next.js 16 la convención `middleware.ts` pasó a llamarse `proxy.ts`
// (misma función: se ejecuta antes de cada request).
import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos, íconos PWA, manifest y el portal público /orden/[token]
    // (no pasa por Supabase Auth; "orden/" con barra no captura "/ordenes").
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|orden/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
