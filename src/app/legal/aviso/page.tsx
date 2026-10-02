import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/documento-legal";
import { avisoLegal } from "@/lib/legal";

const documento = avisoLegal();

export const metadata: Metadata = { title: documento.titulo, description: documento.descripcion };

export default function AvisoLegalPage() {
  return <PaginaLegal documento={documento} otro={{ href: "/legal/privacidad", texto: "Política de privacidad" }} />;
}
