/**
 * Acceso a datos de la agenda: citas pendientes (agrupadas por día) y mantenimientos preventivos
 * que aún no tienen cita. Si la migración de la fase 7 no se ha ejecutado, la tabla no existe: se
 * devuelve un error legible y la página lo muestra en vez de romperse.
 */
import {
  agruparCitas,
  cuandoCita,
  DIAS_ATRASADAS,
  DIAS_AVISO_CITA,
  etiquetaDiaAgenda,
  horaLegible,
  instanteBogota,
  partesBogota,
  sumarDias,
  type CitaDeVehiculo,
  type GrupoDia,
} from "@/lib/agenda";
import { hoyBogota } from "@/lib/caja";
import { mensajeDeError } from "@/lib/errores";
import { enlaceWhatsApp, mensajeCita, mensajeMantenimiento } from "@/lib/whatsapp";
import type { TipoCita } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

const LIMITE_CITAS = 300;

async function consultarCitas(supabase: ClienteServidor, desde: string) {
  return supabase
    .from("citas")
    .select(
      "id, vehiculo_id, fecha_hora, tipo, notas, recordatorio_enviado_at, vehiculos(placa, marca, modelo, anio, clientes(nombre, telefono))"
    )
    .eq("estado", "pendiente")
    .gte("fecha_hora", desde)
    .order("fecha_hora", { ascending: true })
    .limit(LIMITE_CITAS);
}

type FilaCita = NonNullable<Awaited<ReturnType<typeof consultarCitas>>["data"]>[number];

/** Una cita lista para mostrar (todo ya formateado; el navegador no recalcula nada). */
export type CitaVista = {
  id: string;
  vehiculoId: string;
  /** Instante ISO (UTC). */
  fechaHora: string;
  /** 'YYYY-MM-DD' y 'HH:MM' en hora de Colombia, para rellenar el formulario de reprogramación. */
  fecha: string;
  hora: string;
  /** "9:30 a. m." */
  horaTexto: string;
  tipo: TipoCita;
  notas: string | null;
  /** Cuándo se tocó el botón de WhatsApp (null si aún no se le ha recordado). */
  recordadoAt: string | null;
  placa: string;
  /** "Chevrolet Spark GT 2018" */
  vehiculo: string;
  cliente: string;
  /** Enlace wa.me con el recordatorio ya redactado (null si el cliente no tiene teléfono). */
  whatsappHref: string | null;
};

/** "Marca Línea Modelo" (cualquiera puede faltar). */
function nombreVehiculo(marca: string | null | undefined, modelo: string | null | undefined, anio: number | null | undefined): string {
  return `${marca ?? ""} ${modelo ?? ""}${anio ? ` ${anio}` : ""}`.trim();
}

export function aCitaVista(fila: FilaCita, hoy: string): CitaVista {
  const v = fila.vehiculos;
  const cliente = v?.clientes?.nombre ?? "Sin cliente";
  const telefono = v?.clientes?.telefono ?? null;
  const placa = v?.placa ?? "—";
  const vehiculo = nombreVehiculo(v?.marca, v?.modelo, v?.anio);
  const { fecha, hora } = partesBogota(fila.fecha_hora);
  const tipo: TipoCita = fila.tipo;

  return {
    id: fila.id,
    vehiculoId: fila.vehiculo_id,
    fechaHora: fila.fecha_hora,
    fecha,
    hora,
    horaTexto: horaLegible(fila.fecha_hora),
    tipo,
    notas: fila.notas,
    recordadoAt: fila.recordatorio_enviado_at,
    placa,
    vehiculo,
    cliente,
    whatsappHref: telefono
      ? enlaceWhatsApp(telefono, mensajeCita({ cliente, vehiculo, placa, cuando: cuandoCita(fila.fecha_hora, hoy), tipo }))
      : null,
  };
}

/** Un vehículo con mantenimiento preventivo vencido o próximo que todavía no tiene cita. */
export type MantenimientoPorProgramar = {
  vehiculoId: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  /** "Renault Duster 2020" */
  vehiculo: string;
  cliente: string;
  /** Enlace wa.me para proponerle que agende (null si no tiene teléfono). */
  whatsappHref: string | null;
  /** 'YYYY-MM-DD': cuándo le toca. */
  proximo: string;
  /** Negativo = ya venció. */
  dias: number;
  /** Día con el que se abre el formulario: el que le toca, o mañana si ya pasó. */
  fechaSugerida: string;
};

export type CargaAgenda = {
  /** Citas de días anteriores que nadie marcó como cumplidas ni canceladas. */
  atrasadas: CitaVista[];
  dias: GrupoDia<CitaVista>[];
  porProgramar: MantenimientoPorProgramar[];
  /** Citas pendientes mostradas (atrasadas + futuras). */
  total: number;
  error: string | null;
};

