import type { CategoriaGasto } from "@/types/database";

/**
 * Plantillas de gastos rutinarios (1 toque). Se guardan SOLO en el dispositivo
 * (IndexedDB, clave `plantillas_gasto`): son una comodidad, no un dato contable.
 */
export type PlantillaGasto = {
  id: string;
  nombre: string;
  monto: number;
  categoria: CategoriaGasto;
  descripcion: string | null;
};

export const CLAVE_PLANTILLAS = "plantillas_gasto";

export const PLANTILLAS_POR_DEFECTO: PlantillaGasto[] = [
  {
    id: "defecto-almuerzo",
    nombre: "Almuerzo ayudantes",
    monto: 15000,
    categoria: "alimentacion_refrigerio",
    descripcion: "Almuerzo ayudantes",
  },
  {
    id: "defecto-hielo",
    nombre: "Hielo/Agua",
    monto: 5000,
    categoria: "alimentacion_refrigerio",
    descripcion: "Hielo/Agua",
  },
];

export const MAX_PLANTILLAS = 8;

/** Valida lo leído del almacén local (puede venir de una versión anterior o corrupta). */
export function plantillasValidas(entrada: unknown): PlantillaGasto[] {
  if (!Array.isArray(entrada)) return PLANTILLAS_POR_DEFECTO;
  const salida: PlantillaGasto[] = [];
  for (const p of entrada) {
    if (
      p &&
      typeof p === "object" &&
      typeof (p as PlantillaGasto).id === "string" &&
      typeof (p as PlantillaGasto).nombre === "string" &&
      typeof (p as PlantillaGasto).monto === "number" &&
      (p as PlantillaGasto).monto > 0 &&
      typeof (p as PlantillaGasto).categoria === "string"
    ) {
      salida.push(p as PlantillaGasto);
    }
  }
  return salida.slice(0, MAX_PLANTILLAS);
}
