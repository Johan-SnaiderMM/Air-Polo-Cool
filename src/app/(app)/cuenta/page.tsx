import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { CambiarContrasena } from "@/components/equipo/cambiar-contrasena";
import { autorDeUsuario } from "@/lib/autor";
import { cargarPerfil } from "@/lib/datos/perfil";
import { obtenerSesion } from "@/utils/supabase/sesion";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const { supabase, user } = await obtenerSesion();
  const perfil = user ? await cargarPerfil(supabase) : null;
  const nombre = autorDeUsuario(user, perfil);
  const esDueno = user?.app_metadata?.rol === "admin";

  return (
    <section className="space-y-5">
      <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Mi cuenta</h2>

      <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
        <p className="text-[13px] text-stone-500">Registras como</p>
        <p className="text-[20px] font-medium">{nombre}</p>
        {user?.email && <p className="mt-1 text-[14px] text-stone-600">{user.email}</p>}
        <p className="mt-2 text-[13px] text-stone-500">
          {esDueno ? "Administrador: puedes borrar y gestionar el equipo." : "Ayudante: puedes crear y editar, pero no borrar."}
        </p>
      </div>

      {esDueno && (
        <Link
          href="/equipo"
          className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft active:bg-stone-50"
        >
          <Users className="size-5 text-stone-500" aria-hidden />
          <span className="flex-1 text-[15px] font-medium">Equipo</span>
          <ChevronRight className="size-5 text-stone-400" aria-hidden />
        </Link>
      )}

      <CambiarContrasena />
    </section>
  );
}
