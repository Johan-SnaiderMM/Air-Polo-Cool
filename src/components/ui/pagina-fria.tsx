import Image from "next/image";
import { Snowflake } from "lucide-react";
import { Ventisca } from "@/components/ui/ventisca";

/**
 * Pantalla de "no encontrado" con ventisca. `pantalla` ocupa toda la ventana (404 general);
 * sin ella es una tarjeta que cabe dentro del layout de la app.
 */
export function PaginaFria({
  codigo,
  titulo,
  mensaje,
  pantalla = false,
  children,
}: {
  codigo?: string;
  titulo: string;
  mensaje: string;
  pantalla?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center text-paper ${
        pantalla ? "min-h-dvh flex-1" : "rounded-3xl py-14"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgb(30_86_216/0.35),transparent_65%)]"
      />
      <Ventisca className="-z-10" />

      {pantalla && (
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          priority
          className="mb-6 size-16 rounded-full bg-white ring-2 ring-white/30"
        />
      )}

      {codigo ? (
        <p className="escarcha-texto font-serif text-[104px] leading-none font-medium tracking-tight" aria-hidden>
          {codigo}
        </p>
      ) : (
        <Snowflake className="size-12 text-ice-300" strokeWidth={1.25} aria-hidden />
      )}

      <h1 className="mt-4 font-serif text-[28px] leading-tight font-medium tracking-tight">{titulo}</h1>
      <p className="mt-2 max-w-xs text-[15px] text-stone-300">{mensaje}</p>
      {children && <div className="mt-8 flex w-full max-w-xs flex-col gap-3">{children}</div>}
    </div>
  );
}
