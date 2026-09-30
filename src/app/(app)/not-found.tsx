import Link from "next/link";
import { PaginaFria } from "@/components/ui/pagina-fria";

export default function NoEncontradoApp() {
  return (
    <PaginaFria
      codigo="404"
      titulo="No encontrado"
      mensaje="Ese registro no existe o ya no está disponible. Quizá se enfrió y se archivó."
    >
      <Link
        href="/"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-base font-semibold text-ink transition-colors active:bg-stone-200"
      >
        Ir al inicio
      </Link>
    </PaginaFria>
  );
}
