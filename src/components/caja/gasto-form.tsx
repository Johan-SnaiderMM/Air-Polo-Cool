"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Loader2, Save, X } from "lucide-react";
import { registrarGasto } from "@/app/(app)/caja-menor/actions";
import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { CATEGORIAS, CATEGORIA_AYUDA, CATEGORIA_LABEL } from "@/lib/caja";
import { comprimirImagen } from "@/lib/imagen";
import { formatearMoneda } from "@/lib/ordenes";
import type { CategoriaGasto } from "@/types/database";

type Mensaje = { ok: boolean; texto: string };

export function GastoForm() {
  const inputFoto = useRef<HTMLInputElement>(null);
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [pendiente, iniciar] = useTransition();

  const valor = Number(monto);
  const listo = Number.isFinite(valor) && valor > 0 && categoria !== null;

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

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || categoria === null) return;
    setMensaje(null);

    iniciar(async () => {
      try {
        const datos = new FormData();
        datos.set("monto", monto);
        datos.set("categoria", categoria);
        datos.set("descripcion", descripcion);

        if (foto) {
          // Compresión en el navegador antes de subir (máx. 1280 px, ~300 KB).
          const { blob, extension } = await comprimirImagen(foto);
          datos.set(
            "comprobante",
            new File([blob], `recibo.${extension}`, { type: blob.type })
          );
        }

        const r = await registrarGasto(datos);
        if (r.ok) {
          setMensaje({ ok: true, texto: `Gasto de ${formatearMoneda(valor)} registrado.` });
          setMonto("");
          setCategoria(null);
          setDescripcion("");
          quitarFoto();
        } else {
          setMensaje({ ok: false, texto: r.error });
        }
      } catch (err) {
        setMensaje({
          ok: false,
          texto: err instanceof Error ? err.message : "No se pudo registrar el gasto.",
        });
      }
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft"
    >
      {/* 1) Monto */}
      <div>
        <label htmlFor="monto" className="mb-1 block text-sm font-medium">
          Monto ($)
        </label>
        <input
          id="monto"
          type="number"
          inputMode="numeric"
          min={0}
          step="any"
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="h-20 w-full rounded-xl border-2 border-stone-300/70 bg-white px-4 text-center text-4xl font-semibold outline-none focus:border-stone-500"
        />
      </div>

      {/* 2) Categoría */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Categoría</legend>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIAS.map((c, i) => {
            const Icono = CATEGORIA_ICONO[c];
            const activa = categoria === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                aria-pressed={activa}
                className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center transition-colors ${
                  i === CATEGORIAS.length - 1 ? "col-span-2 min-h-16" : ""
                } ${
                  activa
                    ? "border-ink bg-ink text-white"
                    : "border-stone-300/70 bg-white text-stone-700 active:bg-stone-100"
                }`}
              >
                <Icono className="size-6" aria-hidden />
                <span className="text-sm font-semibold">{CATEGORIA_LABEL[c]}</span>
                <span
                  className={`text-xs ${activa ? "text-stone-300" : "text-stone-500"}`}
                >
                  {CATEGORIA_AYUDA[c]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Opcionales */}
      <div>
        <label htmlFor="descripcion" className="mb-1 block text-sm font-medium">
          Nota <span className="font-normal text-stone-500">(opcional)</span>
        </label>
        <input
          id="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={300}
          placeholder="Ej: almuerzo de 2 ayudantes"
          autoComplete="off"
          className="h-14 w-full rounded-xl border border-stone-300/70 bg-white px-4 text-base outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
        />
      </div>

      <div>
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={alElegirFoto}
          className="hidden"
        />
        {previa ? (
          <div className="flex items-center gap-3 rounded-xl border border-stone-200/70 p-2">
            {/* Vista previa local (blob:): next/image no aplica. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previa} alt="Recibo adjunto" className="size-16 rounded-lg object-cover" />
            <p className="flex-1 text-sm text-stone-600">Recibo adjunto</p>
            <button
              type="button"
              onClick={quitarFoto}
              aria-label="Quitar foto"
              className="flex size-11 items-center justify-center rounded-full active:bg-stone-100"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputFoto.current?.click()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300/70 text-base font-semibold text-stone-700 active:bg-stone-100"
          >
            <Camera className="size-5" aria-hidden />
            Foto del recibo
          </button>
        )}
      </div>

      {/* 3) Guardar */}
      <button
        type="submit"
        disabled={!listo || pendiente}
        className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white transition-colors active:bg-accent-700 disabled:opacity-50"
      >
        {pendiente ? (
          <Loader2 className="size-6 animate-spin" aria-hidden />
        ) : (
          <Save className="size-6" aria-hidden />
        )}
        {pendiente ? "Guardando…" : "Registrar gasto"}
      </button>

      {mensaje && (
        <p
          role={mensaje.ok ? "status" : "alert"}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            mensaje.ok ? "bg-sage-50 text-sage-800" : "bg-brick-50 text-brick-700"
          }`}
        >
          {mensaje.ok && <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
          {mensaje.texto}
        </p>
      )}
    </form>
  );
}
