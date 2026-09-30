"use client";

import { useEffect, useRef, useState } from "react";
import { Car, CloudOff, Snowflake, Plus, Search, X } from "lucide-react";
import { buscarVehiculos, type VehiculoResultado } from "@/app/(app)/ordenes/actions";
import { useSync } from "@/components/sync/sync-provider";
import { buscarVehiculosLocal } from "@/lib/offline/snapshot";
import { normalizarPlaca } from "@/lib/ordenes";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

type Modo = "buscar" | "nuevo";

export type NuevoVehiculo = {
  cliente_nombre: string;
  cliente_telefono: string;
  placa: string;
  marca: string;
  /** En el taller: la LÍNEA del vehículo (Spark GT, Duster…). */
  modelo: string;
  /** En el taller: el MODELO (año de fabricación). */
  anio: string;
};

export type SeleccionVehiculo =
  | { modo: "existente"; vehiculo: VehiculoResultado }
  | { modo: "nuevo"; datos: NuevoVehiculo };

const NUEVO_VACIO: NuevoVehiculo = {
  cliente_nombre: "",
  cliente_telefono: "",
  placa: "",
  marca: "",
  modelo: "",
  anio: "",
};

/**
 * Selector de vehículo por placa/cliente, con alta rápida de cliente + vehículo.
 * Es un componente CONTROLADO: informa la selección al padre con `onChange`
 * (sin inputs ocultos), de modo que sirva tanto para órdenes offline como para cotizaciones.
 * Sin conexión busca en el snapshot local del teléfono.
 */
