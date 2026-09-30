/**
 * Datos de referencia que viajan al teléfono para trabajar sin red
 * (selectores de vehículo y de orden en los formularios).
 * Tipos y búsqueda locales: módulo puro, con pruebas.
 */
import { normalizarPlaca } from "@/lib/ordenes";
import type { EstadoOrden } from "@/types/database";

export type VehiculoLocal = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  cliente_id: string;
  cliente: string;
  telefono: string;
};

export type OrdenLocal = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  cliente: string;
  estado: EstadoOrden;
  total_cobrado: number;
  /** Saldo por cobrar conocido al generar el snapshot. */
  saldo: number;
};

export type Snapshot = {
  generado: string; // ISO
  vehiculos: VehiculoLocal[];
  ordenes: OrdenLocal[];
};

export const CLAVE_SNAPSHOT = "snapshot";

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Búsqueda local por placa o nombre/teléfono del cliente (mismo criterio que el servidor). */
export function buscarVehiculosLocal(snapshot: Snapshot | null, consulta: string, limite = 8): VehiculoLocal[] {
  const q = consulta.trim();
  if (!snapshot || q.length < 2) return [];
  const placa = normalizarPlaca(q);
  const texto = normalizar(q);
  const digitos = q.replace(/\D/g, "");

  return snapshot.vehiculos
    .filter(
      (v) =>
        (placa.length > 0 && v.placa.includes(placa)) ||
        normalizar(v.cliente).includes(texto) ||
        (digitos.length >= 3 && v.telefono.replace(/\D/g, "").includes(digitos))
    )
    .slice(0, limite);
}

/** Búsqueda local de órdenes por placa o cliente (selector "asociar a una orden"). */
export function buscarOrdenesLocal(snapshot: Snapshot | null, consulta: string, limite = 8): OrdenLocal[] {
  const q = consulta.trim();
  if (!snapshot) return [];
  if (q.length === 0) return snapshot.ordenes.slice(0, limite);
  const placa = normalizarPlaca(q);
  const texto = normalizar(q);
  return snapshot.ordenes
    .filter((o) => (placa.length > 0 && o.placa.includes(placa)) || normalizar(o.cliente).includes(texto))
    .slice(0, limite);
}
