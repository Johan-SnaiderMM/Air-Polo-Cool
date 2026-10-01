import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "@/utils/supabase/env";

const RUTAS_PROTEGIDAS = [
  "/agenda",
  "/ordenes",
  "/vehiculos",
  "/garantias",
  "/cartera",
  "/cotizaciones",
  "/inventario",
  "/caja-menor",
];

function esRutaProtegida(pathname: string) {
  if (pathname === "/") return true; // inicio (dashboard)
  return RUTAS_PROTEGIDAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

/** Copia las cookies de sesión refrescadas a una respuesta de redirección. */
function redirigir(
  request: NextRequest,
  base: NextResponse,
  pathname: string,
  search = ""
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const respuesta = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => respuesta.cookies.set(cookie));
  return respuesta;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra Supabase Auth (no confiar en getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && esRutaProtegida(pathname)) {
    const next = pathname + request.nextUrl.search;
    return redirigir(
      request,
      supabaseResponse,
      "/login",
      `?next=${encodeURIComponent(next)}`
    );
  }

  if (user && pathname === "/login") {
    return redirigir(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}
