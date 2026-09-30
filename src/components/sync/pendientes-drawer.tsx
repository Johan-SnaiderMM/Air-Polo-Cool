"use client";

import Link from "next/link";
import { AlertTriangle, CloudOff, Snowflake, RefreshCw, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { useSync } from "@/components/sync/sync-provider";
import { describirOperacion } from "@/lib/offline/operaciones";

function haceCuanto(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

/** Panel de estado: conexión, registros pendientes de subir y errores a revisar. */
export function PendientesDrawer({ onClose }: { onClose: () => void }) {
  const { online, cola, sincronizando, sesionExpirada, snapshot, sincronizar, reintentarFallida, descartar } =
    useSync();

  return (
    <Drawer titulo="Sincronización" onClose={onClose}>
      <div className="space-y-4">
        <p
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            online ? "bg-sage-50 text-sage-800" : "bg-ochre-50 text-ochre-800"
          }`}
        >
          {online ? (
            <>
              <span className="size-2 rounded-full bg-sage-500" aria-hidden /> En línea
            </>
          ) : (
            <>
              <CloudOff className="size-4" aria-hidden /> Sin conexión: todo lo que registres se guarda en el
              teléfono y se sube solo al volver la red.
            </>
          )}
        </p>

        {sesionExpirada && (
          <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
            Tu sesión expiró y hay registros sin subir.{" "}
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{" "}
            para sincronizarlos; no se pierden.
          </p>
        )}

        {cola.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300/70 p-6 text-center text-sm text-stone-500">
            No hay registros pendientes.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70">
            {cola.map((item) => (
              <li key={item.seq} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{describirOperacion(item.operacion)}</p>
                    <p className="text-[12px] text-stone-500">
                      Guardado {haceCuanto(item.creada)}
                      {item.intentos > 0 ? ` · ${item.intentos} intento${item.intentos === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      item.estado === "fallida" ? "bg-brick-50 text-brick-700" : "bg-ochre-50 text-ochre-800"
                    }`}
                  >
                    {item.estado === "fallida" ? "Requiere revisión" : "Pendiente"}
                  </span>
                </div>

                {item.error && (
                  <p className="flex items-start gap-1.5 text-[13px] text-brick-700">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {item.error}
                  </p>
                )}

                {item.estado === "fallida" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reintentarFallida(item.seq)}
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-stone-300/70 px-3 text-[13px] font-medium active:bg-stone-100"
                    >
                      <RefreshCw className="size-4" aria-hidden /> Reintentar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("¿Descartar este registro? No se subirá y se perderá.")) {
                          void descartar(item.seq);
                        }
                      }}
                      className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-stone-500 active:bg-stone-100"
                    >
                      <Trash2 className="size-4" aria-hidden /> Descartar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={!online || sincronizando}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white active:bg-ink-soft disabled:bg-stone-200 disabled:text-stone-400"
        >
          {sincronizando ? (
            <Snowflake className="size-4 animate-copo" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Sincronizar ahora
        </button>

        <p className="text-center text-[12px] text-stone-500">
          {snapshot
            ? `Datos de referencia (vehículos y órdenes) al ${new Date(snapshot.generado).toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Bogota",
              })}.`
            : "Aún no se descargaron los datos de referencia para trabajar sin red."}
        </p>
      </div>
    </Drawer>
  );
}
