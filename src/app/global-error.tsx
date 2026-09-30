"use client";

import { ErrorPantalla } from "@/components/ui/error-pantalla";
import "./globals.css";

/**
 * Último recurso: se muestra cuando falla el propio layout raíz. Reemplaza a <html> y <body>,
 * por eso los define y carga los estilos por su cuenta.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink text-paper">
        <ErrorPantalla error={error} reset={reset} />
      </body>
    </html>
  );
}
