import type { Metadata } from "next";
import Link from "next/link";
import { PaginaFria } from "@/components/ui/pagina-fria";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NoEncontrada() {
  return (
    <PaginaFria
      pantalla
      codigo="404"
      titulo="Esta página se congeló"
      mensaje="La dirección que buscas no existe o cambió de lugar. Volvamos a un sitio más cálido."
    >
      <Link
        href="/"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-base font-semibold text-ink transition-colors active:bg-stone-200"
      >
        Ir al inicio
      </Link>
      <Link
        href="/ordenes"
        className="flex h-12 items-center justify-center rounded-xl border border-white/20 text-sm font-medium text-paper active:bg-white/10"
      >
        Ver órdenes
      </Link>
    </PaginaFria>
  );
}
