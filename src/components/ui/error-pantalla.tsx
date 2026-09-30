"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { PaginaFria } from "@/components/ui/pagina-fria";

/**
 * Pantalla de error inesperado (a pantalla completa) con la misma identidad visual que el 404.
 * La usan `error.tsx` (fallos dentro de /login y el portal del cliente) y `global-error.tsx`
 * (fallos del propio layout raíz, cuando ya no hay nada más que mostrar).
 */
export function ErrorPantalla({
  error,
  reset,
  conEnlaceInicio = true,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  conEnlaceInicio?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PaginaFria
      pantalla
      titulo="Se nos congeló algo"
      mensaje={`No se pudo cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.${error.digest ? ` (ref. ${error.digest})` : ""}`}
    >
      <button
        type="button"
        onClick={reset}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-ink transition-colors active:bg-stone-200"
      >
        <RotateCw className="size-5" aria-hidden />
        Reintentar
      </button>
      {conEnlaceInicio && (
        // <a> y no <Link>: si falló el layout raíz, una navegación del cliente podría no recuperarse;
        // una carga completa de la página sí.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/"
          className="flex h-12 items-center justify-center rounded-xl border border-white/20 text-sm font-medium text-paper active:bg-white/10"
        >
          Ir al inicio
        </a>
      )}
    </PaginaFria>
  );
}
