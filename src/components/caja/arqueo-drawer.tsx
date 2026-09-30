"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Minus, Plus, Printer } from "lucide-react";
import { cerrarCaja, saldoCajaAl } from "@/app/(app)/caja-menor/actions";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { Dinero } from "@/components/ui/dinero";
import { Drawer } from "@/components/ui/drawer";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import {
  BILLETES,
  MONEDAS,
  RESULTADO_LABEL,
  comparar,
  limpiarCantidad,
  totalDesglose,
  type Desglose,
} from "@/lib/arqueo";
import { hoyBogota } from "@/lib/caja";
import { formatearMoneda } from "@/lib/ordenes";

const ESTILO_RESULTADO = {
  cuadrado: "bg-sage-100 text-sage-800",
  faltante: "bg-brick-100 text-brick-700",
  sobrante: "bg-ochre-100 text-ochre-800",
} as const;

function FilaDenominacion({
  valor,
  cantidad,
  onDelta,
  onFijar,
}: {
  valor: number;
  cantidad: number;
  /** Suma/resta sobre el estado ANTERIOR (seguro ante toques muy rápidos). */
  onDelta: (delta: number) => void;
  onFijar: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 font-mono text-[15px] tabular-nums">{formatearMoneda(valor)}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Menos ${formatearMoneda(valor)}`}
          onClick={() => onDelta(-1)}
          className="flex size-10 items-center justify-center rounded-lg border border-stone-200/80 active:bg-stone-100"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          aria-label={`Cantidad de ${formatearMoneda(valor)}`}
          inputMode="numeric"
          value={cantidad === 0 ? "" : String(cantidad)}
          placeholder="0"
          onChange={(e) => onFijar(limpiarCantidad(e.target.value.replace(/\D/g, "")))}
          className="h-10 w-14 rounded-lg border border-stone-200/80 bg-white text-center font-mono text-[16px] tabular-nums outline-none focus:border-stone-400"
        />
        <button
          type="button"
          aria-label={`Más ${formatearMoneda(valor)}`}
          onClick={() => onDelta(1)}
          className="flex size-10 items-center justify-center rounded-lg border border-stone-200/80 active:bg-stone-100"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <span className="ml-auto font-mono text-[13px] text-stone-500 tabular-nums">
        {cantidad > 0 ? formatearMoneda(valor * cantidad) : ""}
      </span>
    </div>
  );
}

/**
 * Arqueo y cierre diario: Polo cuenta billetes y monedas; el sistema compara contra el
 * saldo que calcula el servidor (fondo + reposiciones + cobros en efectivo − gastos)
 * y muestra Cuadrado / Faltante / Sobrante. Requiere conexión (el saldo es del servidor).
 */
