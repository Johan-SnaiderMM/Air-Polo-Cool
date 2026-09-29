import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { esUuid } from "@/lib/ordenes";
import { OrdenForm } from "@/components/ordenes/orden-form";
import { CapturaFotos } from "@/components/ordenes/captura-fotos";
import {
  GaleriaEvidencias,
  type EvidenciaVista,
} from "@/components/ordenes/galeria-evidencias";
import { RepuestosOrden, type LineaRepuesto } from "@/components/ordenes/repuestos-orden";
import { ResumenFinanciero } from "@/components/ordenes/resumen-financiero";
import { redondearDinero } from "@/lib/inventario";
import {
  NotificacionesWhatsApp,
  type BotonWhatsApp,
} from "@/components/ordenes/notificaciones-whatsapp";
import { cargarContextoOrden, envioAutomaticoConfigurado } from "@/lib/notificaciones";
import { enlaceWhatsApp, PLANTILLA_LABEL, type PlantillaWhatsApp } from "@/lib/whatsapp";
import { EstadoBadge } from "@/components/ordenes/estado-badge";

export const metadata: Metadata = { title: "Orden" };

const BUCKET_EVIDENCIAS = "evidencias-ordenes";
const VIGENCIA_URL_SEGUNDOS = 60 * 60;

export default async function OrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();

  const { data: orden } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, vehiculos(placa, marca, modelo, anio, tipo_gas_sugerido, carga_estandar_gramos, clientes(nombre, telefono))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!orden) notFound();

  const { data: filas } = await supabase
    .from("evidencias_fotograficas")
    .select("id, tipo, notas, url_imagen, created_at")
    .eq("orden_id", id)
    .order("created_at", { ascending: true });

  const [{ data: filasRepuestos }, { data: sesion }] = await Promise.all([
    supabase
      .from("orden_repuestos")
      .select(
        "id, cantidad_usada, costo_unitario, precio_unitario, inventario(nombre, codigo, tipo_unidad)"
      )
      .eq("orden_id", id)
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const lineas: LineaRepuesto[] = (filasRepuestos ?? []).flatMap((r) =>
    r.inventario
      ? [
          {
            id: r.id,
            nombre: r.inventario.nombre,
            codigo: r.inventario.codigo,
            tipo_unidad: r.inventario.tipo_unidad,
            cantidad_usada: r.cantidad_usada,
            precio_unitario: r.precio_unitario,
          },
        ]
      : []
  );
  const repuestosPrecio = redondearDinero(
    (filasRepuestos ?? []).reduce((s, r) => s + r.cantidad_usada * r.precio_unitario, 0)
  );
  const repuestosCosto = redondearDinero(
    (filasRepuestos ?? []).reduce((s, r) => s + r.cantidad_usada * r.costo_unitario, 0)
  );
  const esAdmin = sesion.user?.app_metadata?.rol === "admin";
  const bloqueada = orden.estado === "entregado" || orden.estado === "cancelado";

  // El bucket es privado: se firman URLs temporales.
  const rutas = (filas ?? []).map((f) => f.url_imagen);
  const firmadas = rutas.length
    ? await supabase.storage
        .from(BUCKET_EVIDENCIAS)
        .createSignedUrls(rutas, VIGENCIA_URL_SEGUNDOS)
    : { data: [] };
  const urlPorRuta = new Map(
    (firmadas.data ?? []).map((s) => [s.path, s.signedUrl])
  );

  const evidencias: EvidenciaVista[] = (filas ?? []).map((f) => ({
    id: f.id,
    tipo: f.tipo,
    notas: f.notas,
    created_at: f.created_at,
    url: urlPorRuta.get(f.url_imagen) ?? null,
  }));

  const v = orden.vehiculos;

  // WhatsApp: mensajes ya redactados + enlaces wa.me (no dependen de ningún servidor externo).
  const contexto = await cargarContextoOrden(supabase, orden.id);
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
          <EstadoBadge estado={orden.estado} />
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
      </div>

      {contexto && (
        <div className="space-y-3">
          <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Avisar al cliente por WhatsApp</h3>
          <NotificacionesWhatsApp
            ordenId={orden.id}
            botones={botonesWhatsApp}
            urlPublica={contexto.urlPublica}
            automaticoConfigurado={envioAutomaticoConfigurado()}
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Bitácora fotográfica</h3>
        <CapturaFotos ordenId={orden.id} />
        <GaleriaEvidencias evidencias={evidencias} ordenId={orden.id} puedeEliminar={esAdmin} />
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
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Datos de la orden</h3>
        <OrdenForm
          // Remonta el formulario cuando cambian los montos desde el resumen.
          key={`${orden.mano_obra}-${orden.total_cobrado}`}
          modo="editar"
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
          }}
        />
      </div>
    </section>
  );
}
