import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GestionEquipo } from "@/components/equipo/gestion-equipo";
import { esUsuarioSoporte } from "@/lib/autor";
import { cargarEquipo } from "@/lib/datos/equipo";
import { obtenerSesion } from "@/utils/supabase/sesion";

export const metadata: Metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const { supabase, user } = await obtenerSesion();
  const esDueno = user?.app_metadata?.rol === "admin";
  const equipo = esDueno && user ? await cargarEquipo(supabase, { verSoporte: esUsuarioSoporte(user) }) : null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/cuenta" aria-label="Volver a mi cuenta" className="flex size-11 items-center justify-center rounded-full active:bg-stone-200">
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Equipo</h2>
      </div>

      {!equipo && (
        <p role="alert" className="rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
          Solo el dueño del taller (administrador) puede gestionar el equipo.
        </p>
      )}

      {equipo?.migracionPendiente && (
        <p role="alert" className="rounded-2xl border border-ochre-300 bg-ochre-50 p-4 text-sm text-ochre-800">
          Falta ejecutar la migración de la fase 10 (supabase/migrations) en Supabase para gestionar el equipo.
        </p>
      )}
      {equipo?.error && (
        <p role="alert" className="rounded-lg bg-brick-50 px-3 py-2 text-sm text-brick-700">
          No se pudo cargar el equipo: {equipo.error}
        </p>
      )}

      {equipo && !equipo.migracionPendiente && !equipo.error && (
        <>
          <p className="text-[14px] text-stone-600">
            Cada persona entra con su propio usuario y cada registro queda con su nombre. Un ayudante crea y edita, pero no
            borra ni administra. Si alguien deja de trabajar, desactívalo: pierde el acceso y su historial se conserva.
          </p>
          <GestionEquipo miembros={equipo.miembros} />
        </>
      )}
    </section>
  );
}
