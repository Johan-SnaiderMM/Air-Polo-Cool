import { Ellipsis, HardHat, Truck, Utensils, Wrench, type LucideIcon } from "lucide-react";
import type { CategoriaGasto } from "@/types/database";

export const CATEGORIA_ICONO: Record<CategoriaGasto, LucideIcon> = {
  ayudante: HardHat,
  alimentacion_refrigerio: Utensils,
  flete_acarreo: Truck,
  herramienta_consumible: Wrench,
  otros: Ellipsis,
};