export function ArqueoDrawer({
  saldoInicial,
  onClose,
}: {
  saldoInicial: number;
  onClose: () => void;
}) {
  const { autor } = useAutor();
  const { online } = useSync();
  const [fecha, setFecha] = useState(hoyBogota);
  const [saldo, setSaldo] = useState(saldoInicial);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [desglose, setDesglose] = useState<Desglose>({});
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<{ id?: string; resultado: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Si se cambia la fecha (cerrar un día anterior), se pide el saldo de ese día.
  useEffect(() => {
    if (fecha === hoyBogota()) {
      return;
    }
    let vivo = true;
    void (async () => {
      setCargandoSaldo(true);
      const r = await saldoCajaAl(fecha);
      if (!vivo) return;
      setCargandoSaldo(false);
      if (r.ok) setSaldo(r.saldo);
      else setError(r.error);
    })();
    return () => {
      vivo = false;
    };
  }, [fecha]);

  const saldoMostrado = fecha === hoyBogota() ? saldoInicial : saldo;
  const conteo = totalDesglose(desglose);
  const { diferencia, resultado } = comparar(saldoMostrado, conteo);
  const haContado = conteo > 0 || Object.keys(desglose).length > 0;

  function sumar(valor: number, delta: number) {
    setDesglose((d) => ({ ...d, [String(valor)]: Math.max(0, limpiarCantidad(d[String(valor)]) + delta) }));
  }
  function fijar(valor: number, cantidad: number) {
    setDesglose((d) => ({ ...d, [String(valor)]: cantidad }));
  }

  function cerrar() {
    setError(null);
    iniciar(async () => {
      const r = await cerrarCaja({ fecha, desglose: desglose as Record<string, number>, notas, autor });
      if (r.ok) setCierre({ id: r.id, resultado });
      else setError(r.error);
    });
  }

  if (cierre) {
    return (
      <Drawer titulo="Caja cerrada" onClose={onClose}>
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-sage-600" strokeWidth={1.5} aria-hidden />
          <p className="font-serif text-2xl">{RESULTADO_LABEL[cierre.resultado as keyof typeof RESULTADO_LABEL]}</p>
          <p className="text-[14px] text-stone-500">
            Saldo del sistema <Dinero valor={saldoMostrado} /> · Conteo <Dinero valor={conteo} />
          </p>
          {cierre.id && (
            <Link
              href={`/caja-menor/cierre/${cierre.id}`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 text-sm font-medium active:bg-stone-100"
            >
              <Printer className="size-4" aria-hidden /> Ver comprobante / PDF
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-ink text-sm font-medium text-white active:bg-ink-soft"
          >
            Listo
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer titulo="Arqueo y cierre de caja" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-stone-50 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] text-stone-500">Saldo según el sistema</p>
            {cargandoSaldo && <Loader2 className="size-4 animate-spin text-stone-400" aria-hidden />}
          </div>
          <p className="mt-1 text-3xl">
            <Dinero valor={saldoMostrado} />
          </p>
          <div className="mt-2">
            <SelectorFecha value={fecha} onChange={setFecha} etiqueta="Cerrar el día" />
          </div>
        </div>

        <div>
          <p className="mb-1 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Billetes</p>
          <div className="divide-y divide-stone-100">
            {BILLETES.map((b) => (
              <FilaDenominacion
                key={b}
                valor={b}
                cantidad={limpiarCantidad(desglose[String(b)])}
                onDelta={(x) => sumar(b, x)}
                onFijar={(n) => fijar(b, n)}
              />
            ))}
          </div>
          <p className="mt-4 mb-1 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Monedas</p>
          <div className="divide-y divide-stone-100">
            {MONEDAS.map((m) => (
              <FilaDenominacion
                key={m}
                valor={m}
                cantidad={limpiarCantidad(desglose[String(m)])}
                onDelta={(x) => sumar(m, x)}
                onFijar={(n) => fijar(m, n)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-ink p-5 text-paper">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] text-stone-400">Conteo físico</p>
            {haContado && (
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${ESTILO_RESULTADO[resultado]}`}>
                {RESULTADO_LABEL[resultado]}
              </span>
            )}
          </div>
          <p className="mt-1 text-3xl">
            <Dinero valor={conteo} />
          </p>
          {haContado && (
            <p className="mt-3 text-[14px] text-stone-300">
              Diferencia:{" "}
              <span className="font-mono tabular-nums">
                {diferencia > 0 ? "+" : ""}
                {formatearMoneda(diferencia)}
              </span>
              {diferencia !== 0 && " · se registrará un ajuste para que el saldo quede igual al conteo."}
            </p>
          )}
        </div>

        <input
          aria-label="Notas del cierre"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={500}
          placeholder="Notas (opcional): ej. faltó cambio del almuerzo"
          className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
        />

        {!online && (
          <p className="rounded-lg bg-ochre-50 px-3 py-2 text-sm text-ochre-800">
            El cierre requiere conexión: el saldo lo calcula el servidor para que no se pueda alterar.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={cerrar}
          disabled={pendiente || !online || cargandoSaldo || !haContado}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white active:bg-accent-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
          Cerrar caja del {fecha === hoyBogota() ? "día" : fecha}
        </button>
      </div>
    </Drawer>
  );
}
