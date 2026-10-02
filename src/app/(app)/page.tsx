import type { Metadata } from "next";
import { InicioVista } from "@/components/inicio/inicio-vista";
import { EnlacesLegales } from "@/components/legal/enlaces-legales";
import { cargarDatosInicio } from "@/lib/datos/inicio";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const supabase = await createClient();
  return (
    <>
      <InicioVista datos={await cargarDatosInicio(supabase)} />
      <EnlacesLegales className="pt-8" />
    </>
  );
}
