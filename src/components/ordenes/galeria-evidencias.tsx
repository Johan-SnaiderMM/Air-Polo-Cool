import { BotonEliminarFoto } from "@/components/ordenes/boton-eliminar-foto";
import { TIPOS_EVIDENCIA, TIPO_EVIDENCIA_LABEL } from "@/lib/ordenes";
import { formatearFecha } from "@/lib/ordenes";
import type { TipoEvidencia } from "@/types/database";

export type EvidenciaVista = {
  id: string;
  tipo: TipoEvidencia;
  notas: string | null;
  created_at: string;
  /** URL firmada temporal (null si no se pudo firmar). */
  url: string | null;
};

export function GaleriaEvidencias({
  evidencias,
  ordenId,
  puedeEliminar,
}: {
  evidencias: EvidenciaVista[];
  ordenId: string;
  puedeEliminar: boolean;
}) {
  if (evidencias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
        Aún no hay fotos en esta orden.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {TIPOS_EVIDENCIA.map((tipo) => {
        const fotos = evidencias.filter((e) => e.tipo === tipo);
        if (fotos.length === 0) return null;
        return (
          <div key={tipo}>
            <h4 className="mb-2 text-sm font-semibold text-stone-700">
              {TIPO_EVIDENCIA_LABEL[tipo]} ({fotos.length})
            </h4>
            <ul className="grid grid-cols-3 gap-2">
              {fotos.map((foto) => (
                <li
                  key={foto.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-stone-200"
                >
                  {foto.url ? (
                    <a href={foto.url} target="_blank" rel="noreferrer">
                      {/* URL firmada y temporal: next/image no aporta aquí. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.url}
                        alt={`${TIPO_EVIDENCIA_LABEL[foto.tipo]} · ${formatearFecha(foto.created_at)}`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </a>
                  ) : (
                    <span className="flex size-full items-center justify-center p-2 text-center text-xs text-stone-500">
                      No disponible
                    </span>
                  )}
                  {puedeEliminar && (
                    <BotonEliminarFoto ordenId={ordenId} evidenciaId={foto.id} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
