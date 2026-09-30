"use client";

import { createContext, useContext, useMemo } from "react";
import type { Autor } from "@/types/database";

/**
 * Sello de autoría: quién registra ("Polo" o "Soporte técnico"). Lo decide el servidor según el
 * usuario que inició sesión (cada uno tiene su propio usuario); aquí solo se reparte a los
 * formularios para estamparlo en los registros nuevos. La seguridad real es la sesión de Supabase.
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
