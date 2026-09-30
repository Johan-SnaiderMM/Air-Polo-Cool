"use client";

import { ErrorPantalla } from "@/components/ui/error-pantalla";

/** Fallo inesperado fuera de la app interna (inicio de sesión, portal público del cliente). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPantalla error={error} reset={reset} />;
}
