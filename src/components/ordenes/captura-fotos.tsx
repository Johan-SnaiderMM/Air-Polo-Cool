"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Loader2,
  PackageCheck,
  PackageX,
  Thermometer,
  type LucideIcon,
} from "lucide-react";
import { subirEvidencia } from "@/app/(app)/ordenes/actions";
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

export function CapturaFotos({ ordenId }: { ordenId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoActivo = useRef<TipoEvidencia>("ingreso");
  const [subiendo, setSubiendo] = useState<TipoEvidencia | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  function abrirCamara(tipo: TipoEvidencia) {
    if (subiendo) return;
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
      const datos = new FormData();
      datos.set("orden_id", ordenId);
      datos.set("tipo", tipo);
      datos.set(
        "archivo",
        new File([blob], `foto.${extension}`, { type: blob.type })
      );

      const resultado = await subirEvidencia(datos);
      if (resultado.ok) {
        setMensaje({
          tipo: "ok",
          texto: `${TIPO_EVIDENCIA_LABEL[tipo]} guardada (${Math.round(blob.size / 1024)} KB).`,
        });
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: resultado.error });
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
                <Loader2 className="size-6 animate-spin text-stone-500" aria-hidden />
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