/** Citas pendientes y mantenimientos por programar, consultados a la vez. */
export async function cargarAgenda(supabase: ClienteServidor, hoy = hoyBogota()): Promise<CargaAgenda> {
  const desde = instanteBogota(sumarDias(hoy, -DIAS_ATRASADAS), "00:00");
  const [citas, mantenimientos] = await Promise.all([
    consultarCitas(supabase, desde),
    supabase
      .from("v_mantenimientos")
      .select("vehiculo_id, placa, marca, modelo, anio, cliente, telefono, proximo_mantenimiento, dias_restantes")
      .in("estado_mantenimiento", ["vencido", "proximo"])
      .order("dias_restantes", { ascending: true })
      .limit(100),
  ]);

  const vistas = (citas.data ?? []).map((fila) => aCitaVista(fila, hoy));
  const conCita = new Set(vistas.filter((c) => c.tipo === "mantenimiento").map((c) => c.vehiculoId));

  const porProgramar: MantenimientoPorProgramar[] = [];
  for (const m of mantenimientos.data ?? []) {
    if (!m.vehiculo_id || !m.placa || !m.proximo_mantenimiento || conCita.has(m.vehiculo_id)) continue;
    const cliente = m.cliente ?? "Sin cliente";
    const vehiculo = nombreVehiculo(m.marca, m.modelo, m.anio);
    porProgramar.push({
      vehiculoId: m.vehiculo_id,
      placa: m.placa,
      marca: m.marca ?? "",
      modelo: m.modelo ?? "",
      anio: m.anio,
      vehiculo,
      cliente,
      whatsappHref: m.telefono ? enlaceWhatsApp(m.telefono, mensajeMantenimiento({ cliente, placa: m.placa, vehiculo })) : null,
      proximo: m.proximo_mantenimiento,
      dias: m.dias_restantes ?? 0,
      fechaSugerida: m.proximo_mantenimiento >= hoy ? m.proximo_mantenimiento : sumarDias(hoy, 1),
    });
  }

  return {
    ...agruparCitas(vistas, hoy),
    porProgramar,
    total: vistas.length,
    error: citas.error ? mensajeDeError(citas.error) : null,
  };
}

/** Cuántas citas pendientes hay hoy y mañana (para el inicio); null si la tabla aún no existe. */
export async function contarAgendaInicio(
  supabase: ClienteServidor,
  hoy = hoyBogota()
): Promise<{ hoy: number; manana: number } | null> {
  const dia = (fecha: string) => ({ desde: instanteBogota(fecha, "00:00"), hasta: instanteBogota(sumarDias(fecha, 1), "00:00") });
  const d0 = dia(hoy);
  const d1 = dia(sumarDias(hoy, 1));
  const contar = (r: { desde: string; hasta: string }) =>
    supabase
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente")
      .gte("fecha_hora", r.desde)
      .lt("fecha_hora", r.hasta);

  const [a, b] = await Promise.all([contar(d0), contar(d1)]);
  if (a.error || b.error) return null;
  return { hoy: a.count ?? 0, manana: b.count ?? 0 };
}

/**
 * Citas pendientes de un vehículo de hoy, de los próximos 7 días y las atrasadas que nadie atendió (hasta
 * 14 días atrás), para decidir al recibirlo si el ingreso es de una de ellas. `incluirId` fuerza a incluir esa cita (la de la que se viene desde la agenda)
 * aunque caiga más lejos. Sin la tabla (migración pendiente) devuelve la lista vacía y el error.
 */
export async function citasDelVehiculo(
  supabase: ClienteServidor,
  vehiculoId: string,
  incluirId: string | null = null,
  hoy = hoyBogota()
): Promise<{ citas: CitaDeVehiculo[]; error: string | null }> {
  const desde = instanteBogota(sumarDias(hoy, -DIAS_ATRASADAS), "00:00");
  const hasta = instanteBogota(sumarDias(hoy, DIAS_AVISO_CITA + 1), "00:00");
  const { data, error } = await supabase
    .from("citas")
    .select("id, fecha_hora, tipo")
    .eq("vehiculo_id", vehiculoId)
    .eq("estado", "pendiente")
    .gte("fecha_hora", desde)
    .lt("fecha_hora", hasta)
    .order("fecha_hora", { ascending: true })
    .limit(10);
  if (error) return { citas: [], error: mensajeDeError(error) };

  let filas = data ?? [];
  if (incluirId && !filas.some((f) => f.id === incluirId)) {
    const { data: una } = await supabase
      .from("citas")
      .select("id, fecha_hora, tipo")
      .eq("id", incluirId)
      .eq("vehiculo_id", vehiculoId)
      .eq("estado", "pendiente")
      .maybeSingle();
    if (una) filas = [...filas, una].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
  }

  return {
    citas: filas.map((f) => {
      const { fecha } = partesBogota(f.fecha_hora);
      return {
        id: f.id,
        fechaHora: f.fecha_hora,
        tipo: f.tipo,
        esHoy: fecha === hoy,
        atrasada: fecha < hoy,
        etiquetaDia: etiquetaDiaAgenda(fecha, hoy),
        horaTexto: horaLegible(f.fecha_hora),
      };
    }),
    error: null,
  };
}
