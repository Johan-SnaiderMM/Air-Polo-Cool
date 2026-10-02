"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { enviarAvisoDePrueba } from "@/app/(app)/avisos/actions";
import { Drawer } from "@/components/ui/drawer";
import type { EstadoAvisos } from "@/components/avisos/use-avisos";

type Props = {
  estado: EstadoAvisos;
  error: string | null;
  trabajando: boolean;
  onActivar: () => void;
  onDesactivar: () => void;
  onClose: () => void;
  /** Solo soporte ve el botón de prueba. */
  esSoporte: boolean;
};

const BOTON = "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-60";

/**
 * Avisos de la agenda en este teléfono: dos resúmenes al día (7:00 a. m. con las citas de hoy y
 * 5:30 p. m. con las de mañana) que dicen cuántas faltan por recordar por WhatsApp.
 */
export function PanelAvisos({ estado, error, trabajando, onActivar, onDesactivar, onClose, esSoporte }: Props) {
  const [prueba, setPrueba] = useState<string | null>(null);
  const [probando, iniciarPrueba] = useTransition();

  function probar() {
    setPrueba(null);
    iniciarPrueba(async () => {
      const r = await enviarAvisoDePrueba();
      setPrueba(r.ok ? "Aviso de prueba enviado: debe llegar en unos segundos." : r.error);
    });
  }

  return (
    <Drawer titulo="Avisos de la agenda" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200/70 p-4">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            <Smartphone className="size-4 text-stone-500" aria-hidden />
            Un resumen al empezar y otro al terminar el día
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-stone-600">
            <li>
              <strong className="font-medium text-ink">7:00 a. m.</strong> · las citas de hoy
            </li>
            <li>
              <strong className="font-medium text-ink">5:30 p. m.</strong> · las citas de mañana, para recordarlas hoy
            </li>
          </ul>
          <p className="mt-2 text-[13px] text-stone-500">
            Dice cuántas citas hay y cuántas faltan por recordar por WhatsApp. Si no hay citas, no avisa.
          </p>
        </div>

        {estado === "cargando" && <p className="text-center text-sm text-stone-500">Revisando este teléfono…</p>}

        {estado === "sin_configurar" && (
          <p className="rounded-xl bg-ochre-50 px-4 py-3 text-sm text-ochre-800">
            Los avisos aún no están configurados en el servidor (faltan las claves). Avísale a soporte.
          </p>
        )}

        {estado === "no_soportado" && (
          <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
            Este navegador no permite recibir avisos. Prueba con Chrome en Android o con la app instalada en el iPhone.
          </p>
        )}

        {estado === "instalar_en_inicio" && (
          <p className="rounded-xl bg-ochre-50 px-4 py-3 text-sm text-ochre-800">
            En iPhone los avisos solo funcionan con la app instalada: abre el menú Compartir de Safari, elige «Agregar a
            pantalla de inicio» y abre la app desde allí. Después vuelve aquí para activarlos.
          </p>
        )}

        {estado === "bloqueado" && (
          <p className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
            Los avisos están bloqueados en este teléfono. Actívalos desde los ajustes del navegador o de la app (Notificaciones) y
            vuelve aquí.
          </p>
        )}

        {estado === "inactivo" && (
          <button type="button" onClick={onActivar} disabled={trabajando} className={`${BOTON} bg-accent-600 text-white active:bg-accent-700`}>
            <Bell className="size-4" aria-hidden />
            Activar avisos en este teléfono
          </button>
        )}

        {estado === "activo" && (
          <>
            <p className="flex items-center gap-2 rounded-xl bg-sage-50 px-4 py-3 text-sm text-sage-800">
              <span className="size-2 rounded-full bg-sage-500" aria-hidden /> Avisos activados en este teléfono.
            </p>
            {esSoporte && (
              <button
                type="button"
                onClick={probar}
                disabled={probando}
                className={`${BOTON} border border-stone-300/70 text-stone-700 active:bg-stone-100`}
              >
                Enviar un aviso de prueba (solo a mí)
              </button>
            )}
            <button type="button" onClick={onDesactivar} disabled={trabajando} className={`${BOTON} text-stone-600 active:bg-stone-100`}>
              <BellOff className="size-4" aria-hidden />
              Apagar los avisos en este teléfono
            </button>
          </>
        )}

        {prueba && <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">{prueba}</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
