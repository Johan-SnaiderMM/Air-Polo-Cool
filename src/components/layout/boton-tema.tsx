"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { CLAVE_TEMA, COLOR_BARRA } from "@/lib/tema";

/** El tema vive en <html data-tema="dark"> (lo pone el script de <head> antes de pintar). */
const oyentes = new Set<() => void>();
const suscribir = (aviso: () => void) => {
  oyentes.add(aviso);
  return () => void oyentes.delete(aviso);
};
const hayOscuro = () => document.documentElement.getAttribute("data-tema") === "dark";

/**
 * Alterna entre claro y oscuro y recuerda la elección en este teléfono. Hasta que se toca, se sigue
 * la preferencia del sistema. También ajusta el color de la barra del navegador.
 */
export function BotonTema() {
  const oscuro = useSyncExternalStore(suscribir, hayOscuro, () => false);

  useEffect(() => {
    // Hay una etiqueta por tema (con media query); al conocer el tema real se ponen todas del mismo color.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", COLOR_BARRA[oscuro ? "oscuro" : "claro"]));
  }, [oscuro]);

  function alternar() {
    const siguiente = !oscuro;
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente ? "oscuro" : "claro");
    } catch {
      /* sin almacenamiento: el cambio dura hasta recargar */
    }
    if (siguiente) document.documentElement.setAttribute("data-tema", "dark");
    else document.documentElement.removeAttribute("data-tema");
    oyentes.forEach((aviso) => aviso());
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex size-10 items-center justify-center rounded-full text-stone-500 transition-colors active:bg-stone-200/60"
    >
      {oscuro ? <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
