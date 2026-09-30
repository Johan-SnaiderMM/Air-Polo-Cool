"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Wrench } from "lucide-react";
import { cambiarMantenimiento, cambiarModoPrueba } from "@/app/(app)/soporte/actions";
import { Drawer } from "@/components/ui/drawer";
import { useSync } from "@/components/sync/sync-provider";
import { limpiarCacheReferencia } from "@/lib/offline/almacen";
import type { EstadoSoporte } from "@/lib/datos/soporte";

/** Borra lo guardado en el teléfono que depende del modo (páginas y datos de referencia), no la cola. */
async function olvidarDatosDelModo() {
  await limpiarCacheReferencia();
  if ("caches" in window) {
    const claves = await caches.keys();
    await Promise.all(claves.map((k) => caches.delete(k)));
  }
}

function Interruptor({
  activo,
  deshabilitado,
  onChange,
  etiqueta,
}: {
  activo: boolean;
  deshabilitado: boolean;
  onChange: (valor: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onChange(!activo)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${activo ? "bg-ink" : "bg-stone-300"}`}
    >
      <span
        className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-6" : ""}`}
      />
    </button>
  );
}

/**
 * Panel del usuario de soporte: modo prueba (datos aparte, marcados) y mantenimiento (Polo solo
 * consulta). Cambiar de modo borra lo guardado en el teléfono y recarga, para no mezclar datos.
 */
export function PanelSoporte({ estado, onClose }: { estado: EstadoSoporte; onClose: () => void }) {
  const { pendientes, fallidas } = useSync();
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const sinSincronizar = pendientes + fallidas;

  function cambiarModo(activo: boolean) {
    setError(null);
    // Lo pendiente se enviaría al modo nuevo y se mezclaría: primero hay que subirlo.
    if (sinSincronizar > 0) {
      setError(`Hay ${sinSincronizar} registro(s) sin sincronizar. Súbelos antes de cambiar de modo.`);
      return;
    }
    iniciar(async () => {
      const r = await cambiarModoPrueba(activo);
      if (!r.ok) return setError(r.error);
      await olvidarDatosDelModo();
      window.location.replace("/");
    });
  }

  function cambiarMant(activo: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await cambiarMantenimiento(activo, motivo);
      if (!r.ok) return setError(r.error);
      window.location.reload();
    });
  }

  return (
    <Drawer titulo="Soporte" onClose={onClose}>
      <div className="space-y-4">
        <section className="flex items-start gap-4 rounded-2xl border border-stone-200/70 p-4">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-ochre-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">Modo prueba</p>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Trabajas con datos aparte: no los ve Polo ni suman en cobros, balance, inventario ni garantías reales.
              Sales cuando lo apagues.
            </p>
          </div>
          <Interruptor etiqueta="Modo prueba" activo={estado.modoPrueba} deshabilitado={trabajando} onChange={cambiarModo} />
        </section>

        <section className="space-y-3 rounded-2xl border border-stone-200/70 p-4">
          <div className="flex items-start gap-4">
            <Wrench className="mt-0.5 size-5 shrink-0 text-brick-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">Mantenimiento</p>
              <p className="mt-0.5 text-[13px] text-stone-500">
                Polo solo puede consultar mientras esté activo; lo que registre desde el teléfono se conserva y se sube
                al terminar. Tú sigues pudiendo escribir.
              </p>
            </div>
            <Interruptor
              etiqueta="Mantenimiento"
              activo={estado.mantenimiento.activo}
              deshabilitado={trabajando}
              onChange={cambiarMant}
            />
          </div>
          {!estado.mantenimiento.activo && (
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Motivo que verá Polo (opcional)"
              aria-label="Motivo del mantenimiento"
              className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
            />
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
