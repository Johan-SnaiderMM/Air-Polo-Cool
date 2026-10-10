"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Lock, Plus, Snowflake, Trash2 } from "lucide-react";
import { eliminarRepuesto } from "@/app/(app)/ordenes/repuestos-actions";
import { useSync } from "@/components/sync/sync-provider";
import { Dinero } from "@/components/ui/dinero";
import { useConfirmar } from "@/components/ui/confirmar";
import { PosMonto } from "@/components/ui/pos-monto";
import { CARGOS_SUGERIDOS, validarCargo } from "@/lib/cargo-orden";
import { redondearDinero } from "@/lib/inventario";
import { nuevoId } from "@/lib/offline/operaciones";
import { formatearMoneda } from "@/lib/ordenes";

export type LineaCargo = {
  id: string;
  nombre: string;
  /** Lo que se le cobra al cliente. */
  precio: number;
  /** Lo que costó (interno; el cliente no lo ve). */
  costo: number;
};

type Props = {
  ordenId: string;
  cargos: LineaCargo[];
  /** Orden entregada/cancelada: la base rechaza cambios. */
  bloqueada: boolean;
  puedeEliminar: boolean;
};

/**
 * «Otros cargos»: gasolina, flete, parqueadero… Gastos hechos por el trabajo que se le COBRAN al cliente y no son
 * repuestos ni mano de obra. El cobro se suma al total y al saldo por cobrar (sin tocar el total a mano) y el cliente
 * los ve en su enlace; lo que costó baja el margen. Funciona sin conexión (misma cola que las fotos y los pagos).
 */
export function CargosOrden({ ordenId, cargos, bloqueada, puedeEliminar }: Props) {
  const router = useRouter();
  const { registrar } = useSync();
  const confirmar = useConfirmar();
  const [nombre, setNombre] = useState("");
  const [digitosCosto, setDigitosCosto] = useState("");
  // null = no lo tocó: se cobra lo que costó. Una vez tocado, vacío significa 0.
  const [digitosPrecio, setDigitosPrecio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tipo: "ok" | "cola" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const costo = Number(digitosCosto || "0");
  const precio = digitosPrecio === null ? costo : Number(digitosPrecio || "0");
  const total = redondearDinero(cargos.reduce((s, c) => s + c.precio, 0));

  function agregar() {
    const r = validarCargo({ nombre, costo, precio: digitosPrecio === null ? null : precio });
    if (!r.ok) return setResultado({ tipo: "error", texto: r.error });
    setResultado(null);
    iniciar(async () => {
      const res = await registrar(
        {
          tipo: "repuesto.externo",
          datos: { id: nuevoId(), orden_id: ordenId, tipo: "cargo", nombre: r.valor.nombre, costo: r.valor.costo, precio: r.valor.precio },
        },
        null
      );
      if (res.estado === "error") return setResultado({ tipo: "error", texto: res.error });
      setResultado({
        tipo: res.estado === "sincronizado" ? "ok" : "cola",
        texto:
          res.estado === "sincronizado"
            ? `«${r.valor.nombre}» agregado: se le cobran ${formatearMoneda(r.valor.precio)} al cliente.`
            : `«${r.valor.nombre}» guardado en el teléfono; se subirá al volver la conexión.`,
      });
      setNombre("");
      setDigitosCosto("");
      setDigitosPrecio(null);
      router.refresh();
    });
  }

  async function quitar(c: LineaCargo) {
    const seguro = await confirmar({
      titulo: `¿Quitar «${c.nombre}» de la orden?`,
      mensaje: "Deja de cobrarse al cliente y de contar en el margen. El total se ajusta si estaba al día.",
      confirmar: "Quitar",
      tono: "peligro",
    });
    if (!seguro) return;
    iniciar(async () => {
      const r = await eliminarRepuesto({ ordenId, lineaId: c.id });
      if (!r.ok) setResultado({ tipo: "error", texto: r.error });
      else router.refresh();
    });
  }

  const campo = "h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400";

  return (
    <div className="space-y-4">
      {cargos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300/70 bg-white p-5 text-center text-sm text-stone-500">
          Sin otros cargos. Aquí va lo que se gasta por el trabajo y se le cobra al cliente (gasolina, flete,
          parqueadero…).
        </p>
      ) : (
        <ul className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
          {cargos.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.nombre}</p>
                {c.costo > 0 && <p className="text-[12px] text-stone-500">Costó {formatearMoneda(c.costo)}</p>}
              </div>
              <p className="shrink-0 font-semibold">
                <Dinero valor={c.precio} />
              </p>
              {puedeEliminar && !bloqueada && (
                <button
                  type="button"
                  onClick={() => void quitar(c)}
                  disabled={pendiente}
                  aria-label={`Quitar ${c.nombre}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-brick-700 active:bg-brick-50 disabled:opacity-50"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between bg-stone-50 px-4 py-3 font-semibold">
            <span>Total otros cargos</span>
            <span>
              <Dinero valor={total} />
            </span>
          </li>
        </ul>
      )}

      {bloqueada ? (
        <p className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
          <Lock className="size-4 shrink-0" aria-hidden />
          La orden está cerrada: no admite cargos nuevos.
        </p>
      ) : (
        <div className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cargos frecuentes">
            {CARGOS_SUGERIDOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNombre(s)}
                aria-pressed={nombre === s}
                className={`h-10 rounded-full border px-4 text-[13px] font-medium transition-colors ${
                  nombre === s ? "border-ink bg-ink text-white" : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[13px] text-stone-600">¿De qué es el cargo?</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              autoComplete="off"
              placeholder="Ej: Gasolina para la prueba en ruta"
              className={campo}
            />
          </label>

          <PosMonto id="cargo-costo" etiqueta="¿Cuánto gastaste? (opcional)" digitos={digitosCosto} onChange={setDigitosCosto} tamano="normal" />
          <PosMonto
            id="cargo-precio"
            etiqueta="¿Cuánto se le cobra al cliente?"
            digitos={digitosPrecio ?? digitosCosto}
            onChange={setDigitosPrecio}
            tamano="normal"
          />
          <p className="text-[12px] text-stone-500">
            {precio > 0 && precio < costo
              ? "Estás cobrando menos de lo que gastaste: Polo pierde la diferencia."
              : "Por defecto se cobra lo que gastaste; súbelo si quieres ganarle. El cliente no ve lo que gastaste."}
          </p>

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
              {resultado.tipo === "cola" && <CloudUpload className="size-4 shrink-0" aria-hidden />}
              {resultado.texto}
            </p>
          )}

          <button
            type="button"
            onClick={agregar}
            disabled={pendiente}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white active:bg-ink-soft disabled:opacity-60"
          >
            {pendiente ? <Snowflake className="size-5 animate-copo" aria-hidden /> : <Plus className="size-5" aria-hidden />}
            {pendiente ? "Agregando…" : "Agregar cargo a la orden"}
          </button>
        </div>
      )}
    </div>
  );
}
