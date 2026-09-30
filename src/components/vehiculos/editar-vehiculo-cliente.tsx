"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Snowflake, Pencil, UserRound } from "lucide-react";
import {
  editarCliente,
  editarVehiculo,
  type EdicionState,
} from "@/app/(app)/vehiculos/actions";
import { Drawer } from "@/components/ui/drawer";
import { normalizarPlaca } from "@/lib/ordenes";
import type { Tables } from "@/types/database";

const INPUT =
  "h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
const LABEL = "mb-1 block text-sm font-medium";

function Pie({ state, pending, etiqueta }: { state: EdicionState; pending: boolean; etiqueta: string }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white active:bg-ink-soft disabled:opacity-60"
      >
        {pending && <Snowflake className="size-5 animate-copo" aria-hidden />}
        {pending ? "Guardando…" : etiqueta}
      </button>
    </>
  );
}

function VehiculoForm({ vehiculo, onListo }: { vehiculo: Tables<"vehiculos">; onListo: () => void }) {
  const [state, action, pending] = useActionState<EdicionState, FormData>(editarVehiculo, {});
  const [v, setV] = useState({
    placa: vehiculo.placa,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    anio: vehiculo.anio?.toString() ?? "",
    gas: vehiculo.tipo_gas_sugerido ?? "",
    carga: vehiculo.carga_estandar_gramos?.toString() ?? "",
  });

  useEffect(() => {
    if (state.ok) onListo();
  }, [state.ok, onListo]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vehiculo_id" value={vehiculo.id} />
      <div>
        <label htmlFor="ev_placa" className={LABEL}>Placa</label>
        <input
          id="ev_placa"
          name="placa"
          value={v.placa}
          onChange={(e) => setV({ ...v, placa: normalizarPlaca(e.target.value).slice(0, 8) })}
          autoCapitalize="characters"
          maxLength={8}
          required
          className={`${INPUT} font-mono text-lg tracking-widest uppercase`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ev_marca" className={LABEL}>Marca</label>
          <input id="ev_marca" name="marca" value={v.marca} onChange={(e) => setV({ ...v, marca: e.target.value })} required className={INPUT} />
        </div>
        <div>
          <label htmlFor="ev_modelo" className={LABEL}>Línea</label>
          <input id="ev_modelo" name="modelo" value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} required className={INPUT} />
        </div>
      </div>
      <div>
        <label htmlFor="ev_anio" className={LABEL}>Modelo (año)</label>
        <input id="ev_anio" name="anio" type="number" inputMode="numeric" min={1950} max={2100} value={v.anio} onChange={(e) => setV({ ...v, anio: e.target.value })} className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ev_gas" className={LABEL}>Refrigerante</label>
          <select id="ev_gas" name="tipo_gas_sugerido" value={v.gas} onChange={(e) => setV({ ...v, gas: e.target.value })} className={INPUT}>
            <option value="">Sin definir</option>
            <option value="R134a">R134a</option>
            <option value="R1234yf">R1234yf</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor="ev_carga" className={LABEL}>Carga (g)</label>
          <input id="ev_carga" name="carga_estandar_gramos" type="number" inputMode="decimal" min={0} step="any" placeholder="450" value={v.carga} onChange={(e) => setV({ ...v, carga: e.target.value })} className={INPUT} />
        </div>
      </div>
      <Pie state={state} pending={pending} etiqueta="Guardar vehículo" />
    </form>
  );
}

function ClienteForm({
  cliente,
  vehiculoId,
  onListo,
}: {
  cliente: Tables<"clientes">;
  vehiculoId: string;
  onListo: () => void;
}) {
  const [state, action, pending] = useActionState<EdicionState, FormData>(editarCliente, {});
  const [v, setV] = useState({
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    documento: cliente.documento ?? "",
  });

  useEffect(() => {
    if (state.ok) onListo();
  }, [state.ok, onListo]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="cliente_id" value={cliente.id} />
      <input type="hidden" name="vehiculo_id" value={vehiculoId} />
      <div>
        <label htmlFor="ec_nombre" className={LABEL}>Nombre</label>
        <input id="ec_nombre" name="nombre" value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} required className={INPUT} />
      </div>
      <div>
        <label htmlFor="ec_tel" className={LABEL}>WhatsApp</label>
        <input id="ec_tel" name="telefono" type="tel" inputMode="tel" value={v.telefono} onChange={(e) => setV({ ...v, telefono: e.target.value })} required className={INPUT} />
        <p className="mt-1 text-xs text-stone-500">Formato +57…; sin indicativo se asume Colombia.</p>
      </div>
      <div>
        <label htmlFor="ec_doc" className={LABEL}>Documento <span className="font-normal text-stone-500">(opcional)</span></label>
        <input id="ec_doc" name="documento" value={v.documento} onChange={(e) => setV({ ...v, documento: e.target.value })} className={INPUT} />
      </div>
      <Pie state={state} pending={pending} etiqueta="Guardar cliente" />
    </form>
  );
}

export function EditarVehiculoCliente({
  vehiculo,
  cliente,
}: {
  vehiculo: Tables<"vehiculos">;
  cliente: Tables<"clientes">;
}) {
  const [panel, setPanel] = useState<"vehiculo" | "cliente" | null>(null);
  const cerrar = useCallback(() => setPanel(null), []);

  const boton =
    "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300/70 bg-white text-sm font-semibold text-stone-700 active:bg-stone-100";

  return (
    <>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPanel("vehiculo")} className={boton}>
          <Pencil className="size-4" aria-hidden /> Editar vehículo
        </button>
        <button type="button" onClick={() => setPanel("cliente")} className={boton}>
          <UserRound className="size-4" aria-hidden /> Editar cliente
        </button>
      </div>

      {panel === "vehiculo" && (
        <Drawer titulo="Editar vehículo" onClose={cerrar}>
          <VehiculoForm vehiculo={vehiculo} onListo={cerrar} />
        </Drawer>
      )}
      {panel === "cliente" && (
        <Drawer titulo="Editar cliente" onClose={cerrar}>
          <ClienteForm cliente={cliente} vehiculoId={vehiculo.id} onListo={cerrar} />
        </Drawer>
      )}
    </>
  );
}
