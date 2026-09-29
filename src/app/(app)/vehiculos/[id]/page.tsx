import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Gauge, Plus, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { formatearCantidad } from "@/lib/inventario";
import {
  esUuid,
  formatearFecha,
  formatearFechaDate,
} from "@/lib/ordenes";
import { EstadoBadge } from "@/components/ordenes/estado-badge";
import { EditarVehiculoCliente } from "@/components/vehiculos/editar-vehiculo-cliente";

import { Dinero } from "@/components/ui/dinero";
export const metadata: Metadata = { title: "Historial del vehículo" };

const numero = new Intl.NumberFormat("es-CO");

export default async function VehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();

  const { data: vehiculo } = await supabase
    .from("vehiculos")
    .select("*, clientes(*)")
    .eq("id", id)
    .maybeSingle();
  if (!vehiculo || !vehiculo.clientes) notFound();
  const cliente = vehiculo.clientes;

  const [{ data: ordenes }, { data: otros }] = await Promise.all([
    supabase
      .from("ordenes_servicio")
      .select(
        "id, estado, fecha_ingreso, kilometraje, total_cobrado, dias_garantia, fecha_fin_garantia, trabajos_a_realizar, orden_repuestos(cantidad_usada, inventario(nombre, tipo_unidad))"
      )
      .eq("vehiculo_id", id)
      .order("fecha_ingreso", { ascending: false }),
    supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo")
      .eq("cliente_id", cliente.id)
      .neq("id", id)
      .order("placa"),
  ]);

  const historial = ordenes ?? [];
  const conKm = historial.filter((o) => o.kilometraje !== null);
  const ultimoKm = conKm[0]?.kilometraje ?? null;
  const totalGastado = historial
    .filter((o) => o.estado !== "cancelado")
    .reduce((s, o) => s + o.total_cobrado, 0);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/vehiculos"
          aria-label="Volver a vehículos"
          className="flex size-11 items-center justify-center rounded-full active:bg-stone-200"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <h2 className="font-serif text-[26px] leading-tight font-medium tracking-tight">Historial del vehículo</h2>
      </div>

      {/* ---------- Ficha ---------- */}
      <div className="space-y-3 rounded-2xl border border-stone-200/70 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md border border-stone-300/70 bg-stone-100 px-3 py-1 font-mono text-2xl font-semibold tracking-wider text-ink">
            {vehiculo.placa}
          </span>
          {vehiculo.tipo_gas_sugerido && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-ink">
              {vehiculo.tipo_gas_sugerido}
              {vehiculo.carga_estandar_gramos ? ` · ${vehiculo.carga_estandar_gramos} g` : ""}
            </span>
          )}
        </div>
        <p className="text-lg font-medium">
          {vehiculo.marca} {vehiculo.modelo}
          {vehiculo.anio ? ` ${vehiculo.anio}` : ""}
        </p>

        <div className="border-t border-stone-100 pt-3 text-sm">
          <p className="font-semibold">{cliente.nombre}</p>
          <p className="text-stone-600">{cliente.telefono}</p>
          {cliente.documento && <p className="text-stone-500">Doc. {cliente.documento}</p>}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-stone-50 p-2">
            <dt className="text-[11px] text-stone-500">Servicios</dt>
            <dd className="font-mono text-lg font-medium tabular-nums">{historial.length}</dd>
          </div>
          <div className="rounded-xl bg-stone-50 p-2">
            <dt className="text-[11px] text-stone-500">Último km</dt>
            <dd className="font-mono text-lg font-medium tabular-nums">{ultimoKm !== null ? numero.format(ultimoKm) : "—"}</dd>
          </div>
          <div className="rounded-xl bg-stone-50 p-2">
            <dt className="text-[11px] text-stone-500">Facturado</dt>
            <dd className="text-sm font-semibold"><Dinero valor={totalGastado} /></dd>
          </div>
        </dl>

        <div className="flex gap-2">
          <Link
            href={`/ordenes/nueva?vehiculo=${vehiculo.id}`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-600 text-sm font-semibold text-white active:bg-accent-700"
          >
            <Plus className="size-5" aria-hidden /> Nueva orden
          </Link>
          <a
            href={enlaceWhatsApp(cliente.telefono, "")}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-sage-700 text-sm font-semibold text-white active:bg-sage-800"
          >
            Escribir por WhatsApp
          </a>
        </div>

        <EditarVehiculoCliente vehiculo={vehiculo} cliente={cliente} />
      </div>

      {(otros ?? []).length > 0 && (
        <div>
          <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
            Otros vehículos de {cliente.nombre.split(/\s+/)[0]}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {(otros ?? []).map((o) => (
              <li key={o.id}>
                <Link
                  href={`/vehiculos/${o.id}`}
                  className="flex h-11 items-center gap-2 rounded-full border border-stone-300/70 bg-white px-4 text-sm font-semibold active:bg-stone-100"
                >
                  <span className="font-mono">{o.placa}</span>
                  <span className="text-stone-500">{o.marca}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Historial ---------- */}
      <div className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">Servicios anteriores</h3>

        {historial.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300/70 bg-white p-6 text-center text-sm text-stone-500">
            Este vehículo aún no tiene órdenes.
          </p>
        ) : (
          <ul className="space-y-3">
            {historial.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/ordenes/${o.id}`}
                  className="block space-y-2 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft active:bg-stone-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{formatearFecha(o.fecha_ingreso)}</p>
                    <EstadoBadge estado={o.estado} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
                    {o.kilometraje !== null && (
                      <span className="flex items-center gap-1.5">
                        <Gauge className="size-4" aria-hidden />
                        {numero.format(o.kilometraje)} km
                      </span>
                    )}
                    {o.fecha_fin_garantia && (
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="size-4" aria-hidden />
                        Garantía hasta {formatearFechaDate(o.fecha_fin_garantia)}
                      </span>
                    )}
                  </div>

                  {o.trabajos_a_realizar && (
                    <p className="line-clamp-2 text-sm">{o.trabajos_a_realizar}</p>
                  )}

                  {o.orden_repuestos.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {o.orden_repuestos.map((r, i) =>
                        r.inventario ? (
                          <li
                            key={i}
                            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700"
                          >
                            {r.inventario.nombre} ·{" "}
                            {formatearCantidad(r.cantidad_usada, r.inventario.tipo_unidad)}
                          </li>
                        ) : null
                      )}
                    </ul>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-semibold"><Dinero valor={o.total_cobrado} /></span>
                    <ChevronRight className="size-5 text-stone-400" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
