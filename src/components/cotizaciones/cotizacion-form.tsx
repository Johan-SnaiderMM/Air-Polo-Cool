"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Snowflake, Plus, Search, Trash2 } from "lucide-react";
import { guardarCotizacion, type CotizacionFormState } from "@/app/(app)/cotizaciones/actions";
import { buscarInventario, type ItemBuscado } from "@/app/(app)/ordenes/repuestos-actions";
import { VehiculoSelector, type SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { useAutor } from "@/components/sync/autor-provider";
import { Dinero } from "@/components/ui/dinero";
import { VIGENCIAS_DIAS, totalesCotizacion, type ItemCotizacion } from "@/lib/cotizaciones";
import { admiteDecimales } from "@/lib/inventario";
import { formatearMoneda } from "@/lib/ordenes";

const INPUT =
  "h-12 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-[15px] outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LEYENDA = "mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase";

/** Ítem en edición: números como texto para no pelear con el teclado. */
type ItemEdicion = {
  clave: string;
  inventario_id: string | null;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  costo_unitario: number;
  decimales: boolean;
};

type Props =
  | { modo: "crear" }
  | {
      modo: "editar";
      cotizacionId: string;
      vehiculoTexto: string;
      inicial: {
        mano_obra: number;
        vigencia_dias: number;
        notas: string;
        items: ItemCotizacion[];
      };
    };

let contador = 0;
const clave = () => `it-${Date.now()}-${contador++}`;

function aEdicion(i: ItemCotizacion): ItemEdicion {
  return {
    clave: clave(),
    inventario_id: i.inventario_id,
    descripcion: i.descripcion,
    cantidad: String(i.cantidad),
    precio_unitario: String(i.precio_unitario),
    costo_unitario: i.costo_unitario,
    decimales: !Number.isInteger(i.cantidad),
  };
}

function aItem(e: ItemEdicion): ItemCotizacion {
  return {
    inventario_id: e.inventario_id,
    descripcion: e.descripcion,
    cantidad: Number(e.cantidad.replace(",", ".")) || 0,
    precio_unitario: Number(e.precio_unitario.replace(",", ".")) || 0,
    costo_unitario: e.costo_unitario,
  };
}

/** Buscador de inventario + ítem libre. Requiere conexión (consulta el catálogo). */
function AgregarItem({ onAgregar }: { onAgregar: (i: ItemEdicion) => void }) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<ItemBuscado[]>([]);
  const [libre, setLibre] = useState(false);
  const [descLibre, setDescLibre] = useState("");

  useEffect(() => {
    const q = consulta.trim();
    if (q.length < 2) {
      const t = setTimeout(() => setResultados([]), 0);
      return () => clearTimeout(t);
    }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await buscarInventario(q);
        if (vivo) setResultados(r);
      } catch {
        if (vivo) setResultados([]);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [consulta]);

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-stone-300 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar repuesto en inventario"
          aria-label="Buscar repuesto en inventario"
          className="h-11 w-full rounded-xl border border-stone-200/80 bg-white pr-3 pl-9 text-[15px] outline-none focus:border-stone-400 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      {resultados.length > 0 && (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-xl border border-stone-200/70 bg-white">
          {resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onAgregar({
                    clave: clave(),
                    inventario_id: r.id,
                    descripcion: r.nombre,
                    cantidad: "1",
                    precio_unitario: String(r.precio_venta),
                    costo_unitario: r.costo_compra,
                    decimales: admiteDecimales(r.tipo_unidad),
                  });
                  setConsulta("");
                  setResultados([]);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left active:bg-stone-50"
              >
                <span className="min-w-0 truncate text-[15px]">{r.nombre}</span>
                <span className="shrink-0 font-mono text-[13px] text-stone-500">{formatearMoneda(r.precio_venta)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {libre ? (
        <div className="flex gap-2">
          <input
            value={descLibre}
            onChange={(e) => setDescLibre(e.target.value)}
            placeholder="Descripción (ej. Servicio de vacío)"
            aria-label="Descripción del ítem libre"
            className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200/80 bg-white px-3 text-[15px] outline-none focus:border-stone-400"
          />
          <button
            type="button"
            disabled={descLibre.trim().length === 0}
            onClick={() => {
              onAgregar({
                clave: clave(),
                inventario_id: null,
                descripcion: descLibre.trim(),
                cantidad: "1",
                precio_unitario: "",
                costo_unitario: 0,
                decimales: true,
              });
              setDescLibre("");
              setLibre(false);
            }}
            className="h-11 rounded-xl bg-ink px-4 text-sm font-medium text-white active:bg-ink-soft disabled:bg-stone-200 disabled:text-stone-400"
          >
            Agregar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLibre(true)}
          className="flex items-center gap-1.5 text-[13px] text-stone-500 underline underline-offset-2"
        >
          <Plus className="size-3.5" aria-hidden /> Agregar un ítem que no está en inventario
        </button>
      )}
    </div>
  );
}

export function CotizacionForm(props: Props) {
  const editando = props.modo === "editar";
  const { autor } = useAutor();
  const [state, action, pendiente] = useActionState<CotizacionFormState, FormData>(guardarCotizacion, {});
  const [vehiculo, setVehiculo] = useState<SeleccionVehiculo | null>(null);
  const [manoObra, setManoObra] = useState(props.modo === "editar" ? String(props.inicial.mano_obra || "") : "");
  const [vigencia, setVigencia] = useState(props.modo === "editar" ? props.inicial.vigencia_dias : 15);
  const [notas, setNotas] = useState(props.modo === "editar" ? props.inicial.notas : "");
  const [items, setItems] = useState<ItemEdicion[]>(() =>
    props.modo === "editar" ? props.inicial.items.map(aEdicion) : []
  );

  const alElegirVehiculo = useCallback((s: SeleccionVehiculo | null) => setVehiculo(s), []);
  const totales = totalesCotizacion(Number(manoObra) || 0, items.map(aItem));

  function cambiar(claveItem: string, cambio: Partial<ItemEdicion>) {
    setItems((prev) => prev.map((i) => (i.clave === claveItem ? { ...i, ...cambio } : i)));
  }

  return (
    <form action={action} className="space-y-6">
      {props.modo === "editar" && <input type="hidden" name="cotizacion_id" value={props.cotizacionId} />}
      <input type="hidden" name="autor" value={autor} />
      <input type="hidden" name="items" value={JSON.stringify(items.map(aItem))} />
      {!editando && <input type="hidden" name="vehiculo" value={vehiculo ? JSON.stringify(vehiculo) : ""} />}

      <fieldset className="space-y-2">
        <legend className={LEYENDA}>Vehículo</legend>
        {editando ? (
          <p className="rounded-xl bg-stone-100 px-4 py-3 text-[15px]">{props.vehiculoTexto}</p>
        ) : (
          <VehiculoSelector onChange={alElegirVehiculo} />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={LEYENDA}>Repuestos e insumos</legend>

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.clave} className="space-y-2 rounded-2xl border border-stone-200/70 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    value={i.descripcion}
                    onChange={(e) => cambiar(i.clave, { descripcion: e.target.value })}
                    aria-label="Descripción"
                    maxLength={200}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-[15px] font-medium outline-none focus:border-stone-300"
                  />
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.clave !== i.clave))}
                    aria-label={`Quitar ${i.descripcion}`}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-stone-400 hover:text-brick-600 active:text-brick-600"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-[5rem_1fr_auto] items-end gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-stone-500">Cantidad</label>
                    <input
                      inputMode={i.decimales ? "decimal" : "numeric"}
                      value={i.cantidad}
                      onChange={(e) => cambiar(i.clave, { cantidad: e.target.value })}
                      className="h-11 w-full rounded-lg border border-stone-200/80 bg-white px-3 text-center font-mono text-[15px] outline-none focus:border-stone-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-stone-500">Precio unitario ($)</label>
                    <input
                      inputMode="numeric"
                      value={i.precio_unitario}
                      onChange={(e) => cambiar(i.clave, { precio_unitario: e.target.value.replace(/[^\d.,]/g, "") })}
                      placeholder="0"
                      className="h-11 w-full rounded-lg border border-stone-200/80 bg-white px-3 text-right font-mono text-[15px] outline-none focus:border-stone-400"
                    />
                  </div>
                  <p className="pb-2.5 text-right text-[14px]">
                    <Dinero valor={aItem(i).cantidad * aItem(i).precio_unitario} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <AgregarItem onAgregar={(i) => setItems((prev) => [...prev, i])} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={LEYENDA}>Mano de obra y condiciones</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mano_obra" className="mb-1 block text-sm font-medium">
              Mano de obra ($)
            </label>
            <input
              id="mano_obra"
              name="mano_obra"
              inputMode="numeric"
              value={manoObra}
              onChange={(e) => setManoObra(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="vigencia_dias" className="mb-1 block text-sm font-medium">
              Vigencia
            </label>
            <select
              id="vigencia_dias"
              name="vigencia_dias"
              value={vigencia}
              onChange={(e) => setVigencia(Number(e.target.value))}
              className={INPUT}
            >
              {VIGENCIAS_DIAS.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          name="notas"
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas para el cliente (garantía, tiempos, condiciones)"
          className="w-full rounded-xl border border-stone-300/70 bg-white px-4 py-3 text-[15px] outline-none focus:border-stone-400"
        />
      </fieldset>

      <div className="rounded-2xl bg-ink p-5 text-paper">
        <dl className="space-y-1.5 text-[13px] text-stone-300">
          <div className="flex justify-between">
            <dt>Repuestos e insumos</dt>
            <dd>
              <Dinero valor={totales.repuestos} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Mano de obra</dt>
            <dd>
              <Dinero valor={totales.manoObra} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] text-stone-400">Total de la cotización</p>
        <p className="mt-1 text-[30px] leading-none font-medium tracking-tight">
          <Dinero valor={totales.total} />
        </p>
        <p className="mt-2 text-[12px] text-stone-500">
          Margen estimado (interno): <Dinero valor={totales.margenEstimado} />
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-medium text-white active:bg-ink-soft disabled:opacity-60"
      >
        {pendiente && <Snowflake className="size-5 animate-copo" aria-hidden />}
        {editando ? "Guardar cotización" : "Crear cotización"}
      </button>
    </form>
  );
}
