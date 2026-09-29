import { ESTADO_BADGE, ESTADO_DOT, ESTADO_LABEL } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

/** Pastilla discreta: punto de estado + etiqueta, en tinte suave. */
export function EstadoBadge({ estado }: { estado: EstadoOrden }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[estado]}`}
    >
      <span className={`size-1.5 rounded-full ${ESTADO_DOT[estado]}`} aria-hidden />
      {ESTADO_LABEL[estado]}
    </span>
  );
}
