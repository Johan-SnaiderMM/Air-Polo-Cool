"use client";

import { useRef, useState } from "react";
import {
  Camera,
  FileText,
  Snowflake,
  PackageCheck,
  PackageX,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { useSync } from "@/components/sync/sync-provider";
import { nuevoId } from "@/lib/offline/operaciones";
import { comprimirImagen } from "@/lib/imagen";
import { TIPO_EVIDENCIA_LABEL } from "@/lib/ordenes";
import type { TipoEvidencia } from "@/types/database";

// Botones neutros: el tipo de foto se distingue por icono y etiqueta, no por color.
const BOTONES: { tipo: TipoEvidencia; icono: LucideIcon }[] = [
  { tipo: "ingreso", icono: Camera },
  { tipo: "repuesto_viejo", icono: PackageX },
  { tipo: "repuesto_nuevo", icono: PackageCheck },
  { tipo: "prueba_tecnica", icono: Thermometer },
  { tipo: "factura_compra", icono: FileText },
];

type Mensaje = { tipo: "ok" | "error"; texto: string };

export type RepuestoFoto = { id: string; nombre: string };

const ES_DE_REPUESTO: TipoEvidencia[] = ["repuesto_viejo", "repuesto_nuevo"];
const SIN_REPUESTO = "ninguno";

export function CapturaFotos({ ordenId, repuestos }: { ordenId: string; repuestos: RepuestoFoto[] }) {
  const { registrar } = useSync();
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoActivo = useRef<TipoEvidencia>("ingreso");
  const [subiendo, setSubiendo] = useState<TipoEvidencia | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  // "" = aún no elige; SIN_REPUESTO = foto de algo que no está en la lista.
  const [repuestoId, setRepuestoId] = useState("");
  const elegido = repuestos.find((r) => r.id === repuestoId);

  function abrirCamara(tipo: TipoEvidencia) {
    if (subiendo) return;
    if (ES_DE_REPUESTO.includes(tipo) && repuestos.length > 0 && repuestoId === "") {
      setMensaje({ tipo: "error", texto: "Primero elige de qué repuesto es la foto." });
      return;
    }
    setMensaje(null);
    tipoActivo.current = tipo;
    inputRef.current?.click();
  }

  async function alSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir la misma foto
    if (!archivo) return;

    const tipo = tipoActivo.current;
    setSubiendo(tipo);
    setMensaje(null);

    try {
      const { blob, extension } = await comprimirImagen(archivo);
      // Va por la cola de sincronización: sin red se guarda en el teléfono y sube después.
      const r = await registrar(
        {
          tipo: "evidencia.subir",
          conArchivo: true,
          datos: {
            id: nuevoId(),
            orden_id: ordenId,
            tipo,
            extension,
            notas: null,
            orden_repuesto_id: ES_DE_REPUESTO.includes(tipo) && elegido ? elegido.id : null,
          },
        },
        blob
      );
      if (r.estado === "error") {
        setMensaje({ tipo: "error", texto: r.error });
      } else {
        setMensaje({
          tipo: "ok",
          texto:
            r.estado === "sincronizado"
              ? `${TIPO_EVIDENCIA_LABEL[tipo]}${elegido && ES_DE_REPUESTO.includes(tipo) ? ` · ${elegido.nombre}` : ""} guardada (${Math.round(blob.size / 1024)} KB).`
              : `${TIPO_EVIDENCIA_LABEL[tipo]} guardada en el teléfono; se subirá al volver la conexión.`,
        });
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo procesar la foto.",
      });
    } finally {
      setSubiendo(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Un solo input nativo: abre directamente la cámara trasera del celular. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={alSeleccionar}
        className="hidden"
      />

      {repuestos.length > 0 && (
        <label className="block space-y-1.5">
          <span className="text-[13px] text-stone-500">Repuesto de las fotos «retirado» e «instalado»</span>
          <select
            value={repuestoId}
            onChange={(e) => setRepuestoId(e.target.value)}
            className="h-12 w-full rounded-xl border border-stone-300/70 bg-white px-3 text-[15px] outline-none focus:border-stone-400"
          >
            <option value="">— Elige el repuesto —</option>
            {repuestos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
            <option value={SIN_REPUESTO}>Otro (no está en la lista)</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        {BOTONES.map(({ tipo, icono: Icono }, i) => {
          const activo = subiendo === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => abrirCamara(tipo)}
              disabled={subiendo !== null}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/70 bg-white px-3 py-3 text-center text-sm font-medium text-ink shadow-soft transition-colors active:bg-stone-50 disabled:opacity-50 ${
                i === BOTONES.length - 1 ? "col-span-2 min-h-16 flex-row gap-3" : ""
              }`}
            >
              {activo ? (
                <Snowflake className="size-6 animate-copo text-stone-500" aria-hidden />
              ) : (
                <Icono className="size-6 text-stone-500" strokeWidth={1.5} aria-hidden />
              )}
              {activo ? "Subiendo…" : TIPO_EVIDENCIA_LABEL[tipo]}
            </button>
          );
        })}
      </div>

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === "error"
              ? "bg-brick-50 text-brick-700"
              : "bg-sage-50 text-sage-800"
          }`}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
