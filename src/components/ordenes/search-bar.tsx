"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

type Props = {
  inicial: string;
  /** Ruta que recibe el parámetro ?q= (ej. "/ordenes"). */
  ruta: string;
  /** Otros parámetros de la URL a conservar al buscar (ej. el filtro activo). */
  extra?: Record<string, string | undefined>;
  placeholder?: string;
};

export function SearchBar({
  inicial,
  ruta,
  extra,
  placeholder = "Buscar por placa o cliente",
}: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);
  const ultimo = useRef(inicial);
  // Clave estable: evita re-disparar el efecto si `extra` es un objeto nuevo en cada render.
  const extraKey = JSON.stringify(extra ?? {});

  useEffect(() => {
    const limpio = valor.trim();
    if (limpio === ultimo.current) return;

    const timer = setTimeout(() => {
      ultimo.current = limpio;
      const params = new URLSearchParams();
      if (limpio) params.set("q", limpio);
      const otros = JSON.parse(extraKey) as Record<string, string | undefined>;
      for (const [k, v] of Object.entries(otros)) if (v) params.set(k, v);
      const qs = params.toString();
      router.replace(qs ? `${ruta}?${qs}` : ruta);
    }, 350);

    return () => clearTimeout(timer);
  }, [valor, extraKey, ruta, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400"
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="none"
        autoComplete="off"
        enterKeyHint="search"
        className="h-14 w-full rounded-xl border border-stone-300/70 bg-white pr-12 pl-12 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor("")}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 active:bg-stone-100"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
