"use client";

import { useState, useTransition } from "react";
import { Ban, ExternalLink, Loader2, Pencil } from "lucide-react";
import { anularGasto, editarGasto } from "@/app/(app)/caja-menor/actions";
import { SelectorCategoria } from "@/components/caja/selector-categoria";
import { SelectorOrden } from "@/components/caja/selector-orden";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync } from "@/components/sync/sync-provider";
import { Dinero } from "@/components/ui/dinero";
import { Drawer } from "@/components/ui/drawer";
import { FormularioAnulacion } from "@/components/ui/dialogo-motivo";
import { PosMonto } from "@/components/ui/pos-monto";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { CATEGORIA_LABEL, etiquetaDia } from "@/lib/caja";
import type { OrdenLocal } from "@/lib/offline/snapshot";
import type { GastoVista } from "@/components/caja/lista-gastos";
import type { CategoriaGasto } from "@/types/database";

type Modo = "detalle" | "editar" | "anular";

function EditarGastoForm({ gasto, onListo }: { gasto: GastoVista; onListo: () => void }) {
  const { autor } = useAutor();
  const { snapshot, online } = useSync();
  const [digitos, setDigitos] = useState(String(Math.round(gasto.monto)));
  const [categoria, setCategoria] = useState<CategoriaGasto | null>(gasto.categoria);
  const [descripcion, setDescripcion] = useState(gasto.descripcion ?? "");
  const [fecha, setFecha] = useState(gasto.fecha);
  const [orden, setOrden] = useState<OrdenLocal | null>(() => {
    if (!gasto.ordenId) return null;
    return (
      snapshot?.ordenes.find((o) => o.id === gasto.ordenId) ?? {
        id: gasto.ordenId,
        placa: gasto.placa ?? "Orden",
        marca: "",
        modelo: "",
        cliente: "",
        estado: "recibido",
        total_cobrado: 0,
        saldo: 0,
      }
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    if (!categoria || Number(digitos) <= 0) {
      setError("Ingresa un monto y una categoría.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await editarGasto({
        id: gasto.id,
        fecha,
        categoria,
        monto: Number(digitos),
        descripcion,
        ordenId: orden?.id ?? null,
        autor,
      });
      if (r.ok) onListo();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <PosMonto id="edit-monto" etiqueta="Monto" digitos={digitos} onChange={setDigitos} tamano="normal" />
      <SelectorCategoria value={categoria} onChange={setCategoria} />
      <input
        aria-label="Nota"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        maxLength={300}
        placeholder="Nota"
        className="h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400"
      />
      <SelectorFecha value={fecha} onChange={setFecha} />
      <SelectorOrden value={orden} onChange={setOrden} />

      {!online && (
        <p className="rounded-lg bg-ochre-50 px-3 py-2 text-sm text-ochre-800">
          Editar requiere conexión (queda un historial de cambios auditable).
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={pendiente || !online}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-medium text-white active:bg-ink-soft disabled:bg-stone-200 disabled:text-stone-400"
      >
        {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
        Guardar cambios
      </button>
    </div>
  );
}

type Antes = { fecha?: string; categoria?: CategoriaGasto; monto?: number; descripcion?: string | null };

export function GastoDrawer({ gasto, onClose }: { gasto: GastoVista; onClose: () => void }) {
  const { autor } = useAutor();
  const { online } = useSync();
  const [modo, setModo] = useState<Modo>("detalle");

  const titulo = modo === "editar" ? "Editar gasto" : modo === "anular" ? "Anular gasto" : "Detalle del gasto";

  return (
    <Drawer titulo={titulo} onClose={onClose}>
      {modo === "editar" && <EditarGastoForm gasto={gasto} onListo={onClose} />}

      {modo === "anular" && (
        <FormularioAnulacion
          advertencia="El gasto NO se borra: queda anulado con su motivo y deja de sumar en la caja y el balance."
          onConfirmar={(motivo) => anularGasto({ id: gasto.id, motivo, autor })}
          onListo={onClose}
        />
      )}

      {modo === "detalle" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-[13px] text-stone-500">
              {CATEGORIA_LABEL[gasto.categoria]} · {etiquetaDia(gasto.fecha)}
            </p>
            <p className={`mt-1 text-3xl ${gasto.anulado ? "text-stone-400 line-through" : ""}`}>
              <Dinero valor={gasto.monto} />
            </p>
            {gasto.descripcion && <p className="mt-2 text-[15px]">{gasto.descripcion}</p>}
          </div>

          <dl className="space-y-2 text-[14px]">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Registrado por</dt>
              <dd className="font-medium">{gasto.autor ?? "—"}</dd>
            </div>
            {gasto.placa && (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">Orden asociada</dt>
                <dd className="font-mono font-semibold tracking-wider">{gasto.placa}</dd>
              </div>
            )}
            {gasto.anulado && (
              <div className="rounded-xl bg-brick-50 px-4 py-3 text-brick-700">
                <p className="text-[12px] font-medium tracking-wide uppercase">Anulado</p>
                <p className="text-[14px]">
                  {gasto.anuladoMotivo}
                  {gasto.anuladoAutor ? ` · ${gasto.anuladoAutor}` : ""}
                </p>
              </div>
            )}
          </dl>

          {gasto.historial.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
                Historial de ediciones
              </p>
              <ul className="space-y-2">
                {gasto.historial.map((h, i) => {
                  const antes = (h.antes ?? {}) as Antes;
                  return (
                    <li key={i} className="rounded-lg border border-stone-200/70 px-3 py-2 text-[13px] text-stone-600">
                      <p className="font-medium text-ink">
                        {h.autor ?? "—"} ·{" "}
                        {new Date(h.at).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Bogota",
                        })}
                      </p>
                      <p>
                        Antes: {antes.categoria ? CATEGORIA_LABEL[antes.categoria] : "—"} ·{" "}
                        {typeof antes.monto === "number" ? <Dinero valor={antes.monto} /> : "—"} · {antes.fecha ?? "—"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {gasto.comprobanteUrl && (
              <a
                href={gasto.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 text-sm font-medium active:bg-stone-100"
              >
                <ExternalLink className="size-4" aria-hidden /> Ver recibo
              </a>
            )}
            {!gasto.anulado && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setModo("editar")}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300/70 text-sm font-medium active:bg-stone-100 disabled:opacity-50"
                >
                  <Pencil className="size-4" aria-hidden /> Editar
                </button>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setModo("anular")}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-brick-300 text-sm font-medium text-brick-700 active:bg-brick-50 disabled:opacity-50"
                >
                  <Ban className="size-4" aria-hidden /> Anular
                </button>
              </div>
            )}
            {!online && !gasto.anulado && (
              <p className="text-center text-[12px] text-stone-500">Editar y anular requieren conexión.</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
