import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NoEncontradoApp() {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-stone-200 text-stone-600">
        <SearchX className="size-9" aria-hidden />
      </span>
      <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">No encontrado</h2>
      <p className="max-w-sm text-sm text-stone-600">
        Ese registro no existe o ya no está disponible.
      </p>
      <Link
        href="/"
        className="flex h-14 items-center rounded-xl bg-ink px-8 text-base font-semibold text-white active:bg-ink-soft"
      >
        Ir al inicio
      </Link>
    </section>
  );
}
