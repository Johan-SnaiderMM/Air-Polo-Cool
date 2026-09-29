"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { registrarGasto } from "@/app/(app)/caja-menor/actions";
import { CATEGORIA_ICONO } from "@/components/caja/categoria-icono";
import { CATEGORIAS, CATEGORIA_LABEL } from "@/lib/caja";
import { comprimirImagen } from "@/lib/imagen";
import { formatearMoneda } from "@/lib/ordenes";
import type { CategoriaGasto } from "@/types/database";

type Mensaje = { ok: boolean; texto: string };

const MAX_DIGITOS = 10; // numeric(12,2) admite hasta 9 999 999 999
const miles = new Intl.NumberFormat("es-CO");

/**
 * Registro express de gasto, pensado para caber en una sola pantalla móvil:
 * monto (display tipo POS) → categoría (cuadrícula compacta) → nota + recibo → registrar.
 */
export function GastoForm() {
  const inputFoto = useRef<HTMLInputElement>(null);
  const [digitos, setDigitos] = useState(""); // solo dígitos: el formato se aplica al mostrar
  const [categoria, setCategoria] = useState<CategoriaGasto | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [pendiente, iniciar] = useTransition();

  const valor = Number(digitos || "0");
  const listo = valor > 0 && categoria !== null;

  function alCambiarMonto(e: React.ChangeEvent<HTMLInputElement>) {
    const limpio = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS);
    setDigitos(limpio);
  }

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
        datos.set("monto", digitos);
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
          setDigitos("");
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
      className="space-y-3.5 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft"
    >
      {/* 1) Monto: display financiero (símbolo integrado, cifras tabulares) */}
      <div>
        <label
          htmlFor="monto"
          className="mb-1.5 block text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase"
        >
          Monto
        </label>
        <div className="flex items-baseline gap-3 rounded-xl border border-stone-200/80 bg-stone-50/70 px-4 py-3 transition-colors focus-within:border-stone-400 focus-within:bg-white">
          <span className="font-mono text-2xl text-stone-400" aria-hidden>
            $
          </span>
          <input
            id="monto"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={digitos ? miles.format(Number(digitos)) : ""}
            onChange={alCambiarMonto}
            className="w-full min-w-0 bg-transparent text-right font-mono text-4xl leading-none tracking-tight tabular-nums outline-none placeholder:text-stone-300"
          />
        </div>
      </div>

      {/* 2) Categoría: 3 columnas compactas (icono + nombre) */}
      <fieldset>
        <legend className="sr-only">Categoría</legend>
        <div className="grid grid-cols-6 gap-2">
          {CATEGORIAS.map((c, i) => {
            const Icono = CATEGORIA_ICONO[c];
            const activa = categoria === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                aria-pressed={activa}
                className={`flex h-[60px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] text-[12px] transition-colors ${
                  i < 3 ? "col-span-2" : "col-span-3"
                } ${
                  activa
                    ? "border-ink bg-stone-100 font-medium text-ink"
                    : "border-stone-200/80 bg-white text-stone-500 active:bg-stone-50"
                }`}
              >
                <Icono className="size-[18px]" strokeWidth={1.5} aria-hidden />
                {CATEGORIA_LABEL[c]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Nota (baja fricción) + recibo, en una sola fila */}
      <div className="flex items-stretch gap-2">
        <input
          id="descripcion"
          aria-label="Nota (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={300}
          placeholder="Nota (opcional)"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none placeholder:text-stone-400 focus:border-stone-400"
        />

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
            <img
              src={previa}
              alt="Recibo adjunto"
              className="size-12 rounded-xl border border-stone-200/80 object-cover"
            />
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
      </div>

      {/* 3) Registrar: azul de marca; deshabilitado = gris plano (no "pastel") */}
      <button
        type="submit"
        disabled={!listo || pendiente}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 text-base font-medium text-white transition-colors hover:bg-accent-700 active:bg-accent-700 disabled:bg-stone-200 disabled:text-stone-400"
      >
        {pendiente && <Loader2 className="size-5 animate-spin" aria-hidden />}
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
