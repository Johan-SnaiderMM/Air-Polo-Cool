"use client";

import { useCallback, useEffect, useState } from "react";
import { guardarSuscripcion, quitarSuscripcion } from "@/app/(app)/avisos/actions";
import { claveVapidABytes, disponibilidadAvisos } from "@/lib/push/cliente";

/** Cuánto se espera al service worker antes de dar los avisos por no disponibles (en desarrollo no se registra). */
const ESPERA_SW_MS = 4000;

export type EstadoAvisos =
  | "cargando"
  | "sin_configurar"
  | "no_soportado"
  | "instalar_en_inicio"
  /** El usuario los bloqueó en el navegador: hay que reactivarlos desde los ajustes del teléfono. */
  | "bloqueado"
  | "inactivo"
  | "activo";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

async function registroListo(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolver) => setTimeout(() => resolver(null), ESPERA_SW_MS)),
  ]);
}

/**
 * Estado de los avisos en ESTE teléfono y cómo activarlos o apagarlos. Al activar se pide el permiso
 * (debe ser por un toque del usuario), se suscribe el teléfono y se guarda en el servidor. Si ya está
 * suscrito, se vuelve a registrar al cargar (un teléfono que cambia de usuario queda a nombre del actual).
 */
export function useAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos>(CLAVE_PUBLICA ? "cargando" : "sin_configurar");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!CLAVE_PUBLICA) return;
    let vigente = true;
    (async () => {
      const conPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const disponibilidad = disponibilidadAvisos({ agente: navigator.userAgent, instalada, conPush });
      if (disponibilidad !== "disponible") return vigente && setEstado(disponibilidad);
      if (Notification.permission === "denied") return vigente && setEstado("bloqueado");

      const registro = await registroListo();
      if (!registro) return vigente && setEstado("no_soportado");
      const suscripcion = await registro.pushManager.getSubscription();
      if (!vigente) return;
      if (suscripcion && Notification.permission === "granted") {
        setEstado("activo");
        void guardarSuscripcion(suscripcion.toJSON(), navigator.userAgent);
      } else {
        setEstado("inactivo");
      }
    })().catch(() => vigente && setEstado("no_soportado"));
    return () => {
      vigente = false;
    };
  }, []);

  const activar = useCallback(async () => {
    if (!CLAVE_PUBLICA) return;
    setError(null);
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
        return;
      }
      const registro = await registroListo();
      if (!registro) throw new Error("La app todavía no está lista para recibir avisos. Recarga e inténtalo de nuevo.");
      const suscripcion =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveVapidABytes(CLAVE_PUBLICA) }));
      const r = await guardarSuscripcion(suscripcion.toJSON(), navigator.userAgent);
      if (!r.ok) {
        await suscripcion.unsubscribe().catch(() => false);
        throw new Error(r.error);
      }
      setEstado("activo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron activar los avisos.");
    } finally {
      setTrabajando(false);
    }
  }, []);

  const desactivar = useCallback(async () => {
    setError(null);
    setTrabajando(true);
    try {
      const registro = await registroListo();
      const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
      if (suscripcion) {
        const endpoint = suscripcion.endpoint;
        await suscripcion.unsubscribe();
        await quitarSuscripcion({ endpoint });
      }
      setEstado("inactivo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron apagar los avisos.");
    } finally {
      setTrabajando(false);
    }
  }, []);

  return { estado, error, trabajando, activar, desactivar, configurado: !!CLAVE_PUBLICA };
}
