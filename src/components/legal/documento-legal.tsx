import Link from "next/link";
import { ACTUALIZADO_LEGAL, type DocumentoLegal } from "@/lib/legal";
import { BotonVolver } from "@/components/legal/boton-volver";

/** Página de un documento legal: título, fecha de revisión, índice de secciones y texto. Sin sesión ni cookies. */
export function PaginaLegal({ documento, otro }: { documento: DocumentoLegal; otro: { href: string; texto: string } }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-5 pb-16">
      <BotonVolver />
      <article className="mt-3 space-y-6">
        <header className="space-y-2">
          <h1 className="font-serif text-[32px] leading-tight font-medium tracking-tight">{documento.titulo}</h1>
          <p className="text-[13px] text-stone-500">Última revisión: {ACTUALIZADO_LEGAL}</p>
          <p className="text-[15px] leading-relaxed text-stone-700">{documento.introduccion}</p>
        </header>

        <nav aria-label="Contenido" className="rounded-2xl border border-stone-200/70 bg-white p-4">
          <ol className="space-y-1.5 text-[14px]">
            {documento.secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-stone-600 underline-offset-2 hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {documento.secciones.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-4 space-y-2">
            <h2 className="font-serif text-[22px] leading-snug font-medium">{s.titulo}</h2>
            {s.parrafos.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-stone-700">
                {p}
              </p>
            ))}
            {s.lista && (
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700 marker:text-stone-400">
                {s.lista.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="border-t border-stone-200/70 pt-4 text-[14px] text-stone-600">
          Consulta también nuestro{" "}
          <Link href={otro.href} className="font-medium text-ink underline underline-offset-2">
            {otro.texto}
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
