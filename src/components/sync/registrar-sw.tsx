"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js) solo en producción: en desarrollo
 * cachea archivos que cambian a cada rato y estorba.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sin service worker la app funciona igual, solo sin lectura offline de páginas */
    });
  }, []);
  return null;
}
