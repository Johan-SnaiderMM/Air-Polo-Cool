import type { InicioDatos } from "@/components/inicio/inicio-vista";
import { etiquetaMes, mesActual, rangoMes, totalesPorMedio } from "@/lib/caja";
import { SELECT_ORDEN_RESUMEN } from "@/lib/datos/ordenes";
import { enlaceWhatsApp, mensajeMantenimiento } from "@/lib/whatsapp";
import type { EstadoOrden } from "@/types/database";
import type { ClienteServidor } from "@/utils/supabase/sesion";

const ESTADOS_ACTIVOS: EstadoOrden[] = ["recibido", "diagnostico", "en_proceso", "listo"];

const formatoFechaHoy = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

/** "Marca Línea Modelo" a partir de las tres partes (cualquiera puede faltar). */
function nombreVehiculo(marca: string | null, modelo: string | null, anio: number | null): string {
  return `${marca ?? ""} ${modelo ?? ""}${anio ? ` ${anio}` : ""}`.trim();
}

/**
 * Datos del inicio: nueve consultas independientes a la vez. Las de las fases 3 y 4 (cobros,
 * cartera, mantenimientos) devuelven error si el SQL aún no se ejecutó: en ese caso se muestran
 * ceros o se ocultan, sin romper el inicio.
 */
export async function cargarDatosInicio(supabase: ClienteServidor): Promise<InicioDatos> {
  const mes = mesActual();
  const { desde, hasta } = rangoMes(mes);

  const [activas, criticosCount, criticos, porVencer, vencidas, balance, cobros, cartera, mantenimientos] =
    await Promise.all([
      supabase
        .from("ordenes_servicio")
        .select(SELECT_ORDEN_RESUMEN)
        .in("estado", ESTADOS_ACTIVOS)
        .order("fecha_ingreso", { ascending: false })
        .limit(200),
      supabase.from("v_inventario_reposicion").select("id", { count: "exact", head: true }),
      supabase
        .from("v_inventario_reposicion")
        .select("id, nombre, tipo_unidad, stock_actual, stock_minimo")
        .order("faltante", { ascending: false })
        .limit(3),
      supabase.from("v_garantias").select("orden_id", { count: "exact", head: true }).eq("semaforo", "amarillo"),
      supabase.from("v_garantias").select("orden_id", { count: "exact", head: true }).eq("semaforo", "rojo"),
      supabase.from("v_balance_real").select("utilidad_real").eq("mes", `${mes}-01`).maybeSingle(),
      supabase
        .from("pagos_orden")
        .select("medio, monto, es_devolucion")
        .eq("anulado", false)
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase.from("v_cartera").select("saldo").limit(1000),
      supabase
        .from("v_mantenimientos")
        .select("orden_id, placa, marca, modelo, anio, cliente, telefono, dias_restantes, estado_mantenimiento")
        .in("estado_mantenimiento", ["vencido", "proximo"])
        .order("dias_restantes", { ascending: true })
        .limit(50),
    ]);

  // Si la fase 4 aún no está, v_balance_real no existe: se cae a la vista de la fase 1.
  let utilidadMes = balance.data?.utilidad_real ?? null;
  if (utilidadMes === null && balance.error) {
    const { data } = await supabase.from("v_balance_mensual").select("utilidad_real").eq("mes", `${mes}-01`).maybeSingle();
    utilidadMes = data?.utilidad_real ?? 0;
  }

  const ordenes = activas.data ?? [];
  const listaMant = mantenimientos.data ?? [];

  return {
    fechaHoy: formatoFechaHoy.format(new Date()),
    mesEtiqueta: etiquetaMes(mes).replace(" de ", " "),
    porEstado: ESTADOS_ACTIVOS.map((estado) => ({
      estado,
      total: ordenes.filter((o) => o.estado === estado).length,
    })),
    listas: ordenes.filter((o) => o.estado === "listo"),
    garantiasPorVencer: porVencer.count ?? 0,
    garantiasVencidas: vencidas.count ?? 0,
    criticosTotal: criticosCount.count ?? 0,
    criticos: (criticos.data ?? []).flatMap((i) =>
      i.id && i.nombre
        ? [{ id: i.id, nombre: i.nombre, tipo_unidad: i.tipo_unidad, stock_actual: i.stock_actual }]
        : []
    ),
    utilidadMes: utilidadMes ?? 0,
    cobrosMes: cobros.error ? null : totalesPorMedio(cobros.data ?? []),
    porCobrar: cartera.error
      ? null
      : {
          total: (cartera.data ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0),
          ordenes: (cartera.data ?? []).length,
        },
    mantenimientos: {
      vencidos: listaMant.filter((m) => m.estado_mantenimiento === "vencido").length,
      proximos: listaMant.filter((m) => m.estado_mantenimiento === "proximo").length,
      lista: listaMant.slice(0, 3).flatMap((m) => {
        if (!m.orden_id || !m.placa) return [];
        const vehiculo = nombreVehiculo(m.marca, m.modelo, m.anio);
        return [
          {
            ordenId: m.orden_id,
            placa: m.placa,
            cliente: m.cliente ?? "",
            vehiculo,
            dias: m.dias_restantes ?? 0,
            whatsappHref: m.telefono
              ? enlaceWhatsApp(m.telefono, mensajeMantenimiento({ cliente: m.cliente ?? "", placa: m.placa, vehiculo }))
              : null,
          },
        ];
      }),
    },
  };
}
