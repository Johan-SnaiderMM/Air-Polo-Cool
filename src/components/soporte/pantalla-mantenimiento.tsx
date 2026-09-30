"use client";

import { useRouter } from "next/navigation";
import { RotateCw, Wrench } from "lucide-react";

/**
 * Lo que ve Polo mientras soporte tiene activo el mantenimiento: la base ya rechaza sus
 * escrituras, y esto evita que intente trabajar. Lo que haya registrado sin red queda guardado y
 * se sube solo cuando termine.
 */
export function PantallaMantenimiento({ motivo, desde }: { motivo: string | null; desde: string | null }) {
  const router = useRouter();
  const hora = desde
    ? new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(desde))
    : null;

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-5 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ochre-100 text-ochre-700">
        <Wrench className="size-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Estamos en mantenimiento</h1>
        <p className="text-[15px] text-stone-600">
          Hay un ajuste en curso{hora ? ` desde las ${hora}` : ""}. Puedes volver en unos minutos; no pierdes nada de lo
          que ya registraste.
        </p>
        {motivo && <p className="rounded-xl bg-stone-100 px-4 py-3 text-[14px] text-stone-700">{motivo}</p>}
      </div>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mx-auto flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-semibold text-white active:opacity-90"
      >
        <RotateCw className="size-4" aria-hidden />
        Volver a intentar
      </button>
    </div>
  );
}
