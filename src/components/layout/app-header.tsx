"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { CloudOff, FlaskConical, Snowflake, LogOut, Wrench } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";
import { PendientesDrawer } from "@/components/sync/pendientes-drawer";
import { PanelSoporte } from "@/components/soporte/panel-soporte";
import { useSync } from "@/components/sync/sync-provider";
import { limpiarCacheReferencia } from "@/lib/offline/almacen";
import type { EstadoSoporte } from "@/lib/datos/soporte";

/**
 * Cabecera mimetizada con el papel: sin franja de color, solo marca y un
 * hairline inferior. Translúcida para que el contenido "pase por debajo".
 *
 * Derecha: estado de conexión REAL (navigator.onLine + último intento de red),
 * el panel de soporte (solo para ese usuario) y salida. El estado abre el panel de sincronización.
 * Bajo la cabecera, una franja avisa cuando se trabaja en modo prueba o hay mantenimiento activo.
 */
export function AppHeader({ soporte }: { soporte: EstadoSoporte }) {
  const { online, pendientes, fallidas, sincronizando, sesionExpirada } = useSync();
  const [panel, setPanel] = useState(false);
  const [panelSoporte, setPanelSoporte] = useState(false);
  const cerrar = useCallback(() => setPanel(false), []);
  const cerrarSoporte = useCallback(() => setPanelSoporte(false), []);

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

          {soporte.esSoporte && (
            <button
              type="button"
              onClick={() => setPanelSoporte(true)}
              aria-label="Panel de soporte"
              className="flex size-10 items-center justify-center rounded-full text-stone-500 transition-colors active:bg-stone-200/60"
            >
              <Wrench className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </button>
          )}

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

      {soporte.modoPrueba && (
        <p className="flex items-center justify-center gap-1.5 bg-ochre-100 px-4 py-1.5 text-center text-[12px] font-semibold text-ochre-800">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          MODO PRUEBA · estos datos no son reales
        </p>
      )}
      {soporte.esSoporte && soporte.mantenimiento.activo && (
        <p className="flex items-center justify-center gap-1.5 bg-brick-100 px-4 py-1.5 text-center text-[12px] font-semibold text-brick-800">
          <Wrench className="size-3.5 shrink-0" aria-hidden />
          Mantenimiento activo · Polo solo puede consultar
        </p>
      )}

      {panel && <PendientesDrawer onClose={cerrar} />}
      {panelSoporte && <PanelSoporte estado={soporte} onClose={cerrarSoporte} />}
    </header>
  );
}
