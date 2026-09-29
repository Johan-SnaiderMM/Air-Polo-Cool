"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Props = {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Bottom sheet móvil sobre <dialog> nativo (foco atrapado, Esc, backdrop).
 * Se monta solo cuando está abierto, por lo que su formulario se reinicia al reabrir.
 */
export function Drawer({ titulo, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clic en el backdrop (fuera del contenido) cierra.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-0 text-ink backdrop:bg-black/50"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-white px-5 py-3">
        <h2 className="font-serif text-xl font-medium tracking-tight">{titulo}</h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Cerrar"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-100"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
