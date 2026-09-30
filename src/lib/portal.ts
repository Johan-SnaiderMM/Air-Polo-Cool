/**
 * Armado de la galería del portal público del cliente. Puro (sin red): recibe las fotos que
 * devolvió la RPC `obtener_orden_publica`, las URLs ya firmadas y arma las secciones a mostrar.
 */
import type { FotoPortal, SeccionGaleria } from "@/components/portal/galeria-portal";
import { agruparPorRepuesto } from "@/lib/fotos-repuesto";
import type { OrdenPublica, TipoEvidencia } from "@/types/database";

type EvidenciaPublica = OrdenPublica["evidencias"][number];
type TipoVisible = Exclude<TipoEvidencia, "factura_compra">;

const ETIQUETA_TIPO: Record<TipoVisible, string> = {
  ingreso: "Estado al ingreso",
  repuesto_viejo: "Repuesto retirado",
  repuesto_nuevo: "Repuesto instalado",
  prueba_tecnica: "Prueba técnica",
};

/**
 * - Las fotos de repuesto ligadas a su repuesto se muestran pieza por pieza (retirado | instalado).
 * - El resto (sin asignar, ingreso, pruebas) se agrupa por tipo.
 * - Una foto cuya URL no se pudo firmar simplemente no aparece.
 */
export function armarSeccionesPortal(
  evidencias: EvidenciaPublica[],
  repuestos: OrdenPublica["repuestos"],
  urls: Map<string, string>,
  placa: string
): SeccionGaleria[] {
  const aFoto = (e: EvidenciaPublica, etiqueta: string): FotoPortal[] => {
    const url = urls.get(e.url_imagen);
    return url ? [{ url, alt: `${etiqueta} · ${placa}`, notas: e.notas }] : [];
  };
  const fotosDe = (lista: EvidenciaPublica[], tipo: TipoVisible): FotoPortal[] =>
    lista.filter((e) => e.tipo === tipo).flatMap((e) => aFoto(e, ETIQUETA_TIPO[tipo]));

  const { grupos, sueltas } = agruparPorRepuesto(evidencias, repuestos);
  const ingreso = fotosDe(sueltas, "ingreso");
  const viejo = fotosDe(sueltas, "repuesto_viejo");
  const nuevo = fotosDe(sueltas, "repuesto_nuevo");
  const pruebas = fotosDe(sueltas, "prueba_tecnica");

  const secciones: SeccionGaleria[] = [];
  if (ingreso.length > 0) {
    secciones.push({
      titulo: "Al ingreso",
      descripcion: "Así recibimos tu vehículo.",
      columnas: [{ titulo: "Ingreso", tono: "neutro", fotos: ingreso }],
    });
  }
  grupos.forEach(({ repuesto, retirado, instalado }, i) => {
    secciones.push({
      titulo: repuesto.nombre,
      descripcion: i === 0 ? "Cada repuesto: el que retiramos y el nuevo que instalamos." : undefined,
      columnas: [
        { titulo: "Retirado", tono: "rojo", fotos: retirado.flatMap((e) => aFoto(e, `Retirado: ${repuesto.nombre}`)) },
        { titulo: "Instalado", tono: "verde", fotos: instalado.flatMap((e) => aFoto(e, `Instalado: ${repuesto.nombre}`)) },
      ],
    });
  });
  if (viejo.length > 0 || nuevo.length > 0) {
    secciones.push({
      titulo: grupos.length > 0 ? "Otros repuestos" : "Antes y después",
      descripcion: "Comparativa del repuesto retirado y el nuevo instalado.",
      columnas: [
        { titulo: "Retirado", tono: "rojo", fotos: viejo },
        { titulo: "Instalado", tono: "verde", fotos: nuevo },
      ],
    });
  }
  if (pruebas.length > 0) {
    secciones.push({
      titulo: "Pruebas técnicas",
      descripcion: "Vacío, presiones y temperatura en el difusor.",
      columnas: [{ titulo: "Pruebas", tono: "neutro", fotos: pruebas }],
    });
  }
  return secciones;
}
