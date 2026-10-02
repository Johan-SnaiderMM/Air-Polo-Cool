import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cargarDetalleOrden } from "@/lib/datos/ordenes";
import { mesesMantenimiento } from "@/lib/datos/mapeo";
import { esUuid } from "@/lib/ordenes";
import { BotonEliminarOrden } from "@/components/ordenes/boton-eliminar-orden";
import { CambiarEstado } from "@/components/ordenes/cambiar-estado";
import { OrdenFormEditar } from "@/components/ordenes/orden-form-editar";
import { Colapsable } from "@/components/ui/colapsable";
import { CapturaFotos } from "@/components/ordenes/captura-fotos";
import { GaleriaEvidencias } from "@/components/ordenes/galeria-evidencias";
import { RepuestosOrden } from "@/components/ordenes/repuestos-orden";
import { ResumenFinanciero } from "@/components/ordenes/resumen-financiero";
import {
  NotificacionesWhatsApp,
  type BotonWhatsApp,
} from "@/components/ordenes/notificaciones-whatsapp";
import { envioAutomaticoConfigurado } from "@/lib/notificaciones";
import { enlaceWhatsApp, PLANTILLA_LABEL, type PlantillaWhatsApp } from "@/lib/whatsapp";
import { PagosOrden } from "@/components/ordenes/pagos-orden";
import { pertenenciasONull } from "@/lib/offline/operaciones";
import { Printer } from "lucide-react";

export const metadata: Metadata = { title: "Orden" };


export default async function OrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const detalle = await cargarDetalleOrden(supabase, id);
  if (!detalle) notFound();

  const { orden, lineas, repuestosPrecio, repuestosCosto, pagos, saldoPendiente, historial, evidencias, esAdmin, bloqueada, contexto } =
    detalle;
  const v = orden.vehiculos;

  // WhatsApp: mensajes ya redactados + enlaces wa.me (no dependen de ningún servidor externo).
  const plantillas: PlantillaWhatsApp[] =
    orden.estado === "entregado" ? ["recepcion", "listo", "entregado"] : ["recepcion", "listo"];
  const sugerida: PlantillaWhatsApp =
    orden.estado === "entregado"
      ? "entregado"
      : orden.estado === "listo"
        ? "listo"
        : "recepcion";
  const botonesWhatsApp: BotonWhatsApp[] = contexto
    ? plantillas.map((p) => ({
        plantilla: p,
        label: PLANTILLA_LABEL[p],
        href: enlaceWhatsApp(contexto.telefono, contexto.mensajes[p]),
        sugerido: p === sugerida,
      }))
    : [];

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/ordenes"
          aria-label="Volver a órdenes"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Orden de servicio</h2>
      </div>

      <div className="rounded-2xl border border-stone-200/70 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md border border-stone-300/70 bg-stone-100 px-2.5 py-1 font-mono text-xl font-semibold tracking-wider text-ink">
            {v?.placa ?? "—"}
          </span>
          <CambiarEstado
            ordenId={orden.id}
            estado={orden.estado}
            placa={v?.placa ?? "—"}
            vehiculo={v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : "Vehículo"}
            saldo={saldoPendiente}
            mantenimientoMeses={mesesMantenimiento(orden.mantenimiento_meses)}
          />
        </div>
        <p className="mt-2 text-base font-medium">
          {v ? `${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}` : ""}
        </p>
        {v?.tipo_gas_sugerido && (
          <p className="text-sm text-ink">
            Refrigerante: <strong>{v.tipo_gas_sugerido}</strong>
            {v.carga_estandar_gramos ? ` · carga ${v.carga_estandar_gramos} g` : ""}
          </p>
        )}
        <p className="text-sm text-stone-600">{v?.clientes?.nombre}</p>
        {v?.clientes?.telefono && (
          <p className="text-sm text-stone-500">{v.clientes.telefono}</p>
        )}
        <Link
          href={`/vehiculos/${orden.vehiculo_id}`}
          className="mt-3 flex h-11 items-center justify-center rounded-xl border border-stone-300/70 text-sm font-semibold text-ink active:bg-stone-100"
        >
          Ver historial del vehículo
        </Link>
        <Link
          href={`/ordenes/${orden.id}/comprobante`}
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300/70 text-sm font-semibold text-ink active:bg-stone-100"
        >
          <Printer className="size-4" aria-hidden /> Orden y garantía en PDF
        </Link>
      </div>

      {contexto && (
        <div className="space-y-3">
          <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Avisar al cliente por WhatsApp</h3>
          <NotificacionesWhatsApp
            ordenId={orden.id}
            botones={botonesWhatsApp}
            automaticoConfigurado={envioAutomaticoConfigurado()}
          />
        </div>
      )}

      {historial.length > 0 && (
        <Colapsable
          titulo="Historial de estados"
          resumen={`${historial.length} ${historial.length === 1 ? "registro" : "registros"} · último: ${historial[0]}`}
        >
          <ol className="space-y-2.5">
            {historial.map((linea, i) => (
              <li key={i} className="border-l-2 border-stone-200 pl-3 text-[13px] leading-snug text-stone-700">
                {linea}
              </li>
            ))}
          </ol>
        </Colapsable>
      )}

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Bitácora fotográfica</h3>
        <CapturaFotos ordenId={orden.id} repuestos={lineas.map((l) => ({ id: l.id, nombre: l.nombre }))} />
        <GaleriaEvidencias
          evidencias={evidencias}
          repuestos={lineas.map((l) => ({ id: l.id, nombre: l.nombre }))}
          ordenId={orden.id}
          puedeEliminar={esAdmin}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Repuestos e insumos utilizados</h3>
        <RepuestosOrden
          ordenId={orden.id}
          lineas={lineas}
          bloqueada={bloqueada}
          puedeEliminar={esAdmin}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Resumen financiero</h3>
        <ResumenFinanciero
          ordenId={orden.id}
          manoObra={orden.mano_obra}
          repuestosPrecio={repuestosPrecio}
          repuestosCosto={repuestosCosto}
          totalCobrado={orden.total_cobrado}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Pagos y saldo</h3>
        <PagosOrden
          ordenId={orden.id}
          estadoOrden={orden.estado}
          totalCobrado={orden.total_cobrado}
          pagos={pagos}
          cliente={v?.clientes ? { nombre: v.clientes.nombre, telefono: v.clientes.telefono ?? null, placa: v.placa ?? "" } : null}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Datos de la orden</h3>
        <OrdenFormEditar
          // Remonta el formulario cuando cambian los montos o el estado desde fuera de él.
          key={`${orden.mano_obra}-${orden.total_cobrado}-${orden.estado}-${orden.mantenimiento_meses ?? 0}`}
          ordenId={orden.id}
          fechaEntrega={orden.fecha_entrega}
          valores={{
            kilometraje: orden.kilometraje?.toString() ?? "",
            diagnostico_inicial: orden.diagnostico_inicial ?? "",
            trabajos_a_realizar: orden.trabajos_a_realizar ?? "",
            mano_obra: orden.mano_obra ? String(orden.mano_obra) : "",
            total_cobrado: orden.total_cobrado ? String(orden.total_cobrado) : "",
            dias_garantia: orden.dias_garantia,
            estado: orden.estado,
            pertenencias: pertenenciasONull(orden.pertenencias),
            mantenimiento_meses: mesesMantenimiento(orden.mantenimiento_meses),
          }}
        />
      </div>

      {esAdmin && orden.estado === "recibido" && pagos.length === 0 && (
        <BotonEliminarOrden ordenId={orden.id} placa={v?.placa ?? "este vehículo"} />
      )}
    </section>
  );
}
