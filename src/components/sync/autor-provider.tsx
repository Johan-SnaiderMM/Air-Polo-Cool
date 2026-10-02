"use client";

import { createContext, useContext, useMemo } from "react";
import type { Autor } from "@/types/database";

/**
 * Sello de autoría: el nombre del perfil de quien registra. Lo decide el servidor según el usuario que
 * inició sesión; aquí solo se reparte a los formularios (y a la cola sin conexión) como pista. Quien lo
 * estampa de verdad es la base, según la sesión: lo que mande el teléfono se ignora si hay perfil.
 */
type Contexto = { autor: Autor };
const AutorContext = createContext<Contexto | null>(null);

export function AutorProvider({ autor, children }: { autor: Autor; children: React.ReactNode }) {
  const valor = useMemo(() => ({ autor }), [autor]);
  return <AutorContext.Provider value={valor}>{children}</AutorContext.Provider>;
}

export function useAutor(): Contexto {
  const ctx = useContext(AutorContext);
  if (!ctx) throw new Error("useAutor debe usarse dentro de <AutorProvider>");
  return ctx;
}
