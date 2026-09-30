import Image from "next/image";
import { TALLER } from "@/lib/taller";

/** Membrete del taller para comprobantes impresos / PDF. */
export function Membrete({
  titulo,
  referencia,
  fecha,
}: {
  titulo: string;
  /** Número o código corto del documento. */
  referencia?: string;
  fecha: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-stone-300 pb-4">
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={64} height={64} className="size-16 rounded-full" />
        <div>
          <p className="font-serif text-2xl leading-none font-medium tracking-tight">{TALLER.nombre}</p>
          <p className="mt-1 text-[12px] text-stone-500">{TALLER.subtitulo}</p>
          <p className="text-[12px] text-stone-500">WhatsApp {TALLER.telefonoVisible}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-serif text-lg leading-tight font-medium">{titulo}</p>
        {referencia && <p className="font-mono text-[12px] text-stone-600">N.º {referencia}</p>}
        <p className="text-[12px] text-stone-500">{fecha}</p>
      </div>
    </header>
  );
}

/** Bloque con título en versalitas para las secciones del documento. */
export function SeccionImpresa({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="evitar-corte space-y-2">
      <h3 className="border-b border-stone-200 pb-1 text-[11px] font-medium tracking-[0.1em] text-stone-500 uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Línea de firma para el documento impreso. */
export function LineaFirma({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="flex-1">
      <div className="h-12 border-b border-stone-400" />
      <p className="mt-1 text-center text-[12px] text-stone-500">{etiqueta}</p>
    </div>
  );
}
