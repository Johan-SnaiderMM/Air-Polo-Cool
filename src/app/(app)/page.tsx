import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { etiquetaMes, mesActual } from "@/lib/caja";
import { InicioVista, type InicioDatos } from "@/components/inicio/inicio-vista";
import type { OrdenResumen } from "@/components/ordenes/orden-card";
import { enlaceWhatsApp, mensajeMantenimiento } from "@/lib/whatsapp";
import type { EstadoOrden } from "@/types/database";

export const metadata: Metadata = { title: "Inicio" };

const ESTADOS_ACTIVOS: EstadoOrden[] = ["recibido", "diagnostico", "en_proceso", "listo"];

export default async function InicioPage() {
  const supabase = await createClient();
  const mes = mesActual();

  // Las consultas de las Fases 3 y 4 (caja, cartera, mantenimientos) devuelven error si el SQL
  // todavía no se ejecutó: en ese caso se muestran ceros / se ocultan, sin romper el inicio.
  const [activas, criticosCount, criticos, porVencer, vencidas, balance, saldoCaja, cartera, mantenimientos] =
    await Promise.all([
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
      supabase.from("v_garantias").select("orden_id", { count: "exact", head: true }).eq("semaforo", "amarillo"),
      supabase.from("v_garantias").select("orden_id", { count: "exact", head: true }).eq("semaforo", "rojo"),
      supabase.from("v_balance_real").select("utilidad_real").eq("mes", `${mes}-01`).maybeSingle(),
      supabase.rpc("fn_saldo_caja"),
      supabase.from("v_cartera").select("saldo").limit(1000),
      supabase
        .from("v_mantenimientos")
        .select("orden_id, placa, marca, modelo, anio, cliente, telefono, dias_restantes, estado_mantenimiento")
        .in("estado_mantenimiento", ["vencido", "proximo"])
        .order("dias_restantes", { ascending: true })
        .limit(50),
    ]);

  // Si la Fase 4 aún no está, v_balance_real no existe: se cae a la vista de la Fase 1.
  let utilidadMes = balance.data?.utilidad_real ?? null;
  if (utilidadMes === null && balance.error) {
    const { data } = await supabase.from("v_balance_mensual").select("utilidad_real").eq("mes", `${mes}-01`).maybeSingle();
    utilidadMes = data?.utilidad_real ?? 0;
  }

  const ordenes = (activas.data ?? []) as OrdenResumen[];
  const listaMant = mantenimientos.data ?? [];

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
    utilidadMes: utilidadMes ?? 0,
    saldoCaja: saldoCaja.error ? null : Number(saldoCaja.data ?? 0),
    porCobrar: cartera.error
      ? null
      : {
          total: (cartera.data ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0),
          ordenes: (cartera.data ?? []).length,
        },
    mantenimientos: {
      vencidos: listaMant.filter((m) => m.estado_mantenimiento === "vencido").length,
      proximos: listaMant.filter((m) => m.estado_mantenimiento === "proximo").length,
      lista: listaMant.slice(0, 3).flatMap((m) =>
        m.orden_id && m.placa
          ? [
              {
                ordenId: m.orden_id,
                placa: m.placa,
                cliente: m.cliente ?? "",
                vehiculo: `${m.marca ?? ""} ${m.modelo ?? ""}${m.anio ? ` ${m.anio}` : ""}`.trim(),
                dias: m.dias_restantes ?? 0,
                whatsappHref: m.telefono
                  ? enlaceWhatsApp(
                      m.telefono,
                      mensajeMantenimiento({
                        cliente: m.cliente ?? "",
                        placa: m.placa,
                        vehiculo: `${m.marca ?? ""} ${m.modelo ?? ""}${m.anio ? ` ${m.anio}` : ""}`.trim(),
                      })
                    )
                  : null,
              },
            ]
          : []
      ),
    },
  };

  return <InicioVista datos={datos} />;
}
