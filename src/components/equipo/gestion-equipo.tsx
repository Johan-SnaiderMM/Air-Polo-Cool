"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, UserCheck, UserPlus, UserX } from "lucide-react";
import { cambiarEstadoAyudante, crearAyudante, restablecerContrasenaAyudante } from "@/app/(app)/equipo/actions";
import { instruccionesDeIngreso } from "@/lib/equipo";
import type { MiembroEquipo } from "@/lib/datos/equipo";

type Credenciales = { nombre: string; correo: string; contrasena: string };

const ETIQUETA_ROL = (m: MiembroEquipo) => (m.esSoporte ? "Soporte" : m.rol === "admin" ? "Dueño" : "Ayudante");

/** Lo que se le entrega a la persona: se ve UNA vez (la contraseña no se guarda en ningún lado legible). */
function TarjetaCredenciales({ datos, onCerrar }: { datos: Credenciales; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = instruccionesDeIngreso({ url: typeof window === "undefined" ? "" : window.location.origin, correo: datos.correo, contrasena: datos.contrasena });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section role="status" className="space-y-3 rounded-2xl border border-sage-300 bg-sage-50 p-4">
      <p className="text-[15px] font-medium text-sage-800">Acceso de {datos.nombre}</p>
      <dl className="space-y-1 text-[14px] text-stone-700">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-stone-500">Correo</dt>
          <dd className="min-w-0 break-all">{datos.correo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-stone-500">Contraseña</dt>
          <dd className="font-mono text-[15px] font-semibold tracking-wide select-all">{datos.contrasena}</dd>
        </div>
      </dl>
      <p className="text-[13px] text-stone-600">
        Cópiala y envíasela ahora: no se vuelve a mostrar. Si se pierde, genera una nueva. Debe cambiarla en «Mi cuenta».
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copiar}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[14px] font-semibold text-white active:opacity-90"
        >
          {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copiado ? "Copiado" : "Copiar instrucciones"}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-[14px] font-medium text-stone-700 active:bg-stone-100"
        >
          Listo
        </button>
      </div>
    </section>
  );
}

function FormularioNuevo({ onCreado }: { onCreado: (c: Credenciales) => void }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearAyudante({ nombre, correo });
      if (!r.ok) return setError(r.error);
      onCreado({ nombre: nombre.trim(), correo: r.correo, contrasena: r.contrasena });
      setNombre("");
      setCorreo("");
    });
  }

  const campo = "h-12 w-full rounded-xl border border-stone-200/80 bg-white px-4 text-[15px] outline-none focus:border-stone-400";
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
      <p className="flex items-center gap-2 text-[15px] font-medium">
        <UserPlus className="size-5 text-stone-500" aria-hidden />
        Agregar un ayudante
      </p>
      <label className="block space-y-1">
        <span className="text-[13px] text-stone-600">Nombre (el que quedará en cada registro)</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} autoComplete="off" required placeholder="Ej: Carlos Pérez" className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-[13px] text-stone-600">Correo para entrar</span>
        <input type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={120} autoComplete="off" required placeholder="ayudante@correo.com" className={campo} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-brick-50 px-4 py-3 text-sm text-brick-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={trabajando}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-60"
      >
        {trabajando ? "Creando…" : "Crear acceso"}
      </button>
    </form>
  );
}

function FilaMiembro({ m, onCredenciales }: { m: MiembroEquipo; onCredenciales: (c: Credenciales) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();
  const gestionable = m.rol === "operario" && !m.esSoporte;

  function cambiarEstado() {
    const activo = !m.activo;
    if (!activo && !window.confirm(`${m.nombre} dejará de poder entrar. Su historial se conserva. ¿Desactivar?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoAyudante({ id: m.id, activo });
      if (!r.ok) setError(r.error);
    });
  }

  function nuevaContrasena() {
    if (!window.confirm(`Se generará una contraseña nueva para ${m.nombre} y la anterior dejará de servir. ¿Continuar?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await restablecerContrasenaAyudante({ id: m.id });
      if (!r.ok) return setError(r.error);
      onCredenciales({ nombre: m.nombre, correo: r.correo, contrasena: r.contrasena });
    });
  }

  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-medium">{m.nombre}</p>
          {m.correo && <p className="truncate text-[13px] text-stone-500">{m.correo}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-medium text-stone-600">{ETIQUETA_ROL(m)}</span>
          {!m.activo && <span className="rounded-full bg-brick-50 px-2.5 py-1 text-[12px] font-medium text-brick-700">Desactivado</span>}
        </div>
      </div>
      {gestionable && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={nuevaContrasena}
            disabled={trabajando || !m.activo}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-[13px] font-medium text-stone-700 active:bg-stone-100 disabled:opacity-50"
          >
            <KeyRound className="size-4" aria-hidden />
            Nueva contraseña
          </button>
          <button
            type="button"
            onClick={cambiarEstado}
            disabled={trabajando}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-[13px] font-medium disabled:opacity-50 ${m.activo ? "border-brick-300 bg-white text-brick-700 active:bg-brick-50" : "border-sage-300 bg-white text-sage-800 active:bg-sage-50"}`}
          >
            {m.activo ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
            {m.activo ? "Desactivar" : "Reactivar"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-brick-50 px-3 py-2 text-[13px] text-brick-700">
          {error}
        </p>
      )}
    </li>
  );
}

export function GestionEquipo({ miembros }: { miembros: MiembroEquipo[] }) {
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);

  return (
    <div className="space-y-5">
      {credenciales && <TarjetaCredenciales datos={credenciales} onCerrar={() => setCredenciales(null)} />}
      <FormularioNuevo onCreado={setCredenciales} />
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
        {miembros.map((m) => (
          <FilaMiembro key={m.id} m={m} onCredenciales={setCredenciales} />
        ))}
        {miembros.length === 0 && <li className="p-6 text-center text-[14px] text-stone-500">Todavía no hay perfiles.</li>}
      </ul>
    </div>
  );
}
