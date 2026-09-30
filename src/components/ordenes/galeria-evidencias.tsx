import { AsignarRepuestoFoto } from "@/components/ordenes/asignar-repuesto-foto";
import { BotonEliminarFoto } from "@/components/ordenes/boton-eliminar-foto";
import { agruparPorRepuesto } from "@/lib/fotos-repuesto";
import { TIPOS_EVIDENCIA, TIPO_EVIDENCIA_LABEL } from "@/lib/ordenes";
import { formatearFecha } from "@/lib/ordenes";
import type { TipoEvidencia } from "@/types/database";

export type EvidenciaVista = {
  id: string;
  tipo: TipoEvidencia;
  notas: string | null;
  created_at: string;
  /** Fase 5: línea de repuesto de la orden a la que pertenece la foto. */
  orden_repuesto_id: string | null;
  /** URL firmada temporal (null si no se pudo firmar). */
  url: string | null;
};

type Props = {
  evidencias: EvidenciaVista[];
  repuestos: { id: string; nombre: string }[];
  ordenId: string;
  puedeEliminar: boolean;
};

function Miniatura({
  foto,
  ordenId,
  puedeEliminar,
  repuestos,
  asignable,
}: {
  foto: EvidenciaVista;
  ordenId: string;
  puedeEliminar: boolean;
  repuestos: Props["repuestos"];
  /** Foto de repuesto sin asignar: muestra el selector para ligarla. */
  asignable: boolean;
}) {
  return (
    <li>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-200">
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
        {puedeEliminar && <BotonEliminarFoto ordenId={ordenId} evidenciaId={foto.id} />}
      </div>
      {asignable && repuestos.length > 0 && (
        <AsignarRepuestoFoto ordenId={ordenId} evidenciaId={foto.id} repuestos={repuestos} />
      )}
    </li>
  );
}

export function GaleriaEvidencias({ evidencias, repuestos, ordenId, puedeEliminar }: Props) {
  if (evidencias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
        Aún no hay fotos en esta orden.
      </p>
    );
  }

  const { grupos, sueltas } = agruparPorRepuesto(
    evidencias.map((e) => ({ ...e, orden_repuesto_id: e.orden_repuesto_id })),
    repuestos
  );

  const comun = { ordenId, puedeEliminar, repuestos };

  return (
    <div className="space-y-5">
      {grupos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-stone-700">Por repuesto</h4>
          {grupos.map(({ repuesto, retirado, instalado }) => (
            <div key={repuesto.id} className="rounded-2xl border border-stone-200/70 bg-white p-3 shadow-soft">
              <p className="mb-2 text-[15px] font-medium">{repuesto.nombre}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { titulo: "Retirado", fotos: retirado, estilo: "bg-brick-100 text-brick-800" },
                  { titulo: "Instalado", fotos: instalado, estilo: "bg-sage-100 text-sage-800" },
                ].map((col) => (
                  <div key={col.titulo} className="min-w-0">
                    <p className={`mb-2 rounded-lg px-2 py-1 text-center text-xs font-semibold ${col.estilo}`}>
                      {col.titulo}
                    </p>
                    {col.fotos.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-stone-300/70 p-3 text-center text-xs text-stone-500">
                        Falta la foto
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {col.fotos.map((f) => (
                          <Miniatura key={f.id} foto={f} asignable={false} {...comun} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {TIPOS_EVIDENCIA.map((tipo) => {
        const fotos = sueltas.filter((e) => e.tipo === tipo);
        if (fotos.length === 0) return null;
        const deRepuesto = tipo === "repuesto_viejo" || tipo === "repuesto_nuevo";
        return (
          <div key={tipo}>
            <h4 className="mb-2 text-sm font-semibold text-stone-700">
              {TIPO_EVIDENCIA_LABEL[tipo]}
              {deRepuesto && grupos.length > 0 ? " · sin asignar" : ""} ({fotos.length})
            </h4>
            <ul className="grid grid-cols-3 gap-2">
              {fotos.map((foto) => (
                <Miniatura key={foto.id} foto={foto} asignable={deRepuesto} {...comun} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
