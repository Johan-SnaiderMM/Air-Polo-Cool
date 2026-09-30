import Link from "next/link";
import { BellRing, CalendarClock, ChevronRight, MessageCircle } from "lucide-react";
import { enlaceWhatsApp, mensajeMantenimiento } from "@/lib/whatsapp";
import { formatearFechaDate } from "@/lib/ordenes";
import type { Views } from "@/types/database";

type Fila = Views<"v_mantenimientos">;

const ESTILO = {
  vencido: { etiqueta: "Vencido", punto: "bg-brick-500", texto: "text-brick-700" },
  proximo: { etiqueta: "Próximo", punto: "bg-ochre-500", texto: "text-ochre-700" },
  lejano: { etiqueta: "Programado", punto: "bg-sage-500", texto: "text-sage-700" },
} as const;

/**
 * Próximos mantenimientos preventivos (uno por vehículo, según su última orden
 * lista/entregada). Cada tarjeta trae el botón de WhatsApp con el recordatorio formal.
 */
export function ListaMantenimientos({ filas }: { filas: Fila[] }) {
  const validas = filas.filter((f) => f.orden_id && f.placa && f.estado_mantenimiento);

  if (validas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300/70 bg-white p-8 text-center text-stone-500">
        Aún no hay mantenimientos programados. Al marcar una orden como Listo o Entregado elige “Próximo mantenimiento
        preventivo”.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {validas.map((f) => {
        const e = ESTILO[f.estado_mantenimiento!];
        const dias = f.dias_restantes ?? 0;
        const vehiculo = `${f.marca ?? ""} ${f.modelo ?? ""}${f.anio ? ` ${f.anio}` : ""}`.trim();
        const href =
          f.telefono && f.cliente
            ? enlaceWhatsApp(f.telefono, mensajeMantenimiento({ cliente: f.cliente, placa: f.placa!, vehiculo }))
            : null;
        return (
          <li key={f.orden_id} className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2.5 py-1 font-mono text-[15px] font-semibold tracking-wider">
                {f.placa}
              </span>
              <span className={`flex items-center gap-2 text-sm font-medium ${e.texto}`}>
                <span className={`size-2.5 rounded-full ${e.punto}`} aria-hidden />
                {e.etiqueta}
              </span>
            </div>

            <div>
              <p className="font-medium">{f.cliente}</p>
              <p className="text-[13px] text-stone-500">{vehiculo}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-stone-600">
                <CalendarClock className="size-4" aria-hidden />
                {f.proximo_mantenimiento ? formatearFechaDate(f.proximo_mantenimiento) : ""} ·{" "}
                {dias < 0 ? `venció hace ${Math.abs(dias)} d` : dias === 0 ? "hoy" : `en ${dias} d`}
                <BellRing className="ml-auto size-4 text-stone-400" strokeWidth={1.5} aria-hidden />
                <span className="text-stone-500">cada {f.mantenimiento_meses} meses</span>
              </p>
            </div>

            <div className="flex gap-2">
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sage-700 text-sm font-medium text-white active:bg-sage-800"
                >
                  <MessageCircle className="size-4" aria-hidden /> Recordar por WhatsApp
                </a>
              )}
              <Link
                href={`/ordenes/${f.orden_id}`}
                className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-stone-300/70 text-sm font-medium text-stone-700 active:bg-stone-100"
              >
                Ver orden <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
