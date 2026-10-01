"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Check, MessageCircle, Wrench } from "lucide-react";
import { cambiarEstadoCita, marcarRecordatorio } from "@/app/(app)/agenda/actions";
import { FormularioCita } from "@/components/agenda/formulario-cita";
import { TIPO_CITA_LABEL } from "@/lib/agenda";
import type { CitaVista } from "@/lib/datos/agenda";

/**
 * Una cita de la agenda: hora, vehículo y cliente, con sus acciones. «Recordar» abre WhatsApp con el
 * mensaje ya redactado y anota que se avisó; «Recibir» abre una orden nueva con ese vehículo ya elegido
 * y la cita se cierra sola cuando la orden se guarda (no antes).
 */
export function TarjetaCita({ cita, atrasada = false }: { cita: CitaVista; atrasada?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const cerrar = useCallback(() => setEditando(false), []);

  function cancelar() {
    if (!window.confirm(`¿Cancelar la cita de ${cita.placa}?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoCita({ id: cita.id, estado: "cancelada" });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <li className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[22px] leading-none font-medium tracking-tight tabular-nums">
            <CalendarClock className={`size-[18px] ${atrasada ? "text-brick-600" : "text-stone-400"}`} strokeWidth={1.75} aria-hidden />
            {cita.horaTexto}
          </p>
          {atrasada && <p className="mt-1 text-[12px] font-medium text-brick-700">{cita.fecha.split("-").reverse().join("/")} · sin atender</p>}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            cita.tipo === "mantenimiento" ? "bg-sage-50 text-sage-800" : "bg-stone-100 text-stone-700"
          }`}
        >
          {cita.tipo === "mantenimiento" && <Wrench className="size-3" aria-hidden />}
          {TIPO_CITA_LABEL[cita.tipo]}
        </span>
      </div>

      <div>
        <p className="flex items-center gap-2">
          <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2 py-0.5 font-mono text-[14px] font-semibold tracking-wider">
            {cita.placa}
          </span>
          <span className="truncate text-[14px] text-stone-600">{cita.vehiculo}</span>
        </p>
        <p className="mt-1 font-medium">{cita.cliente}</p>
        {cita.notas && <p className="mt-1 text-[13px] text-stone-500">{cita.notas}</p>}
      </div>

      <div className="flex gap-2">
        {cita.whatsappHref && (
          <a
            href={cita.whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => void marcarRecordatorio({ id: cita.id })}
            title={cita.recordadoAt ? "Ya se le recordó; toca para enviarlo otra vez" : "Recordar por WhatsApp"}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sage-700 text-sm font-medium text-white active:bg-sage-800"
          >
            {cita.recordadoAt ? <Check className="size-4" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
            {cita.recordadoAt ? "Recordado" : "Recordar"}
          </a>
        )}
        <Link
          href={`/ordenes/nueva?vehiculo=${cita.vehiculoId}&cita=${cita.id}`}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white active:opacity-90"
        >
          Recibir vehículo
        </Link>
      </div>

      <div className="flex items-center justify-between text-[13px]">
        <button type="button" onClick={() => setEditando(true)} className="min-h-10 px-1 font-medium text-stone-600 underline underline-offset-2">
          {atrasada ? "Reprogramar" : "Cambiar día u hora"}
        </button>
        <Link href={`/vehiculos/${cita.vehiculoId}`} className="flex min-h-10 items-center px-1 font-medium text-stone-600 underline underline-offset-2">
          Datos del vehículo
        </Link>
        <button type="button" onClick={cancelar} disabled={pendiente} className="min-h-10 px-1 font-medium text-brick-700 disabled:opacity-60">
          Cancelar cita
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          {error}
        </p>
      )}

      {editando && (
        <FormularioCita
          onClose={cerrar}
          cita={{
            id: cita.id,
            fecha: cita.fecha,
            hora: cita.hora,
            tipo: cita.tipo,
            notas: cita.notas,
            vehiculoTexto: `${cita.placa} · ${cita.vehiculo} · ${cita.cliente}`,
          }}
        />
      )}
    </li>
  );
}
