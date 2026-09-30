/**
 * Valores del formulario de orden y armado/validación de una orden NUEVA (puro: sin React ni red).
 * La pantalla de crear solo recoge los datos, llama a `armarOrdenNueva` y encola el resultado.
 */
import type { MesesMantenimiento } from "@/components/ordenes/selector-mantenimiento";
import type { SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { numeroOpcional } from "@/lib/formularios";
import {
  nuevoId,
  type DatosOrden,
  type DatosVehiculoOrden,
  type Validacion,
} from "@/lib/offline/operaciones";
import { normalizarPlaca, normalizarTelefono } from "@/lib/ordenes";
import type { EstadoOrden, Pertenencias } from "@/types/database";

/** Campos del formulario tal como los escribe el usuario (los números van como texto). */
export type OrdenFormValores = {
  kilometraje: string;
  diagnostico_inicial: string;
  trabajos_a_realizar: string;
  mano_obra: string;
  total_cobrado: string;
  dias_garantia: number;
  estado: EstadoOrden;
  pertenencias: Pertenencias | null;
  mantenimiento_meses: MesesMantenimiento;
};

export const VALORES_NUEVA: OrdenFormValores = {
  kilometraje: "",
  diagnostico_inicial: "",
  trabajos_a_realizar: "",
  mano_obra: "",
  total_cobrado: "",
  dias_garantia: 0,
  estado: "recibido",
  pertenencias: null,
  mantenimiento_meses: null,
};

const falla = (error: string): { ok: false; error: string } => ({ ok: false, error });

function armarVehiculo(seleccion: SeleccionVehiculo, generarId: () => string): Validacion<DatosVehiculoOrden> {
  if (seleccion.modo === "existente") {
    return { ok: true, valor: { nuevo: false, id: seleccion.vehiculo.id } };
  }
  const d = seleccion.datos;
  const telefono = normalizarTelefono(d.cliente_telefono);
  const placa = normalizarPlaca(d.placa);
  const anio = numeroOpcional(d.anio);
  if (!d.cliente_nombre.trim()) return falla("Ingresa el nombre del cliente.");
  if (!telefono) return falla("WhatsApp inválido. Usa 10 dígitos (300 123 4567) o el formato +57…");
  if (!/^[A-Z0-9]{5,8}$/.test(placa)) return falla("La placa debe tener entre 5 y 8 letras/números.");
  if (!d.marca.trim() || !d.modelo.trim()) return falla("Ingresa la marca y la línea.");
  if (anio !== null && (Number.isNaN(anio) || !Number.isInteger(anio) || anio < 1950 || anio > 2100)) {
    return falla("El modelo (año) debe estar entre 1950 y 2100.");
  }
  return {
    ok: true,
    valor: {
      nuevo: true,
      id: generarId(),
      cliente_id: generarId(),
      cliente_nombre: d.cliente_nombre.trim(),
      cliente_telefono: telefono,
      placa,
      marca: d.marca.trim(),
      modelo: d.modelo.trim(),
      anio,
    },
  };
}

/**
 * Valida el formulario y arma la operación «orden.crear». Los ids se generan aquí (en el teléfono)
 * para que reenviar tras un corte de red nunca duplique la orden.
 */
export function armarOrdenNueva(entrada: {
  valores: OrdenFormValores;
  vehiculo: SeleccionVehiculo | null;
  autor: DatosOrden["autor"];
  generarId?: () => string;
}): Validacion<DatosOrden> {
  const { valores: v, vehiculo, autor, generarId = nuevoId } = entrada;
  if (!vehiculo) return falla("Selecciona un vehículo o registra uno nuevo.");

  const datosVehiculo = armarVehiculo(vehiculo, generarId);
  if (!datosVehiculo.ok) return datosVehiculo;

  const km = numeroOpcional(v.kilometraje);
  const manoObra = numeroOpcional(v.mano_obra) ?? 0;
  const total = numeroOpcional(v.total_cobrado) ?? 0;
  if (km !== null && (Number.isNaN(km) || km < 0 || !Number.isInteger(km))) {
    return falla("El kilometraje debe ser un número entero mayor o igual a 0.");
  }
  if (Number.isNaN(manoObra) || manoObra < 0 || Number.isNaN(total) || total < 0) {
    return falla("Los valores de cobro deben ser mayores o iguales a 0.");
  }

  const listoOEntregado = v.estado === "listo" || v.estado === "entregado";
  return {
    ok: true,
    valor: {
      id: generarId(),
      vehiculo: datosVehiculo.valor,
      kilometraje: km,
      diagnostico_inicial: v.diagnostico_inicial.trim() || null,
      trabajos_a_realizar: v.trabajos_a_realizar.trim() || null,
      mano_obra: manoObra,
      total_cobrado: total,
      dias_garantia: v.dias_garantia,
      estado: v.estado,
      pertenencias: v.pertenencias,
      mantenimiento_meses: listoOEntregado ? v.mantenimiento_meses : null,
      autor,
    },
  };
}
