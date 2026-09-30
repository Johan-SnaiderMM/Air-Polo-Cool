"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { AUTOR_POR_DEFECTO, AUTORES, esAutor } from "@/lib/autor";
import type { Autor } from "@/types/database";

/**
 * Sello de autoría: quién registra ("Polo" o "Soporte técnico").
 * No es un login ni un rol: es una preferencia del dispositivo (localStorage) que se
 * estampa en los registros nuevos. La seguridad real sigue siendo la sesión de Supabase.
 */
const CLAVE = "polo:autor";
const oyentes = new Set<() => void>();

function suscribir(cb: () => void) {
  oyentes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function leer(): Autor {
  try {
    const v = localStorage.getItem(CLAVE);
    return esAutor(v) ? v : AUTOR_POR_DEFECTO;
  } catch {
    return AUTOR_POR_DEFECTO;
  }
}

type Contexto = { autor: Autor; cambiarAutor: (a: Autor) => void; opciones: readonly Autor[] };
const AutorContext = createContext<Contexto | null>(null);

export function AutorProvider({ children }: { children: React.ReactNode }) {
  const autor = useSyncExternalStore(suscribir, leer, () => AUTOR_POR_DEFECTO);

  const cambiarAutor = useCallback((a: Autor) => {
    try {
      localStorage.setItem(CLAVE, a);
    } catch {
      /* sin almacenamiento: el cambio dura hasta recargar */
    }
    oyentes.forEach((cb) => cb());
  }, []);

  const valor = useMemo(() => ({ autor, cambiarAutor, opciones: AUTORES }), [autor, cambiarAutor]);
  return <AutorContext.Provider value={valor}>{children}</AutorContext.Provider>;
}

export function useAutor(): Contexto {
  const ctx = useContext(AutorContext);
  if (!ctx) throw new Error("useAutor debe usarse dentro de <AutorProvider>");
  return ctx;
}
