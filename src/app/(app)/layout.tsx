import { PantallaAccesoDesactivado } from "@/components/equipo/pantalla-acceso-desactivado";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PantallaMantenimiento } from "@/components/soporte/pantalla-mantenimiento";
import { AutorProvider } from "@/components/sync/autor-provider";
import { SyncProvider } from "@/components/sync/sync-provider";
import { autorDeUsuario } from "@/lib/autor";
import { cargarPerfil } from "@/lib/datos/perfil";
import { cargarEstadoSoporte, ESTADO_NORMAL } from "@/lib/datos/soporte";
import { obtenerSesion } from "@/utils/supabase/sesion";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Sin sesión el proxy ya redirige a /login; aquí solo se evita romper si llegara a faltar.
  const { supabase, user } = await obtenerSesion();
  const [soporte, perfil] = user
    ? await Promise.all([cargarEstadoSoporte(supabase, user), cargarPerfil(supabase)])
    : [ESTADO_NORMAL, null];
  const desactivado = perfil !== null && !perfil.activo;
  const bloqueado = soporte.mantenimiento.activo && !soporte.esSoporte;

  return (
    <AutorProvider autor={autorDeUsuario(user, perfil)}>
      <SyncProvider>
        <AppHeader soporte={soporte} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] print:max-w-none print:p-0">
          {desactivado ? (
            <PantallaAccesoDesactivado />
          ) : bloqueado ? (
            <PantallaMantenimiento motivo={soporte.mantenimiento.motivo} desde={soporte.mantenimiento.desde} />
          ) : (
            children
          )}
        </main>
        <BottomNav />
      </SyncProvider>
    </AutorProvider>
  );
}
