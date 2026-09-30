import type { NextConfig } from "next";

const esDev = process.env.NODE_ENV !== "production";

/** Host de Supabase (API y Storage): único origen externo al que la app se conecta o del que carga fotos. */
function origenSupabase(): string[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [url.origin];
  } catch {
    return ["https://*.supabase.co"];
  }
}

/**
 * Content-Security-Policy. Next.js inyecta scripts en línea para hidratar, así que se permite
 * 'unsafe-inline' en script/style (sin nonces); aun así se bloquea: cargar código de otros
 * dominios, enviar datos a servidores ajenos, incrustar la app en otro sitio y plugins.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${origenSupabase().join(" ")}`,
  `connect-src 'self' ${origenSupabase().join(" ")}${esDev ? " ws: wss:" : ""}`,
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos llegan comprimidas (~300 KB); el tope del bucket es 2 MB.
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [
      {
        // El service worker debe revalidarse siempre para que las actualizaciones lleguen.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La cámara la usa la propia app (captura de fotos); micrófono y ubicación no.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