export function VehiculoSelector({
  inicial = null,
  onChange,
}: {
  inicial?: VehiculoResultado | null;
  onChange: (seleccion: SeleccionVehiculo | null) => void;
}) {
  const { online, snapshot } = useSync();
  const [modo, setModo] = useState<Modo>("buscar");
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<VehiculoResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [usandoLocal, setUsandoLocal] = useState(false);
  const [seleccionado, setSeleccionado] = useState<VehiculoResultado | null>(inicial);
  const [nuevo, setNuevo] = useState<NuevoVehiculo>(NUEVO_VACIO);
  const secuencia = useRef(0);
  const inicialEmitido = useRef(false);

  // Informa el vehículo preseleccionado (p. ej. desde el historial) una sola vez.
  useEffect(() => {
    if (inicial && !inicialEmitido.current) {
      inicialEmitido.current = true;
      onChange({ modo: "existente", vehiculo: inicial });
    }
  }, [inicial, onChange]);

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

    const local = () =>
      buscarVehiculosLocal(snapshot, q).map<VehiculoResultado>((v) => ({
        id: v.id,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        cliente: v.cliente,
      }));

    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        if (!online) {
          if (id === secuencia.current) {
            setResultados(local());
            setUsandoLocal(true);
          }
          return;
        }
        try {
          const data = await buscarVehiculos(q);
          if (id === secuencia.current) {
            setResultados(data);
            setUsandoLocal(false);
          }
        } catch {
          if (id === secuencia.current) {
            setResultados(local());
            setUsandoLocal(true);
          }
        }
      } finally {
        if (id === secuencia.current) setBuscando(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [consulta, online, snapshot]);

  function elegir(v: VehiculoResultado | null) {
    setSeleccionado(v);
    onChange(v ? { modo: "existente", vehiculo: v } : null);
  }

  function actualizarNuevo(cambio: Partial<NuevoVehiculo>) {
    const siguiente = { ...nuevo, ...cambio };
    setNuevo(siguiente);
    onChange({ modo: "nuevo", datos: siguiente });
  }

  function registrarNuevo() {
    const datos = { ...NUEVO_VACIO, placa: normalizarPlaca(consulta).slice(0, 8) };
    setNuevo(datos);
    setModo("nuevo");
    onChange({ modo: "nuevo", datos });
  }

  function volverABuscar() {
    setModo("buscar");
    onChange(null);
  }

  // ---------- Vehículo ya seleccionado ----------
  if (seleccionado) {
    return (
      <div className="rounded-2xl border border-stone-300 bg-stone-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xl font-semibold tracking-wider">{seleccionado.placa}</p>
            <p className="truncate text-base">
              {seleccionado.marca} {seleccionado.modelo}
              {seleccionado.anio ? ` ${seleccionado.anio}` : ""}
            </p>
            <p className="truncate text-sm text-stone-600">{seleccionado.cliente}</p>
          </div>
          <button
            type="button"
            onClick={() => elegir(null)}
            className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink active:bg-stone-200/70"
          >
            <X className="size-4" aria-hidden /> Cambiar
          </button>
        </div>
      </div>
    );
  }

  // ---------- Alta de cliente + vehículo ----------
  if (modo === "nuevo") {
    return (
      <div className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <Car className="size-5" aria-hidden /> Vehículo y cliente nuevos
          </p>
          <button
            type="button"
            onClick={volverABuscar}
            className="h-11 rounded-lg px-3 text-sm font-semibold text-ink active:bg-stone-100"
          >
            Volver a buscar
          </button>
        </div>

        <div>
          <label htmlFor="cliente_nombre" className={LABEL}>
            Nombre del cliente
          </label>
          <input
            id="cliente_nombre"
            value={nuevo.cliente_nombre}
            onChange={(e) => actualizarNuevo({ cliente_nombre: e.target.value })}
            autoComplete="off"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="cliente_telefono" className={LABEL}>
            WhatsApp
          </label>
          <input
            id="cliente_telefono"
            type="tel"
            inputMode="tel"
            placeholder="300 123 4567 o +57…"
            value={nuevo.cliente_telefono}
            onChange={(e) => actualizarNuevo({ cliente_telefono: e.target.value })}
            autoComplete="off"
            className={INPUT}
          />
          <p className="mt-1 text-xs text-stone-500">Sin indicativo se asume Colombia (+57).</p>
        </div>

        <div>
          <label htmlFor="placa" className={LABEL}>
            Placa
          </label>
          <input
            id="placa"
            value={nuevo.placa}
            onChange={(e) => actualizarNuevo({ placa: normalizarPlaca(e.target.value).slice(0, 8) })}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            className={`${INPUT} font-mono text-lg tracking-widest uppercase`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="marca" className={LABEL}>
              Marca
            </label>
            <input
              id="marca"
              value={nuevo.marca}
              onChange={(e) => actualizarNuevo({ marca: e.target.value })}
              autoComplete="off"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="modelo" className={LABEL}>
              Línea
            </label>
            <input
              id="modelo"
              placeholder="Ej: Spark GT"
              value={nuevo.modelo}
              onChange={(e) => actualizarNuevo({ modelo: e.target.value })}
              autoComplete="off"
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="anio" className={LABEL}>
            Modelo <span className="font-normal text-stone-500">(año, opcional)</span>
          </label>
          <input
            id="anio"
            placeholder="Ej: 2018"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            value={nuevo.anio}
            onChange={(e) => actualizarNuevo({ anio: e.target.value })}
            className={INPUT}
          />
        </div>
      </div>
    );
  }

  // ---------- Búsqueda ----------
  const q = consulta.trim();
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Placa o nombre del cliente"
          aria-label="Buscar vehículo por placa o cliente"
          autoComplete="off"
          className={`${INPUT} pl-12 [&::-webkit-search-cancel-button]:hidden`}
        />
        {buscando && (
          <Snowflake className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-copo text-stone-400" aria-hidden />
        )}
      </div>

      {usandoLocal && q.length >= 2 && (
        <p className="flex items-center gap-1.5 text-[12px] text-ochre-700">
          <CloudOff className="size-3.5" aria-hidden /> Buscando en los datos guardados en el teléfono
          {snapshot ? "" : " (aún no hay datos descargados)"}.
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-stone-200/70 bg-white">
          {resultados.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => elegir(v)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-stone-100"
              >
                <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-1 font-mono text-sm font-semibold tracking-wider">
                  {v.placa}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base">
                    {v.marca} {v.modelo}
                    {v.anio ? ` ${v.anio}` : ""}
                  </span>
                  <span className="block truncate text-sm text-stone-600">{v.cliente}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.length >= 2 && !buscando && resultados.length === 0 && (
        <p className="text-sm text-stone-600">No se encontró ningún vehículo con “{q}”.</p>
      )}

      <button
        type="button"
        onClick={registrarNuevo}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-400 text-base font-semibold text-ink active:bg-stone-100"
      >
        <Plus className="size-5" aria-hidden />
        {q.length >= 2 && normalizarPlaca(q).length >= 5
          ? `Registrar ${normalizarPlaca(q)} como vehículo nuevo`
          : "Registrar vehículo nuevo"}
      </button>
    </div>
  );
}
