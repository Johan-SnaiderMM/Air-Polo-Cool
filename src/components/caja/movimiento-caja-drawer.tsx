"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CloudUpload, Loader2 } from "lucide-react";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { Drawer } from "@/components/ui/drawer";
import { PosMonto } from "@/components/ui/pos-monto";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { hoyBogota } from "@/lib/caja";
import { nuevoId, type TipoMovManual } from "@/lib/offline/operaciones";
import { formatearMoneda } from "@/lib/ordenes";

const TIPOS: { id: TipoMovManual; label: string; ayuda: string }[] = [
  { id: "fondo_inicial", label: "Fondo inicial", ayuda: "Efectivo con el que abre la caja" },
  { id: "reposicion", label: "Reposición", ayuda: "Dinero que entra para seguir operando" },
  { id: "retiro", label: "Retiro", ayuda: "Efectivo que sale de la caja (ej. al dueño)" },
];

/** Registra un movimiento de efectivo. Funciona sin conexión (cola de sincronización). */
export function MovimientoCajaDrawer({
  tipoInicial = "reposicion",
  onClose,
}: {
  tipoInicial?: TipoMovManual;
  onClose: () => void;
}) {
  const { registrar } = useSync();
  const { autor } = useAutor();
  const [tipo, setTipo] = useState<TipoMovManual>(tipoInicial);
  const [digitos, setDigitos] = useState("");
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState(hoyBogota);
  const [resultado, setResultado] = useState<{ tipo: "ok" | "cola" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const monto = Number(digitos || "0");

  function guardar() {
    if (monto <= 0) return;
    setResultado(null);
    iniciar(async () => {
      const r = await registrar({
        tipo: "caja.movimiento",
        datos: { id: nuevoId(), fecha, tipo, monto, notas: notas.trim() || null, autor },
      });
      if (r.estado === "error") setResultado({ tipo: "error", texto: r.error });
      else {
        setResultado({
          tipo: r.estado === "sincronizado" ? "ok" : "cola",
          texto:
            r.estado === "sincronizado"
              ? `${formatearMoneda(monto)} registrado en caja.`
              : "Guardado en el teléfono; se subirá al volver la conexión.",
        });
        setDigitos("");
        setNotas("");
      }
    });
  }

  return (
    <Drawer titulo="Movimiento de caja" onClose={onClose}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tipo === t.id}
              onClick={() => setTipo(t.id)}
              className={`h-12 rounded-xl border-[1.5px] text-[13px] transition-colors ${
                tipo === t.id
                  ? "border-ink bg-stone-100 font-medium text-ink"
                  : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="-mt-1 text-[13px] text-stone-500">{TIPOS.find((t) => t.id === tipo)?.ayuda}</p>

        <PosMonto id="mov-monto" etiqueta="Monto" digitos={digitos} onChange={setDigitos} />

        <input
          aria-label="Nota (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={300}
          placeholder="Nota (opcional)"
          className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
        />
        <SelectorFecha value={fecha} onChange={setFecha} />

        {resultado && (
          <p
            role={resultado.tipo === "error" ? "alert" : "status"}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              resultado.tipo === "error"
                ? "bg-brick-50 text-brick-700"
                : resultado.tipo === "cola"
                  ? "bg-ochre-50 text-ochre-800"
                  : "bg-sage-50 text-sage-800"
            }`}
          >
            {resultado.tipo === "ok" && <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {resultado.tipo === "cola" && <CloudUpload className="size-4 shrink-0" aria-hidden />}
            {resultado.texto}
          </p>
        )}

        <button
          type="button"
          onClick={guardar}
          disabled={monto <= 0 || pendiente}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-medium text-white active:bg-ink-soft disabled:bg-stone-200 disabled:text-stone-400"
        >
          {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
          Registrar movimiento
        </button>
      </div>
    </Drawer>
  );
}
