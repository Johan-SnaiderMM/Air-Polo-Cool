/**
 * Valores del formulario de orden y armado/validación de una orden NUEVA (puro: sin React ni red).
 * La pantalla de crear solo recoge los datos, llama a `armarOrdenNueva` y encola el resultado.
 * Las reglas son las de los esquemas compartidos (src/lib/esquemas): las mismas que aplica el
 * servidor al editar una orden y al procesar la cola.
 */
import type { MesesMantenimiento } from "@/components/ordenes/selector-mantenimiento";
import type { SeleccionVehiculo } from "@/components/ordenes/vehiculo-selector";
import { validar, type Validacion } from "@/lib/esquemas/comunes";
import { camposOrdenSchema } from "@/lib/esquemas/orden";
import { camposVehiculoNuevoSchema } from "@/lib/esquemas/vehiculo";
import { nuevoId, type DatosOrden, type DatosVehiculoOrden } from "@/lib/offline/operaciones";
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

function armarVehiculo(seleccion: SeleccionVehiculo, generarId: () => string): Validacion<DatosVehiculoOrden> {
  if (seleccion.modo === "existente") {
    return { ok: true, valor: { nuevo: false, id: seleccion.vehiculo.id } };
  }
  const d = seleccion.datos;
  const campos = validar(camposVehiculoNuevoSchema, d);
  if (!campos.ok) return campos;
  return { ok: true, valor: { nuevo: true, id: generarId(), cliente_id: generarId(), ...campos.valor } };
}

/**
 * Valida el formulario y arma la operación «orden.crear». Los ids se generan aquí (en el teléfono)
 * para que reenviar tras un corte de red nunca duplique la orden.
 */
export function armarOrdenNueva(entrada: {
  valores: OrdenFormValores;
  vehiculo: SeleccionVehiculo | null;
  autor: DatosOrden["autor"];
  /** Cita de la agenda de la que viene la orden (se cierra al guardarla). */
  citaId?: string | null;
  generarId?: () => string;
}): Validacion<DatosOrden> {
  const { valores: v, vehiculo, autor, citaId = null, generarId = nuevoId } = entrada;
  if (!vehiculo) return { ok: false, error: "Selecciona un vehículo o registra uno nuevo." };

  const datosVehiculo = armarVehiculo(vehiculo, generarId);
  if (!datosVehiculo.ok) return datosVehiculo;

  const campos = validar(camposOrdenSchema, v);
  if (!campos.ok) return campos;

  const listoOEntregado = campos.valor.estado === "listo" || campos.valor.estado === "entregado";
  return {
    ok: true,
    valor: {
      id: generarId(),
      vehiculo: datosVehiculo.valor,
      ...campos.valor,
      pertenencias: v.pertenencias,
      mantenimiento_meses: listoOEntregado ? v.mantenimiento_meses : null,
      autor,
      cita_id: citaId,
    },
  };
}
