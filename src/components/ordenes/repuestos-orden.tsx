"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Lock, Plus, Search, Trash2, X } from "lucide-react";
import {
  agregarRepuesto,
  buscarInventario,
  eliminarRepuesto,
  type ItemBuscado,
} from "@/app/(app)/ordenes/repuestos-actions";
import { admiteDecimales, formatearCantidad, redondearDinero } from "@/lib/inventario";
import type { TipoUnidad } from "@/types/database";

import { Dinero } from "@/components/ui/dinero";
const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";

export type LineaRepuesto = {
  id: string;
  nombre: string;
  codigo: string;
  tipo_unidad: TipoUnidad;
  cantidad_usada: number;
  precio_unitario: number;
};

type Props = {
  ordenId: string;
  lineas: LineaRepuesto[];
  /** Orden entregada/cancelada: el trigger rechaza cambios de repuestos. */
  bloqueada: boolean;
  puedeEliminar: boolean;
};

export function RepuestosOrden({ ordenId, lineas, bloqueada, puedeEliminar }: Props) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<ItemBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [item, setItem] = useState<ItemBuscado | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const secuencia = useRef(0);

  useEffect(() => {
    const q = consulta.trim();
    const id = ++secuencia.current;

    if (q.length < 2) {
      const t = setTimeout(() => {
        if (id === secuencia.current) {
          setResultados([]);
          setBuscando(false);
        }
      }, 0);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await buscarInventario(q);
        if (id === secuencia.current) setResultados(data);
      } finally {
        if (id === secuencia.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [consulta]);

  function agregar() {
    if (!item) return;
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Ingresa una cantidad mayor a 0.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await agregarRepuesto({
        ordenId,
        inventarioId: item.id,
        cantidad: n,
      });
      if (r.ok) {
        setItem(null);
        setCantidad("");
        setConsulta("");
        setResultados([]);
      } else {
        setError(r.error); // p. ej. "Stock insuficiente de …"
      }
    });
  }

  function quitar(linea: LineaRepuesto) {
    if (!window.confirm(`¿Quitar "${linea.nombre}" de la orden? El stock se devolverá.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarRepuesto({ ordenId, lineaId: linea.id });
      if (!r.ok) setError(r.error);
    });
  }

  const subtotalItem =
    item && Number(cantidad) > 0
      ? redondearDinero(Number(cantidad) * item.precio_venta)
      : null;
  const totalRepuestos = redondearDinero(
    lineas.reduce((s, l) => s + l.cantidad_usada * l.precio_unitario, 0)
  );

  return (
    <div className="space-y-4">
      {/* ---------- Líneas cargadas ---------- */}
      {lineas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
          No se han cargado repuestos ni insumos.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.nombre}</p>
                <p className="text-sm text-stone-600">
                  {formatearCantidad(l.cantidad_usada, l.tipo_unidad)} ×{" "}
                  <Dinero valor={l.precio_unitario} />
                </p>
              </div>
              <p className="shrink-0 font-semibold">
                <Dinero valor={redondearDinero(l.cantidad_usada * l.precio_unitario)} />
              </p>
              {puedeEliminar && (
                <button
                  type="button"
                  onClick={() => quitar(l)}
                  disabled={pendiente}
                  aria-label={`Quitar ${l.nombre}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-brick-700 active:bg-brick-50 disabled:opacity-50"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between bg-stone-50 px-4 py-3 font-semibold">
            <span>Total repuestos</span>
            <span><Dinero valor={totalRepuestos} /></span>
          </li>
        </ul>
      )}

      {lineas.length > 0 && !puedeEliminar && !bloqueada && (
        <p className="text-xs text-stone-500">
          Solo el administrador puede quitar líneas ya cargadas.
        </p>
      )}

      {/* ---------- Agregar ---------- */}
      {bloqueada ? (
        <p className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
          <Lock className="size-4 shrink-0" aria-hidden />
          La orden está cerrada: no admite cambios de repuestos.
        </p>
      ) : item ? (
        <div className="space-y-3 rounded-2xl border border-stone-300 bg-stone-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{item.nombre}</p>
              <p className="text-sm text-stone-600">
                {item.codigo} · Disponible:{" "}
                <strong>{formatearCantidad(item.stock_actual, item.tipo_unidad)}</strong> ·{" "}
                <Dinero valor={item.precio_venta} />
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setItem(null);
                setError(null);
              }}
              aria-label="Cambiar ítem"
              className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-stone-100"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div>
            <label htmlFor="cantidad_repuesto" className="mb-1 block text-sm font-medium">
              Cantidad usada
            </label>
            <input
              id="cantidad_repuesto"
              type="number"
              inputMode="decimal"
              min={0}
              step={admiteDecimales(item.tipo_unidad) ? "any" : 1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
              className={INPUT}
            />
            {subtotalItem !== null && (
              <p className="mt-1 text-sm text-stone-600">
                Subtotal: <strong><Dinero valor={subtotalItem} /></strong>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={agregar}
            disabled={pendiente}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white active:bg-ink-soft disabled:opacity-60"
          >
            {pendiente ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-5" aria-hidden />
            )}
            {pendiente ? "Agregando…" : "Agregar a la orden"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400"
              aria-hidden
            />
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar repuesto por código o nombre"
              aria-label="Buscar repuesto en inventario"
              autoComplete="off"
              className={`${INPUT} pl-12 [&::-webkit-search-cancel-button]:hidden`}
            />
            {buscando && (
              <Loader2
                className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-stone-400"
                aria-hidden
              />
            )}
          </div>

          {resultados.length > 0 && (
            <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-stone-200/70 bg-white">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItem(r);
                      setError(null);
                    }}
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-stone-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base">{r.nombre}</span>
                      <span className="block font-mono text-xs text-stone-500">{r.codigo}</span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        r.stock_actual <= 0 ? "text-brick-700" : "text-stone-700"
                      }`}
                    >
                      {formatearCantidad(r.stock_actual, r.tipo_unidad)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {consulta.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-sm text-stone-600">
              No hay ítems con “{consulta.trim()}”. Regístralo primero en Inventario.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}
    </div>
  );
}
