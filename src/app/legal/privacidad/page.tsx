import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/documento-legal";
import { politicaPrivacidad } from "@/lib/legal";

const documento = politicaPrivacidad();

export const metadata: Metadata = { title: documento.titulo, description: documento.descripcion };

export default function PrivacidadPage() {
  return <PaginaLegal documento={documento} otro={{ href: "/legal/aviso", texto: "Aviso legal" }} />;
}
