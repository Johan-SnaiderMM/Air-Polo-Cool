"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot = () => navigator.onLine;
// En el servidor asumimos conexión; el cliente corrige tras hidratar.
const getServerSnapshot = () => true;

/**
 * Cabecera mimetizada con el papel: sin franja de color, solo marca y un
 * hairline inferior. Translúcida para que el contenido "pase por debajo".
 */
export function AppHeader() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          {/* Marca: logo circular + nombre en serif */}
          <Image src="/logo.png" alt="" width={32} height={32} priority className="size-8 rounded-full" />
          <span className="font-serif text-[22px] leading-none font-medium tracking-tight">
            Polo Air Cool
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Estado de conexión: solo un punto (el texto queda para lectores de pantalla). */}
          <span
            role="status"
            aria-live="polite"
            title={online ? "En línea" : "Sin conexión"}
            className="flex size-9 items-center justify-center"
          >
            <span
              className={`size-2 rounded-full ${online ? "bg-sage-500" : "bg-ochre-500"}`}
              aria-hidden
            />
            <span className="sr-only">{online ? "En línea" : "Sin conexión"}</span>
          </span>

          <form action={cerrarSesion}>
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
    </header>
  );
}
