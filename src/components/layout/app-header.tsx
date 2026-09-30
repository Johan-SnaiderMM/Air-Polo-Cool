"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { CloudOff, Snowflake, LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";
import { PendientesDrawer } from "@/components/sync/pendientes-drawer";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { limpiarCacheReferencia } from "@/lib/offline/almacen";
import type { Autor } from "@/types/database";

/**
 * Cabecera mimetizada con el papel: sin franja de color, solo marca y un
 * hairline inferior. Translúcida para que el contenido "pase por debajo".
 *
 * Derecha: estado de conexión REAL (navigator.onLine + último intento de red),
 * sello de autoría y salida. El estado abre el panel de sincronización.
 */
export function AppHeader() {
  const { online, pendientes, fallidas, sincronizando, sesionExpirada } = useSync();
  const { autor, cambiarAutor, opciones } = useAutor();
  const [panel, setPanel] = useState(false);
  const cerrar = useCallback(() => setPanel(false), []);

  const hayAlerta = fallidas > 0 || sesionExpirada;
  const etiqueta = !online ? "Sin red" : pendientes > 0 ? `${pendientes}` : "";
  const estadoTexto = !online
    ? `Sin conexión${pendientes ? `, ${pendientes} pendientes` : ""}`
    : sincronizando
      ? "Sincronizando"
      : pendientes > 0
        ? `${pendientes} pendientes de sincronizar`
        : "En línea";

  function alCerrarSesion(e: React.FormEvent<HTMLFormElement>) {
    if (
      pendientes + fallidas > 0 &&
      !window.confirm(
        `Hay ${pendientes + fallidas} registro(s) sin sincronizar. Se conservan en el teléfono y se subirán cuando vuelvas a ingresar. ¿Cerrar sesión?`
      )
    ) {
      e.preventDefault();
      return;
    }
    // La sesión termina: se borran las páginas guardadas y los datos de referencia (no la cola).
    void limpiarCacheReferencia();
    if ("caches" in window) void caches.keys().then((ks) => ks.forEach((k) => void caches.delete(k)));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt="" width={32} height={32} priority className="size-8 shrink-0 rounded-full" />
          <span className="truncate font-serif text-[20px] leading-none font-medium tracking-tight">
            Polo Air Cool
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPanel(true)}
            aria-label={`Sincronización: ${estadoTexto}`}
            className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-stone-600 active:bg-stone-200/60"
          >
            {sincronizando ? (
              <Snowflake className="size-3.5 animate-copo text-stone-500" aria-hidden />
            ) : !online ? (
              <CloudOff className="size-3.5 text-ochre-700" aria-hidden />
            ) : (
              <span
                className={`size-2 rounded-full ${hayAlerta ? "bg-brick-500" : pendientes > 0 ? "bg-ochre-500" : "bg-sage-500"}`}
                aria-hidden
              />
            )}
            {etiqueta}
          </button>

          <select
            aria-label="Registrado por"
            value={autor}
            onChange={(e) => cambiarAutor(e.target.value as Autor)}
            className="h-8 max-w-[5.5rem] rounded-full border border-stone-200/80 bg-white px-2.5 text-[12px] font-medium text-ink outline-none focus:border-stone-400"
          >
            {opciones.map((a) => (
              <option key={a} value={a}>
                {a === "Soporte técnico" ? "Soporte" : a}
              </option>
            ))}
          </select>

          <form action={cerrarSesion} onSubmit={alCerrarSesion}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex size-10 items-center justify-center rounded-full text-stone-500 transition-colors active:bg-stone-200/60"
            >
              <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      {panel && <PendientesDrawer onClose={cerrar} />}
    </header>
  );
}
