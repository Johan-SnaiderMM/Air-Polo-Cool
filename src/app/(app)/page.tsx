import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { etiquetaMes, mesActual } from "@/lib/caja";
import { InicioVista, type InicioDatos } from "@/components/inicio/inicio-vista";
import type { OrdenResumen } from "@/components/ordenes/orden-card";
import type { EstadoOrden } from "@/types/database";

export const metadata: Metadata = { title: "Inicio" };

const ESTADOS_ACTIVOS: EstadoOrden[] = ["recibido", "diagnostico", "en_proceso", "listo"];

export default async function InicioPage() {
  const supabase = await createClient();
  const mes = mesActual();

  const [activas, criticosCount, criticos, porVencer, vencidas, balance] = await Promise.all([
    supabase
      .from("ordenes_servicio")
      .select(
        "id, estado, fecha_ingreso, total_cobrado, vehiculos(placa, marca, modelo, anio, clientes(nombre))"
      )
      .in("estado", ESTADOS_ACTIVOS)
      .order("fecha_ingreso", { ascending: false })
      .limit(200),
    supabase.from("v_inventario_reposicion").select("id", { count: "exact", head: true }),
    supabase
      .from("v_inventario_reposicion")
      .select("id, nombre, tipo_unidad, stock_actual, stock_minimo")
      .order("faltante", { ascending: false })
      .limit(3),
    supabase
      .from("v_garantias")
      .select("orden_id", { count: "exact", head: true })
      .eq("semaforo", "amarillo"),
    supabase
      .from("v_garantias")
      .select("orden_id", { count: "exact", head: true })
      .eq("semaforo", "rojo"),
    supabase.from("v_balance_mensual").select("*").eq("mes", `${mes}-01`).maybeSingle(),
  ]);

  const ordenes = (activas.data ?? []) as OrdenResumen[];

  const datos: InicioDatos = {
    fechaHoy: new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Bogota",
    }).format(new Date()),
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
    utilidadMes: balance.data?.utilidad_real ?? 0,
  };

  return <InicioVista datos={datos} />;
}
