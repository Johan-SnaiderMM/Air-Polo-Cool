import { Snowflake } from "lucide-react";
import { Ventisca } from "@/components/ui/ventisca";

/** Carga de cualquier pantalla interna: ventisca sobre la marca y esqueleto con brillo debajo. */
export default function CargandoApp() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <div className="relative isolate flex h-24 items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-ink text-ice-300">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgb(30_86_216/0.35),transparent_70%)]"
        />
        <Ventisca className="-z-10" />
        <Snowflake className="animate-copo size-5" strokeWidth={1.75} aria-hidden />
        <span className="text-[13px] font-medium tracking-wide">Enfriando…</span>
      </div>

      <div className="esqueleto h-11 w-2/3 rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="esqueleto h-28 rounded-2xl" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
