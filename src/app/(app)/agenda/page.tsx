import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { BotonAgendar } from "@/components/agenda/boton-agendar";
import { PorProgramar } from "@/components/agenda/por-programar";
import { TarjetaCita } from "@/components/agenda/tarjeta-cita";
import { diaLegible } from "@/lib/agenda";
import { cargarAgenda } from "@/lib/datos/agenda";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

function Titulo({ children, cuenta }: { children: React.ReactNode; cuenta?: number }) {
  return (
    <h3 className="mb-2.5 flex items-center justify-between px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
      <span>{children}</span>
      {cuenta !== undefined && <span className="font-mono tracking-normal tabular-nums">{cuenta}</span>}
    </h3>
  );
}

export default async function AgendaPage() {
  const { atrasadas, dias, porProgramar, total, error } = await cargarAgenda(await createClient());

  return (
    <section className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-stone-500">
            {total === 0 ? "Nada agendado" : `${total} ${total === 1 ? "cita pendiente" : "citas pendientes"}`}
          </p>
          <h2 className="font-serif text-[32px] leading-tight font-medium tracking-tight">Agenda</h2>
        </div>
        <BotonAgendar />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudo cargar la agenda: {error}
        </p>
      )}

      {atrasadas.length > 0 && (
        <div>
          <Titulo cuenta={atrasadas.length}>Sin atender</Titulo>
          <p className="mb-3 text-[13px] text-stone-500">
            Citas de días anteriores que nadie marcó. Recibe el vehículo, reprograma o cancela.
          </p>
          <ul className="space-y-3">
            {atrasadas.map((c) => (
              <TarjetaCita key={c.id} cita={c} atrasada />
            ))}
          </ul>
        </div>
      )}

      {dias.map((d) => (
        <div key={d.fecha}>
          <Titulo cuenta={d.citas.length}>
            {d.etiqueta}
            {d.etiqueta === "Hoy" || d.etiqueta === "Mañana" ? ` · ${diaLegible(d.fecha)}` : ""}
          </Titulo>
          <ul className="space-y-3">
            {d.citas.map((c) => (
              <TarjetaCita key={c.id} cita={c} />
            ))}
          </ul>
        </div>
      ))}

      {!error && atrasadas.length === 0 && dias.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
          <CalendarDays className="mx-auto mb-2 size-7 text-stone-400" strokeWidth={1.5} aria-hidden />
          <p>No hay citas pendientes.</p>
          <p className="mt-1 text-[13px]">Toca «Agendar» para anotar quién viene y a qué hora.</p>
        </div>
      )}

      {porProgramar.length > 0 && (
        <div>
          <Titulo cuenta={porProgramar.length}>Mantenimientos por programar</Titulo>
          <p className="mb-3 text-[13px] text-stone-500">
            Vehículos a los que ya les toca su revisión preventiva y aún no tienen cita.
          </p>
          <PorProgramar filas={porProgramar} />
        </div>
      )}
    </section>
  );
}
