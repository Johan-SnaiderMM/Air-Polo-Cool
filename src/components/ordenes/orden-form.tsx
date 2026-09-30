"use client";

import Link from "next/link";
import { useActionState, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, ShieldCheck } from "lucide-react";
import { guardarOrden, type OrdenFormState, type VehiculoResultado } from "@/app/(app)/ordenes/actions";
import {
  PERTENENCIAS_VACIAS,
  PertenenciasChecklist,
} from "@/components/ordenes/pertenencias-checklist";
import { SelectorMantenimiento, type MesesMantenimiento } from "@/components/ordenes/selector-mantenimiento";
import { VehiculoSelector, type SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { nuevoId, type DatosOrden, type DatosVehiculoOrden } from "@/lib/offline/operaciones";
import {
  ESTADOS_FLUJO,
  ESTADO_LABEL,
  OPCIONES_GARANTIA,
  calcularFinGarantia,
  formatearFechaDate,
  normalizarPlaca,
  normalizarTelefono,
} from "@/lib/ordenes";
import type { EstadoOrden, Pertenencias } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const TEXTAREA =
  "w-full rounded-xl border border-stone-300/70 bg-white px-4 py-3 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";
const LEYENDA = "mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase";

export type OrdenFormValores = {
  kilometraje: string;
  diagnostico_inicial: string;
  trabajos_a_realizar: string;
  mano_obra: string;
  total_cobrado: string;
  dias_garantia: number;
  estado: EstadoOrden;
  pertenencias: Pertenencias | null;
  mantenimiento_meses: MesesMantenimiento;
};

const VALORES_NUEVA: OrdenFormValores = {
  kilometraje: "",
  diagnostico_inicial: "",
  trabajos_a_realizar: "",
  mano_obra: "",
  total_cobrado: "",
  dias_garantia: 0,
  estado: "recibido",
  pertenencias: null,
  mantenimiento_meses: null,
};

type Props =
  | { modo: "crear"; vehiculoInicial?: VehiculoResultado | null }
  | {
      modo: "editar";
      ordenId: string;
      valores: OrdenFormValores;
      /** ISO de la entrega, si ya fue entregada. */
      fechaEntrega: string | null;
    };

const numeroONull = (t: string): number | null => {
  if (t.trim() === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Orden de servicio (crear / editar).
 *  - CREAR funciona sin conexión: genera los ids en el teléfono y pasa por la cola de
 *    sincronización (misma validación e idempotencia que en línea).
 *  - EDITAR usa la Server Action (requiere conexión).
 */
export function OrdenForm(props: Props) {
  const editando = props.modo === "editar";
  const router = useRouter();
  const { registrar } = useSync();
  const { autor } = useAutor();

  const [state, action, pendienteEdicion] = useActionState<OrdenFormState, FormData>(guardarOrden, {});
  const [v, setV] = useState<OrdenFormValores>(props.modo === "editar" ? props.valores : VALORES_NUEVA);
  const [vehiculo, setVehiculo] = useState<SeleccionVehiculo | null>(null);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [enCola, setEnCola] = useState(false);
  const [creando, iniciarCrear] = useTransition();

  const alElegirVehiculo = useCallback((s: SeleccionVehiculo | null) => setVehiculo(s), []);

  function set<K extends keyof OrdenFormValores>(k: K, valor: OrdenFormValores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }));
  }

  const fechaEntrega = props.modo === "editar" ? props.fechaEntrega : null;
  const entregaEfectiva = v.estado === "entregado" ? fechaEntrega : null;
  const fin = calcularFinGarantia(entregaEfectiva, v.dias_garantia);
  const listoOEntregado = v.estado === "listo" || v.estado === "entregado";
  const pertenencias = v.pertenencias ?? PERTENENCIAS_VACIAS;

  // ---------------------------------------------------------------------
  // Crear (offline-first)
  // ---------------------------------------------------------------------
  function crear(e: React.FormEvent) {
    e.preventDefault();
    setErrorCrear(null);

    if (!vehiculo) {
      setErrorCrear("Selecciona un vehículo o registra uno nuevo.");
      return;
    }

    let datosVehiculo: DatosVehiculoOrden;
    if (vehiculo.modo === "existente") {
      datosVehiculo = { nuevo: false, id: vehiculo.vehiculo.id };
    } else {
      const d = vehiculo.datos;
      const telefono = normalizarTelefono(d.cliente_telefono);
      const placa = normalizarPlaca(d.placa);
      const anio = numeroONull(d.anio);
      if (!d.cliente_nombre.trim()) return setErrorCrear("Ingresa el nombre del cliente.");
      if (!telefono) return setErrorCrear("WhatsApp inválido. Usa 10 dígitos (300 123 4567) o el formato +57…");
      if (!/^[A-Z0-9]{5,8}$/.test(placa)) return setErrorCrear("La placa debe tener entre 5 y 8 letras/números.");
      if (!d.marca.trim() || !d.modelo.trim()) return setErrorCrear("Ingresa la marca y la línea.");
      if (anio !== null && (Number.isNaN(anio) || !Number.isInteger(anio) || anio < 1950 || anio > 2100)) {
        return setErrorCrear("El modelo (año) debe estar entre 1950 y 2100.");
      }
      datosVehiculo = {
        nuevo: true,
        id: nuevoId(),
        cliente_id: nuevoId(),
        cliente_nombre: d.cliente_nombre.trim(),
        cliente_telefono: telefono,
        placa,
        marca: d.marca.trim(),
        modelo: d.modelo.trim(),
        anio,
      };
    }

    const km = numeroONull(v.kilometraje);
    const manoObra = numeroONull(v.mano_obra) ?? 0;
    const total = numeroONull(v.total_cobrado) ?? 0;
    if (km !== null && (Number.isNaN(km) || km < 0 || !Number.isInteger(km))) {
      return setErrorCrear("El kilometraje debe ser un número entero mayor o igual a 0.");
    }
    if (Number.isNaN(manoObra) || manoObra < 0 || Number.isNaN(total) || total < 0) {
      return setErrorCrear("Los valores de cobro deben ser mayores o iguales a 0.");
    }

    const datos: DatosOrden = {
      id: nuevoId(),
      vehiculo: datosVehiculo,
      kilometraje: km,
      diagnostico_inicial: v.diagnostico_inicial.trim() || null,
      trabajos_a_realizar: v.trabajos_a_realizar.trim() || null,
      mano_obra: manoObra,
      total_cobrado: total,
      dias_garantia: v.dias_garantia,
      estado: v.estado,
      pertenencias: v.pertenencias,
      mantenimiento_meses: listoOEntregado ? v.mantenimiento_meses : null,
      autor,
    };

    iniciarCrear(async () => {
      const r = await registrar({ tipo: "orden.crear", datos });
      if (r.estado === "error") setErrorCrear(r.error);
      else if (r.estado === "sincronizado") router.push(`/ordenes/${datos.id}`);
      else setEnCola(true);
    });
  }

  if (enCola) {
    return (
      <div className="space-y-4 rounded-2xl border border-ochre-300 bg-ochre-50 p-5 text-center">
        <CloudUpload className="mx-auto size-9 text-ochre-700" strokeWidth={1.5} aria-hidden />
        <p className="font-serif text-2xl text-ochre-800">Orden guardada en el teléfono</p>
        <p className="text-sm text-ochre-800">
          No hay conexión: la orden se subirá sola cuando vuelva la red. Las fotos podrás agregarlas cuando esté
          sincronizada.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEnCola(false);
              setV(VALORES_NUEVA);
              setVehiculo(null);
              router.refresh();
            }}
            className="h-12 rounded-xl border border-ochre-300 bg-white text-sm font-medium active:bg-ochre-100"
          >
            Crear otra
          </button>
          <Link
            href="/ordenes"
            className="flex h-12 items-center justify-center rounded-xl bg-ink text-sm font-medium text-white active:bg-ink-soft"
          >
            Ir a órdenes
          </Link>
        </div>
      </div>
    );
  }

  const pendiente = editando ? pendienteEdicion : creando;
  const formProps = editando ? { action } : { onSubmit: crear };

  return (
    <form {...formProps} className="space-y-6">
      {props.modo === "editar" && (
        <>
          <input type="hidden" name="orden_id" value={props.ordenId} />
          <input type="hidden" name="autor" value={autor} />
          <input type="hidden" name="pertenencias" value={v.pertenencias ? JSON.stringify(v.pertenencias) : ""} />
          <input
            type="hidden"
            name="mantenimiento_meses"
            value={listoOEntregado && v.mantenimiento_meses ? String(v.mantenimiento_meses) : ""}
          />
        </>
      )}

      {!editando && (
        <fieldset className="space-y-2">
          <legend className={LEYENDA}>Vehículo</legend>
          <VehiculoSelector
            inicial={props.modo === "crear" ? (props.vehiculoInicial ?? null) : null}
            onChange={alElegirVehiculo}
          />
        </fieldset>
      )}

      <fieldset className="space-y-4">
        <legend className={LEYENDA}>Recepción</legend>

        <div>
          <label htmlFor="estado" className={LABEL}>
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            value={v.estado}
            onChange={(e) => set("estado", e.target.value as EstadoOrden)}
            className={INPUT}
          >
            {ESTADOS_FLUJO.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="kilometraje" className={LABEL}>
            Kilometraje
          </label>
          <input
            id="kilometraje"
            name="kilometraje"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="km al ingreso"
            value={v.kilometraje}
            onChange={(e) => set("kilometraje", e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="diagnostico_inicial" className={LABEL}>
            Diagnóstico inicial
          </label>
          <textarea
            id="diagnostico_inicial"
            name="diagnostico_inicial"
            rows={4}
            placeholder="Fugas detectadas, presiones, escaneo…"
            value={v.diagnostico_inicial}
            onChange={(e) => set("diagnostico_inicial", e.target.value)}
            className={TEXTAREA}
          />
        </div>

        <div>
          <label htmlFor="trabajos_a_realizar" className={LABEL}>
            Trabajos a realizar
          </label>
          <textarea
            id="trabajos_a_realizar"
            name="trabajos_a_realizar"
            rows={4}
            placeholder="Cambio de compresor, vacío y recarga R134a…"
            value={v.trabajos_a_realizar}
            onChange={(e) => set("trabajos_a_realizar", e.target.value)}
            className={TEXTAREA}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={LEYENDA}>Pertenencias al ingreso</legend>
        {v.pertenencias === null && (
          <button
            type="button"
            onClick={() => set("pertenencias", PERTENENCIAS_VACIAS)}
            className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-[14px] font-medium text-stone-600 active:bg-stone-100"
          >
            Registrar pertenencias del vehículo
          </button>
        )}
        {v.pertenencias !== null && (
          <PertenenciasChecklist value={pertenencias} onChange={(p) => set("pertenencias", p)} />
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={LEYENDA}>Cobro y garantía</legend>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mano_obra" className={LABEL}>
              Mano de obra ($)
            </label>
            <input
              id="mano_obra"
              name="mano_obra"
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              placeholder="0"
              value={v.mano_obra}
              onChange={(e) => set("mano_obra", e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="total_cobrado" className={LABEL}>
              Total a cobrar ($)
            </label>
            <input
              id="total_cobrado"
              name="total_cobrado"
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              placeholder="0"
              value={v.total_cobrado}
              onChange={(e) => set("total_cobrado", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="dias_garantia" className={LABEL}>
            Garantía
          </label>
          <select
            id="dias_garantia"
            name="dias_garantia"
            value={v.dias_garantia}
            onChange={(e) => set("dias_garantia", Number(e.target.value))}
            className={INPUT}
          >
            {OPCIONES_GARANTIA.map((o) => (
              <option key={o.dias} value={o.dias}>
                {o.label}
              </option>
            ))}
          </select>

          {v.dias_garantia > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {fin && entregaEfectiva ? (
                  <>
                    Vence el <strong>{formatearFechaDate(fin)}</strong>.
                  </>
                ) : (
                  <>
                    Si se entrega hoy, vence el <strong>{formatearFechaDate(fin!)}</strong>. La garantía se cuenta
                    desde la entrega.
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      </fieldset>

      {listoOEntregado && (
        <SelectorMantenimiento
          value={v.mantenimiento_meses}
          onChange={(m) => set("mantenimiento_meses", m)}
          destacar
        />
      )}

      {editando && state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}
      {editando && state.ok && (
        <p role="status" className="rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-800">
          {state.ok}
        </p>
      )}
      {!editando && errorCrear && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {errorCrear}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white transition-colors active:bg-ink-soft disabled:opacity-60"
      >
        {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Crear orden"}
      </button>
    </form>
  );
}
