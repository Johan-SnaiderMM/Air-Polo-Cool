"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type FotoPortal = {
  url: string;
  alt: string;
  notas: string | null;
};

export type ColumnaGaleria = {
  titulo: string;
  /** Estilo del encabezado de la columna. */
  tono: "neutro" | "rojo" | "verde";
  fotos: FotoPortal[];
};

export type SeccionGaleria = {
  titulo: string;
  descripcion?: string;
  columnas: ColumnaGaleria[];
};

const TONO: Record<ColumnaGaleria["tono"], string> = {
  neutro: "bg-stone-100 text-stone-700",
  rojo: "bg-brick-100 text-brick-800",
  verde: "bg-sage-100 text-sage-800",
};

export function GaleriaPortal({ secciones }: { secciones: SeccionGaleria[] }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [indice, setIndice] = useState<number | null>(null);

  // Lista plana en el orden de aparición, para navegar con anterior/siguiente.
  const planas: FotoPortal[] = secciones.flatMap((s) => s.columnas.flatMap((c) => c.fotos));
  let contador = 0;

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (indice !== null && !d.open) d.showModal();
    if (indice === null && d.open) d.close();
  }, [indice]);

  function mover(delta: number) {
    setIndice((i) => (i === null ? i : (i + delta + planas.length) % planas.length));
  }

  const actual = indice !== null ? planas[indice] : null;

  return (
    <>
      <div className="space-y-6">
        {secciones.map((s) => (
          <div key={s.titulo}>
            <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">{s.titulo}</h3>
            {s.descripcion && <p className="mb-2 text-sm text-stone-600">{s.descripcion}</p>}

            <div className={`grid gap-3 ${s.columnas.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {s.columnas.map((c) => (
                <div key={c.titulo} className="min-w-0">
                  <p
                    className={`mb-2 rounded-lg px-2 py-1 text-center text-xs font-semibold ${TONO[c.tono]}`}
                  >
                    {c.titulo}
                  </p>
                  {c.fotos.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-stone-300/70 p-3 text-center text-xs text-stone-500">
                      Sin fotos
                    </p>
                  ) : (
                    <ul
                      className={`grid gap-2 ${
                        s.columnas.length > 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                      }`}
                    >
                      {c.fotos.map((f) => {
                        const i = contador++;
                        return (
                          <li key={f.url}>
                            <button
                              type="button"
                              onClick={() => setIndice(i)}
                              aria-label={`Ampliar: ${f.alt}`}
                              className="block aspect-square w-full overflow-hidden rounded-xl bg-stone-200 active:opacity-80"
                            >
                              {/* URL firmada y temporal: next/image no aporta aquí. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={f.alt}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <dialog
        ref={dialogo}
        onClose={() => setIndice(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") mover(-1);
          if (e.key === "ArrowRight") mover(1);
        }}
        onClick={(e) => {
          if (e.target === dialogo.current) setIndice(null);
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
      >
        {actual && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <button
              type="button"
              onClick={() => setIndice(null)}
              aria-label="Cerrar"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
            >
              <X className="size-6" aria-hidden />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={actual.url}
              alt={actual.alt}
              className="max-h-[75dvh] max-w-full rounded-lg object-contain"
            />
            <p className="max-w-md text-center text-sm text-white">
              {actual.alt}
              {actual.notas ? ` · ${actual.notas}` : ""}
            </p>

            {planas.length > 1 && (
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Foto anterior"
                  className="flex size-14 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
                >
                  <ChevronLeft className="size-7" aria-hidden />
                </button>
                <span className="text-sm text-white/80">
                  {(indice ?? 0) + 1} / {planas.length}
                </span>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Foto siguiente"
                  className="flex size-14 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
                >
                  <ChevronRight className="size-7" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
