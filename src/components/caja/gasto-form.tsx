"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, CloudUpload, Snowflake, Undo2, X } from "lucide-react";
import { anularGasto } from "@/app/(app)/caja-menor/actions";
import { CamposGasto, montoDe, useValoresGasto, valoresGastoVacios } from "@/components/caja/campos-gasto";
import { PlantillasRapidas } from "@/components/caja/plantillas-rapidas";
import { useAutor } from "@/components/sync/autor-provider";
import { useSync, type ResultadoRegistro } from "@/components/sync/sync-provider";
import { CATEGORIA_LABEL, hoyBogota } from "@/lib/caja";
import { comprimirImagen } from "@/lib/imagen";
import { nuevoId, type Operacion } from "@/lib/offline/operaciones";
import type { PlantillaGasto } from "@/lib/plantillas-gasto";
import { formatearMoneda } from "@/lib/ordenes";
import type { Autor } from "@/types/database";

type Mensaje =
  | { tipo: "ok"; texto: string; deshacer?: { id: string; autor: Autor } }
  | { tipo: "cola"; texto: string }
  | { tipo: "error"; texto: string };

function textoResultado(r: ResultadoRegistro, monto: number): Mensaje | null {
  if (r.estado === "sincronizado") return { tipo: "ok", texto: `Gasto de ${formatearMoneda(monto)} registrado.` };
  if (r.estado === "en_cola") {
    return {
      tipo: "cola",
      texto: `Gasto de ${formatearMoneda(monto)} guardado en el teléfono. Se subirá solo al volver la conexión.`,
    };
  }
  return { tipo: "error", texto: r.error };
}

/**
 * Registro express de gasto (funciona sin conexión):
 * monto POS → categoría → (fecha / orden / nota / recibo opcionales) → registrar.
 * Los "Rápidos" registran un gasto rutinario con UN toque, con opción de deshacer.
 */
export function GastoForm() {
  const { registrar } = useSync();
  const { autor } = useAutor();
  const inputFoto = useRef<HTMLInputElement>(null);

  const { valores, cambiar, reiniciar } = useValoresGasto(valoresGastoVacios);
  const { categoria, descripcion, fecha, orden } = valores;
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [pendiente, iniciar] = useTransition();

  const monto = montoDe(valores);
  const listo = monto > 0 && categoria !== null;

  function quitarFoto() {
    if (previa) URL.revokeObjectURL(previa);
    setFoto(null);
    setPrevia(null);
  }

  function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (previa) URL.revokeObjectURL(previa);
    setFoto(archivo);
    setPrevia(URL.createObjectURL(archivo));
  }

  function limpiar() {
    reiniciar(valoresGastoVacios());
    quitarFoto();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || categoria === null) return;
    setMensaje(null);

    iniciar(async () => {
      try {
        let blob: Blob | null = null;
        let extension: "webp" | "jpg" | undefined;
        if (foto) {
          // Compresión en el navegador antes de guardar/subir (máx. 1280 px, ~300 KB).
          const c = await comprimirImagen(foto);
          blob = c.blob;
          extension = c.extension;
        }
        const id = nuevoId();
        const op: Operacion = {
          tipo: "gasto.crear",
          conArchivo: blob !== null,
          extension,
          datos: {
            id,
            fecha,
            monto,
            categoria,
            descripcion: descripcion.trim() || null,
            orden_id: orden?.id ?? null,
            autor,
          },
        };
        const r = await registrar(op, blob);
        const m = textoResultado(r, monto);
        if (r.estado !== "error") limpiar();
        setMensaje(m);
      } catch (err) {
        setMensaje({
          tipo: "error",
          texto: err instanceof Error ? err.message : "No se pudo registrar el gasto.",
        });
      }
    });
  }

  /** Plantilla: un toque = gasto registrado (fecha de hoy, autor actual). */
  function usarPlantilla(p: PlantillaGasto) {
    setMensaje(null);
    iniciar(async () => {
      const id = nuevoId();
      const r = await registrar({
        tipo: "gasto.crear",
        datos: {
          id,
          fecha: hoyBogota(),
          monto: p.monto,
          categoria: p.categoria,
          descripcion: p.descripcion,
          orden_id: null,
          autor,
        },
      });
      const m = textoResultado(r, p.monto);
      setMensaje(m && m.tipo === "ok" ? { ...m, deshacer: { id, autor } } : m);
    });
  }

  function deshacer(id: string, autorUndo: Autor) {
    iniciar(async () => {
      const r = await anularGasto({ id, motivo: "Deshecho: toque accidental de plantilla", autor: autorUndo });
      setMensaje(
        r.ok
          ? { tipo: "ok", texto: "Gasto deshecho (queda anulado en el historial)." }
          : { tipo: "error", texto: r.error }
      );
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-3.5 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft"
    >
      <PlantillasRapidas
        onUsar={usarPlantilla}
        deshabilitado={pendiente}
        actual={listo && categoria ? { monto, categoria, descripcion } : null}
      />

      <CamposGasto
        valores={valores}
        onCambio={cambiar}
        idMonto="monto"
        notaEtiqueta="Nota (opcional)"
        accionNota={
          <>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={alElegirFoto}
              className="hidden"
            />
            {previa ? (
              <div className="relative size-12 shrink-0">
                {/* Vista previa local (blob:): next/image no aplica. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previa} alt="Recibo adjunto" className="size-12 rounded-xl border border-stone-200/80 object-cover" />
                <button
                  type="button"
                  onClick={quitarFoto}
                  aria-label="Quitar foto del recibo"
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white"
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-stone-200/80 bg-stone-50 px-4 text-[14px] font-medium text-stone-700 transition-colors active:bg-stone-100"
              >
                <Camera className="size-[18px]" strokeWidth={1.5} aria-hidden />
                Recibo
              </button>
            )}
          </>
        }
      />

      <button
        type="submit"
        disabled={!listo || pendiente}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white transition-colors hover:bg-accent-700 active:bg-accent-700 disabled:bg-stone-200 disabled:text-stone-400"
      >
        {pendiente && <Snowflake className="size-5 animate-copo" aria-hidden />}
        {pendiente ? "Guardando…" : categoria ? `Registrar · ${CATEGORIA_LABEL[categoria]}` : "Registrar gasto"}
      </button>

      {mensaje && (
        <div
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === "error"
              ? "bg-brick-50 text-brick-700"
              : mensaje.tipo === "cola"
                ? "bg-ochre-50 text-ochre-800"
                : "bg-sage-50 text-sage-800"
          }`}
        >
          {mensaje.tipo === "ok" && <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
          {mensaje.tipo === "cola" && <CloudUpload className="size-4 shrink-0" aria-hidden />}
          <span className="flex-1">{mensaje.texto}</span>
          {mensaje.tipo === "ok" && mensaje.deshacer && (
            <button
              type="button"
              onClick={() => mensaje.deshacer && deshacer(mensaje.deshacer.id, mensaje.deshacer.autor)}
              className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium underline underline-offset-2"
            >
              <Undo2 className="size-3.5" aria-hidden /> Deshacer
            </button>
          )}
        </div>
      )}
    </form>
  );
}
