"use client";

import { useState, useTransition } from "react";
import { cambiarMiContrasena } from "@/app/(app)/cuenta/actions";
import { CONTRASENA_MIN } from "@/lib/equipo";

export function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [trabajando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setListo(false);
    if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden.");
    iniciar(async () => {
      const r = await cambiarMiContrasena({ actual, nueva });
      if (!r.ok) return setError(r.error);
      setListo(true);
      setActual("");
      setNueva("");
      setRepetida("");
    });
  }

  const campo = "h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400";
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
      <p className="text-[15px] font-medium">Cambiar mi contraseña</p>
      <label className="block space-y-1">
        <span className="text-[13px] text-stone-600">Contraseña actual</span>
        <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-[13px] text-stone-600">Contraseña nueva (mínimo {CONTRASENA_MIN}, con letras y números)</span>
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={CONTRASENA_MIN} required className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-[13px] text-stone-600">Repite la contraseña nueva</span>
        <input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required className={campo} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
          {error}
        </p>
      )}
      {listo && (
        <p role="status" className="rounded-xl bg-sage-50 px-4 py-3 text-sm text-sage-800">
          Contraseña cambiada.
        </p>
      )}
      <button
        type="submit"
        disabled={trabajando}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-60"
      >
        {trabajando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
