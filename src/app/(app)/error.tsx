"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brick-100 text-brick-700">
        <TriangleAlert className="size-9" aria-hidden />
      </span>
      <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Algo salió mal</h2>
      <p className="max-w-sm text-sm text-stone-600">
        No se pudo cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.
        {error.digest ? ` (ref. ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        className="flex h-14 items-center gap-2 rounded-xl bg-ink px-8 text-base font-semibold text-white active:bg-ink-soft"
      >
        <RotateCw className="size-5" aria-hidden />
        Reintentar
      </button>
    </section>
  );
}
