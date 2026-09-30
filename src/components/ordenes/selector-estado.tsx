"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ESTADOS_FLUJO, ESTADO_DOT, ESTADO_LABEL, ESTADO_SUPERFICIE } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

/**
 * Menú desplegable de estado (listbox accesible) que reemplaza al <select> nativo.
 * Cada estado se muestra con su degradado tenue, micro-borde y punto. Incluye un input oculto
 * con `name` para que el valor viaje en el formulario.
 */
export function SelectorEstado({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  value: EstadoOrden;
  onChange: (estado: EstadoOrden) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(() => ESTADOS_FLUJO.indexOf(value));
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();

  // Cierra al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  function abrir() {
    setActivo(ESTADOS_FLUJO.indexOf(value));
    setAbierto(true);
  }

  function elegir(estado: EstadoOrden) {
    onChange(estado);
    setAbierto(false);
  }

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (abierto) {
        e.preventDefault();
        setAbierto(false);
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((i) => (i + paso + ESTADOS_FLUJO.length) % ESTADOS_FLUJO.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (abierto) elegir(ESTADOS_FLUJO[activo]);
      else abrir();
    } else if (e.key === "Tab") {
      setAbierto(false);
    }
  }

  return (
    <div ref={raiz} className="relative">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className={`flex h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base font-medium transition-colors ${ESTADO_SUPERFICIE[value]}`}
      >
        <span className={`size-2 shrink-0 rounded-full ${ESTADO_DOT[value]}`} aria-hidden />
        <span className="flex-1">{ESTADO_LABEL[value]}</span>
        <ChevronDown
          className={`size-4 opacity-60 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Estado de la orden"
          className="menu-entra absolute z-30 mt-2 w-full space-y-1.5 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-[0_12px_32px_-12px_rgb(11_22_51/0.25)]"
        >
          {ESTADOS_FLUJO.map((e, i) => (
            <li
              key={e}
              role="option"
              aria-selected={e === value}
              onPointerEnter={() => setActivo(i)}
              onClick={() => elegir(e)}
              className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-[15px] font-medium ${ESTADO_SUPERFICIE[e]} ${
                i === activo ? "ring-2 ring-ink/40" : ""
              }`}
            >
              <span className={`size-2 shrink-0 rounded-full ${ESTADO_DOT[e]}`} aria-hidden />
              <span className="flex-1">{ESTADO_LABEL[e]}</span>
              {e === value && <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
