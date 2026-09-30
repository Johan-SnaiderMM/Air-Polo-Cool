"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

function suscribirRed(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Estado de la conexión. `navigator.onLine` solo dice si hay interfaz de red; además se marca la
 * red como «caída» cuando un envío real falla, y se limpia cuando uno funciona o vuelve el evento
 * `online`. `online` es la conexión EFECTIVA: las dos cosas a la vez.
 */
export function useRed() {
  const navegadorEnLinea = useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true
  );
  const [redCaida, setRedCaida] = useState(false);
  /** Copia síncrona de `redCaida` para leerla dentro de callbacks sin recrearlos. */
  const redCaidaRef = useRef(false);

  const marcarRed = useCallback((caida: boolean) => {
    redCaidaRef.current = caida;
    setRedCaida(caida);
  }, []);

  return { online: navegadorEnLinea && !redCaida, redCaidaRef, marcarRed };
}
