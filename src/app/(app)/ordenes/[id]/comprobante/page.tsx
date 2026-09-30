import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LineaFirma, Membrete, SeccionImpresa } from "@/components/print/membrete";
import { BarraImpresion } from "@/components/print/boton-imprimir";
import { Dinero } from "@/components/ui/dinero";
import { origenPublico } from "@/lib/notificaciones";
import { formatearCantidad, redondearDinero } from "@/lib/inventario";
import { pertenenciasONull } from "@/lib/offline/operaciones";
import { ESTADO_LABEL, esUuid, formatearFecha, formatearFechaDate } from "@/lib/ordenes";
import { urlPublicaOrden } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Orden de servicio y garantía" };
export const dynamic = "force-dynamic";

const CARROCERIA = { sin_danos: "Sin daños visibles", rayones: "Con rayones", golpes: "Con golpes" } as const;
const si = (b: boolean) => (b ? "Sí" : "No");

export default async function ComprobanteOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: orden } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, vehiculos(placa, marca, modelo, anio, tipo_gas_sugerido, carga_estandar_gramos, clientes(nombre, telefono, documento))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!orden) notFound();

  const [{ data: repuestos }, { data: pagos }] = await Promise.all([
    supabase
      .from("orden_repuestos")
      .select("cantidad_usada, precio_unitario, inventario(nombre, tipo_unidad)")
      .eq("orden_id", id)
      .order("created_at"),
    supabase.from("pagos_orden").select("monto, es_devolucion").eq("orden_id", id).eq("anulado", false),
  ]);

  const v = orden.vehiculos;
  const cliente = v?.clientes;
  const lineas = (repuestos ?? []).flatMap((r) =>
    r.inventario
      ? [
          {
            nombre: r.inventario.nombre,
            cantidad: r.cantidad_usada,
            unidad: r.inventario.tipo_unidad,
            precio: r.precio_unitario,
            subtotal: redondearDinero(r.cantidad_usada * r.precio_unitario),
          },
        ]
      : []
  );
  const totalRepuestos = redondearDinero(lineas.reduce((s, l) => s + l.subtotal, 0));
  const ajuste = redondearDinero(orden.total_cobrado - orden.mano_obra - totalRepuestos);
  const pagado = redondearDinero((pagos ?? []).reduce((s, p) => s + (p.es_devolucion ? -p.monto : p.monto), 0));
  const saldo = redondearDinero(orden.total_cobrado - pagado);
  const pert = pertenenciasONull(orden.pertenencias);
  const url = urlPublicaOrden(await origenPublico(), orden.token_publico);

  return (
    <div>
      <BarraImpresion volver={`/ordenes/${id}`} />

      <article className="mx-auto max-w-[760px] space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 text-[13px] text-ink print:rounded-none print:border-0 print:p-0">
        <Membrete
          titulo="Orden de servicio y garantía"
          referencia={orden.id.slice(0, 8).toUpperCase()}
          fecha={`Emitido el ${formatearFecha(new Date().toISOString())}`}
        />

        <div className="grid grid-cols-2 gap-4">
          <SeccionImpresa titulo="Vehículo">
            <p className="font-mono text-lg font-semibold tracking-widest">{v?.placa}</p>
            <p>
              {v?.marca} {v?.modelo}
              {v?.anio ? ` ${v.anio}` : ""}
            </p>
            {orden.kilometraje !== null && <p>Kilometraje: {new Intl.NumberFormat("es-CO").format(orden.kilometraje)} km</p>}
            {v?.tipo_gas_sugerido && (
              <p>
                Refrigerante: {v.tipo_gas_sugerido}
                {v.carga_estandar_gramos ? ` · ${v.carga_estandar_gramos} g` : ""}
              </p>
            )}
          </SeccionImpresa>
          <SeccionImpresa titulo="Cliente">
            <p className="font-medium">{cliente?.nombre}</p>
            <p>{cliente?.telefono}</p>
            {cliente?.documento && <p>Doc. {cliente.documento}</p>}
            <p className="text-stone-500">
              Ingreso: {formatearFecha(orden.fecha_ingreso)}
              {orden.fecha_entrega ? ` · Entrega: ${formatearFecha(orden.fecha_entrega)}` : ""}
            </p>
            <p className="text-stone-500">Estado: {ESTADO_LABEL[orden.estado]}</p>
          </SeccionImpresa>
        </div>

        {pert && (
          <SeccionImpresa titulo="Pertenencias recibidas al ingreso">
            <p>
              Carrocería: {CARROCERIA[pert.carroceria]} · Llanta de repuesto: {si(pert.llanta_repuesto)} ·
              Herramientas/gato: {si(pert.herramientas)} · Documentos: {si(pert.documentos)}
            </p>
            {pert.objetos_valor && <p>Objetos de valor: {pert.objetos_valor}</p>}
            {pert.notas && <p className="text-stone-500">Observaciones: {pert.notas}</p>}
          </SeccionImpresa>
        )}

        {(orden.diagnostico_inicial || orden.trabajos_a_realizar) && (
          <SeccionImpresa titulo="Diagnóstico y trabajos">
            {orden.diagnostico_inicial && (
              <p className="whitespace-pre-line">
                <span className="text-stone-500">Diagnóstico: </span>
                {orden.diagnostico_inicial}
              </p>
            )}
            {orden.trabajos_a_realizar && (
              <p className="whitespace-pre-line">
                <span className="text-stone-500">Trabajos: </span>
                {orden.trabajos_a_realizar}
              </p>
            )}
          </SeccionImpresa>
        )}

        <SeccionImpresa titulo="Repuestos e insumos instalados">
          {lineas.length === 0 ? (
            <p className="text-stone-500">Sin repuestos registrados.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[11px] text-stone-500 uppercase">
                <tr>
                  <th className="py-1 font-medium">Detalle</th>
                  <th className="py-1 text-right font-medium">Cant.</th>
                  <th className="py-1 text-right font-medium">Precio</th>
                  <th className="py-1 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{l.nombre}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{formatearCantidad(l.cantidad, l.unidad)}</td>
                    <td className="py-1.5 text-right">
                      <Dinero valor={l.precio} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Dinero valor={l.subtotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SeccionImpresa>

        <SeccionImpresa titulo="Resumen de pago">
          <dl className="ml-auto w-full max-w-xs space-y-1">
            <div className="flex justify-between">
              <dt className="text-stone-500">Mano de obra</dt>
              <dd>
                <Dinero valor={orden.mano_obra} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Repuestos e insumos</dt>
              <dd>
                <Dinero valor={totalRepuestos} />
              </dd>
            </div>
            {ajuste !== 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-500">{ajuste > 0 ? "Otros cargos" : "Descuento"}</dt>
                <dd>
                  <Dinero valor={Math.abs(ajuste)} />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-300 pt-1 text-[15px] font-medium">
              <dt>Total</dt>
              <dd>
                <Dinero valor={orden.total_cobrado} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Pagado</dt>
              <dd>
                <Dinero valor={pagado} />
              </dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Saldo pendiente</dt>
              <dd>
                <Dinero valor={saldo} />
              </dd>
            </div>
          </dl>
        </SeccionImpresa>

        <SeccionImpresa titulo="Certificado de garantía">
          {orden.dias_garantia > 0 ? (
            <p>
              Este servicio tiene <strong>{orden.dias_garantia} días</strong> de garantía
              {orden.fecha_fin_garantia ? (
                <>
                  , vigente hasta el <strong>{formatearFechaDate(orden.fecha_fin_garantia)}</strong>.
                </>
              ) : (
                ", contados desde la fecha de entrega del vehículo."
              )}{" "}
              La garantía cubre los trabajos y repuestos aquí descritos, con uso normal del sistema.
            </p>
          ) : (
            <p className="text-stone-500">Este servicio no tiene garantía asignada.</p>
          )}
          {orden.proximo_mantenimiento && (
            <p>Próximo mantenimiento preventivo sugerido: {formatearFechaDate(orden.proximo_mantenimiento)}.</p>
          )}
          <p className="text-stone-500">Consulta en línea (fotos, repuestos y garantía): {url}</p>
        </SeccionImpresa>

        <div className="evitar-corte flex gap-10 pt-6">
          <LineaFirma etiqueta="Recibí conforme (cliente)" />
          <LineaFirma etiqueta="Polo Air Cool" />
        </div>
      </article>
    </div>
  );
}
