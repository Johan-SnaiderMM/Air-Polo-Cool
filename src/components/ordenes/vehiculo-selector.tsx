"use client";

import { useEffect, useRef, useState } from "react";
import { Car, Loader2, Plus, Search, X } from "lucide-react";
import {
  buscarVehiculos,
  type VehiculoResultado,
} from "@/app/(app)/ordenes/actions";
import { normalizarPlaca } from "@/lib/ordenes";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

type Modo = "buscar" | "nuevo";

type NuevoVehiculo = {
  cliente_nombre: string;
  cliente_telefono: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: string;
};

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
 * Emite sus valores como inputs ocultos/controlados dentro del <form> padre.
 */
export function VehiculoSelector({ inicial = null }: { inicial?: VehiculoResultado | null }) {
  const [modo, setModo] = useState<Modo>("buscar");
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<VehiculoResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<VehiculoResultado | null>(inicial);
  const [nuevo, setNuevo] = useState<NuevoVehiculo>(NUEVO_VACIO);
  const secuencia = useRef(0);

  useEffect(() => {
    const q = consulta.trim();
    const id = ++secuencia.current;

    if (q.length < 2) {
      // Se difiere para no actualizar estado de forma síncrona dentro del efecto.
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
        const data = await buscarVehiculos(q);
        if (id === secuencia.current) setResultados(data);
      } finally {
        if (id === secuencia.current) setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [consulta]);

  function campo<K extends keyof NuevoVehiculo>(k: K, valor: string) {
    setNuevo((prev) => ({ ...prev, [k]: valor }));
  }

  function registrarNuevo() {
    setNuevo({ ...NUEVO_VACIO, placa: normalizarPlaca(consulta).slice(0, 8) });
    setModo("nuevo");
  }

  // ---------- Vehículo ya seleccionado ----------
  if (seleccionado) {
    return (
      <div className="rounded-2xl border border-stone-300 bg-stone-100 p-4">
        <input type="hidden" name="vehiculo_id" value={seleccionado.id} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xl font-semibold tracking-wider">
              {seleccionado.placa}
            </p>
            <p className="truncate text-base">
              {seleccionado.marca} {seleccionado.modelo}
              {seleccionado.anio ? ` ${seleccionado.anio}` : ""}
            </p>
            <p className="truncate text-sm text-stone-600">{seleccionado.cliente}</p>
          </div>
          <button
            type="button"
            onClick={() => setSeleccionado(null)}
            className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink active:bg-stone-100"
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
        <input type="hidden" name="modo_vehiculo" value="nuevo" />
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <Car className="size-5" aria-hidden /> Vehículo y cliente nuevos
          </p>
          <button
            type="button"
            onClick={() => setModo("buscar")}
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
            name="cliente_nombre"
            value={nuevo.cliente_nombre}
            onChange={(e) => campo("cliente_nombre", e.target.value)}
            autoComplete="off"
            required
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="cliente_telefono" className={LABEL}>
            WhatsApp
          </label>
          <input
            id="cliente_telefono"
            name="cliente_telefono"
            type="tel"
            inputMode="tel"
            placeholder="300 123 4567 o +57…"
            value={nuevo.cliente_telefono}
            onChange={(e) => campo("cliente_telefono", e.target.value)}
            autoComplete="off"
            required
            className={INPUT}
          />
          <p className="mt-1 text-xs text-stone-500">
            Sin indicativo se asume Colombia (+57).
          </p>
        </div>

        <div>
          <label htmlFor="placa" className={LABEL}>
            Placa
          </label>
          <input
            id="placa"
            name="placa"
            value={nuevo.placa}
            onChange={(e) => campo("placa", normalizarPlaca(e.target.value).slice(0, 8))}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            required
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
              name="marca"
              value={nuevo.marca}
              onChange={(e) => campo("marca", e.target.value)}
              autoComplete="off"
              required
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="modelo" className={LABEL}>
              Modelo
            </label>
            <input
              id="modelo"
              name="modelo"
              value={nuevo.modelo}
              onChange={(e) => campo("modelo", e.target.value)}
              autoComplete="off"
              required
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="anio" className={LABEL}>
            Año <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <input
            id="anio"
            name="anio"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            value={nuevo.anio}
            onChange={(e) => campo("anio", e.target.value)}
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
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
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
          <Loader2
            className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-stone-400"
            aria-hidden
          />
        )}
      </div>

      {resultados.length > 0 && (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-stone-200/70 bg-white">
          {resultados.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSeleccionado(v)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-stone-100"
              >
                <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-1 font-mono text-sm font-semibold tracking-wider text-ink">
                  {v.placa}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base">
                    {v.marca} {v.modelo}
                    {v.anio ? ` ${v.anio}` : ""}
                  </span>
                  <span className="block truncate text-sm text-stone-600">
                    {v.cliente}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.length >= 2 && !buscando && resultados.length === 0 && (
        <p className="text-sm text-stone-600">
          No se encontró ningún vehículo con “{q}”.
        </p>
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
