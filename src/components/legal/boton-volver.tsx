"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Vuelve a la pantalla anterior (el login, el portal o el inicio, según de dónde se llegó). */
export function BotonVolver() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="-ml-2 flex h-11 items-center gap-1.5 rounded-full px-2 text-[14px] font-medium text-stone-600 active:bg-stone-200/60"
    >
      <ArrowLeft className="size-5" aria-hidden />
      Volver
    </button>
  );
}
