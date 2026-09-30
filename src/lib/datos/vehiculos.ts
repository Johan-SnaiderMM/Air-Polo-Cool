/** Acceso a datos de vehículos y clientes (lista, historial por placa y preselección al crear una orden). */
import type { VehiculoResultado } from "@/app/(app)/ordenes/actions";
import { filtroVehiculos } from "@/lib/consultas";
import type { ClienteServidor } from "@/utils/supabase/sesion";

// ---------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------

async function consultarVehiculos(supabase: ClienteServidor, filtro: string | null, conBusqueda: boolean, limite: number) {
  let consulta = supabase
    .from("vehiculos")
    .select("id, placa, marca, modelo, anio, clientes(nombre, telefono)")
    // Con búsqueda, por placa; sin ella, los más recientes primero.
    .order(conBusqueda ? "placa" : "created_at", { ascending: conBusqueda })
    .limit(limite);
  if (filtro) consulta = consulta.or(filtro);
  return consulta;
}

export type VehiculoEnLista = NonNullable<Awaited<ReturnType<typeof consultarVehiculos>>["data"]>[number];

export async function listarVehiculos(
  supabase: ClienteServidor,
  { q, limite }: { q: string; limite: number }
): Promise<{ vehiculos: VehiculoEnLista[]; error: string | null }> {
  const filtro = q ? await filtroVehiculos(supabase, q) : null;
  // Con texto que no coincide con nada no se consulta (sería devolver todos).
  if (q && !filtro) return { vehiculos: [], error: null };

  const { data, error } = await consultarVehiculos(supabase, filtro, !!q, limite);
  return { vehiculos: data ?? [], error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// Historial de un vehículo
// ---------------------------------------------------------------------

async function consultarFicha(supabase: ClienteServidor, id: string) {
  const { data } = await supabase.from("vehiculos").select("*, clientes(*)").eq("id", id).maybeSingle();
  return data;
}

async function consultarServicios(supabase: ClienteServidor, vehiculoId: string) {
  const { data } = await supabase
    .from("ordenes_servicio")
    .select(
      "id, estado, fecha_ingreso, kilometraje, total_cobrado, dias_garantia, fecha_fin_garantia, trabajos_a_realizar, orden_repuestos(cantidad_usada, inventario(nombre, tipo_unidad))"
    )
    .eq("vehiculo_id", vehiculoId)
    .order("fecha_ingreso", { ascending: false });
  return data ?? [];
}

export type ServicioVehiculo = Awaited<ReturnType<typeof consultarServicios>>[number];

type FichaConCliente = NonNullable<Awaited<ReturnType<typeof consultarFicha>>>;

export type HistorialVehiculo = {
  vehiculo: FichaConCliente;
  cliente: NonNullable<FichaConCliente["clientes"]>;
  /** Servicios del vehículo, el más reciente primero. */
  servicios: ServicioVehiculo[];
  /** Otros vehículos del mismo cliente. */
  otrosDelCliente: { id: string; placa: string; marca: string; modelo: string }[];
  ultimoKm: number | null;
  /** Suma de lo cobrado en servicios no cancelados. */
  totalFacturado: number;
};

/** Resumen de una lista de servicios: último kilometraje registrado y total facturado (sin cancelados). */
export function resumirServicios(servicios: Pick<ServicioVehiculo, "estado" | "kilometraje" | "total_cobrado">[]) {
  return {
    ultimoKm: servicios.find((s) => s.kilometraje !== null)?.kilometraje ?? null,
    totalFacturado: servicios.filter((s) => s.estado !== "cancelado").reduce((t, s) => t + s.total_cobrado, 0),
  };
}

/** Ficha, servicios y otros vehículos del cliente; null si el vehículo no existe o no tiene cliente. */
export async function cargarHistorialVehiculo(supabase: ClienteServidor, id: string): Promise<HistorialVehiculo | null> {
  const vehiculo = await consultarFicha(supabase, id);
  if (!vehiculo || !vehiculo.clientes) return null;
  const cliente = vehiculo.clientes;

  const [servicios, otros] = await Promise.all([
    consultarServicios(supabase, id),
    supabase.from("vehiculos").select("id, placa, marca, modelo").eq("cliente_id", cliente.id).neq("id", id).order("placa"),
  ]);

  return { vehiculo, cliente, servicios, otrosDelCliente: otros.data ?? [], ...resumirServicios(servicios) };
}

// ---------------------------------------------------------------------
// Preselección al crear una orden (?vehiculo=<id>)
// ---------------------------------------------------------------------

export async function buscarVehiculoParaOrden(supabase: ClienteServidor, id: string): Promise<VehiculoResultado | null> {
  const { data } = await supabase
    .from("vehiculos")
    .select("id, placa, marca, modelo, anio, clientes(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    placa: data.placa,
    marca: data.marca,
    modelo: data.modelo,
    anio: data.anio,
    cliente: data.clientes?.nombre ?? "",
  };
}
