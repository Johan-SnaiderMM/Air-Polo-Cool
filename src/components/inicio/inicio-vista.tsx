import Link from "next/link";
import { ArrowUpRight, BellRing, CalendarDays, ChevronRight, MessageCircle, Package, Plus, ShieldCheck } from "lucide-react";
import { OrdenCard, type OrdenResumen } from "@/components/ordenes/orden-card";
import { Dinero } from "@/components/ui/dinero";
import type { TotalesMedio } from "@/lib/caja";
import { formatearCantidad } from "@/lib/inventario";
import { ESTADO_DOT, ESTADO_LABEL } from "@/lib/ordenes";
import type { EstadoOrden, TipoUnidad } from "@/types/database";

export type InicioDatos = {
  /** Fecha de hoy ya formateada (ej. "martes, 29 de septiembre"). */
  fechaHoy: string;
  /** Citas pendientes de hoy y de mañana (null si la fase 7 aún no está en la base). */
  agenda: { hoy: number; manana: number } | null;
  mesEtiqueta: string;
  porEstado: { estado: EstadoOrden; total: number }[];
  listas: OrdenResumen[];
  garantiasPorVencer: number;
  garantiasVencidas: number;
  criticosTotal: number;
  criticos: {
    id: string;
    nombre: string;
    tipo_unidad: TipoUnidad | null;
    stock_actual: number | null;
  }[];
  utilidadMes: number;
  /** Cobrado en el mes por medio de pago (null si la Fase 3 aún no está en la base). */
  cobrosMes: TotalesMedio | null;
  /** Cuentas por cobrar (null si la Fase 3 aún no está en la base). */
  porCobrar: { total: number; ordenes: number } | null;
  mantenimientos: {
    vencidos: number;
    proximos: number;
    lista: {
      ordenId: string;
      placa: string;
      cliente: string;
      vehiculo: string;
      dias: number;
      /** Enlace wa.me con el recordatorio formal ya redactado. */
      whatsappHref: string | null;
    }[];
  };
};

/** Etiqueta pequeña sobre cada bloque: jerarquía editorial sin usar color. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 px-0.5 text-[12px] font-medium tracking-[0.08em] text-stone-500 uppercase">
      {children}
    </h3>
  );
}

/**
 * Vista del inicio (presentacional, sin acceso a datos).
 *
 * Decisiones de diseño:
 *  - Un solo bloque para el estado del taller: cifra total + barra segmentada + rejilla 2×2
 *    que respira, en lugar de cuatro columnas apretadas.
 *  - Alertas como filas separadas por hairlines dentro de UNA tarjeta; el ocre
 *    aparece solo cuando hay algo que atender (cifra > 0).
 *  - Utilidad en tarjeta carbón con cifra monoespaciada; sin verde/rojo saturado.
 */
export function InicioVista({ datos }: { datos: InicioDatos }) {
  const totalActivas = datos.porEstado.reduce((s, e) => s + e.total, 0);
  const utilidadNegativa = datos.utilidadMes < 0;

  return (
    <section className="space-y-8">
      {/* ---------- Encabezado ---------- */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-stone-500 first-letter:uppercase">{datos.fechaHoy}</p>
          <h2 className="font-serif text-[32px] leading-tight font-medium tracking-tight">
            Taller hoy
          </h2>
        </div>
        <Link
          href="/ordenes/nueva"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-600 pr-5 pl-4 text-sm font-medium text-white transition-colors active:bg-accent-700"
        >
          <Plus className="size-[18px]" strokeWidth={2.25} aria-hidden />
          Nueva orden
        </Link>
      </div>

      {/* ---------- Agenda ---------- */}
      {datos.agenda && (
        <Link
          href="/agenda"
          className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors active:bg-stone-50"
        >
          <span className="flex items-center gap-3">
            <CalendarDays className="size-5 text-stone-500" strokeWidth={1.75} aria-hidden />
            <span>
              <span className="block text-[15px] font-medium">Agenda</span>
              <span className="block text-[13px] text-stone-500">
                {datos.agenda.hoy === 0 && datos.agenda.manana === 0
                  ? "Nada agendado para hoy ni mañana"
                  : `Hoy ${datos.agenda.hoy} ${datos.agenda.hoy === 1 ? "cita" : "citas"} · mañana ${datos.agenda.manana}`}
              </span>
            </span>
          </span>
          <ChevronRight className="size-4 text-stone-400" aria-hidden />
        </Link>
      )}

      {/* ---------- Estado del taller ---------- */}
      <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-soft">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] text-stone-500">En el taller</p>
          <p className="font-mono text-[13px] text-stone-500 tabular-nums">
            {totalActivas} {totalActivas === 1 ? "vehículo" : "vehículos"}
          </p>
        </div>

        {/* Barra segmentada proporcional */}
        <div
          className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-stone-100"
          role="img"
          aria-label={`Órdenes activas: ${datos.porEstado
            .map((e) => `${e.total} ${ESTADO_LABEL[e.estado].toLowerCase()}`)
            .join(", ")}`}
        >
          {datos.porEstado
            .filter((e) => e.total > 0)
            .map((e) => (
              <span
                key={e.estado}
                className={`${ESTADO_DOT[e.estado]} rounded-full`}
                style={{ flexGrow: e.total, flexBasis: 0 }}
              />
            ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {datos.porEstado.map(({ estado, total }) => (
            <Link
              key={estado}
              href={`/ordenes?estado=${estado}`}
              className="group -m-1 rounded-lg p-1 transition-colors active:bg-stone-50"
            >
              <p className="flex items-center gap-2 text-[13px] text-stone-500">
                <span className={`size-1.5 rounded-full ${ESTADO_DOT[estado]}`} aria-hidden />
                {ESTADO_LABEL[estado]}
              </p>
              <p className="mt-1 font-mono text-[28px] leading-none font-medium tracking-tight tabular-nums">
                {total}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* ---------- Cobros y cartera ---------- */}
      {(datos.cobrosMes !== null || datos.porCobrar !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/caja-menor?vista=cobros"
            className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors active:bg-stone-50"
          >
            <p className="flex items-center justify-between text-[12px] text-stone-500">
              Cobrado del mes
              <ArrowUpRight className="size-3.5" aria-hidden />
            </p>
            <p className="mt-1 text-[18px]">
              <Dinero valor={datos.cobrosMes?.total ?? 0} />
            </p>
            <p className="mt-1 text-[12px] text-stone-500">
              Efectivo <Dinero valor={datos.cobrosMes?.efectivo ?? 0} /> · Transf.{" "}
              <Dinero valor={datos.cobrosMes?.transferencia ?? 0} />
            </p>
          </Link>
          <Link
            href="/cartera"
            className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-soft transition-colors active:bg-stone-50"
          >
            <p className="flex items-center justify-between text-[12px] text-stone-500">
              Por cobrar
              <ArrowUpRight className="size-3.5" aria-hidden />
            </p>
            <p className={`mt-1 text-[18px] ${(datos.porCobrar?.total ?? 0) > 0 ? "text-ochre-700" : ""}`}>
              <Dinero valor={datos.porCobrar?.total ?? 0} />
            </p>
            <p className="mt-1 text-[12px] text-stone-500">
              {datos.porCobrar?.ordenes ?? 0} {(datos.porCobrar?.ordenes ?? 0) === 1 ? "orden" : "órdenes"}
            </p>
          </Link>
        </div>
      )}

      {/* ---------- Listos para entregar ---------- */}
      {datos.listas.length > 0 && (
        <div>
          <Eyebrow>Listos para entregar</Eyebrow>
          <ul className="space-y-3">
            {datos.listas.slice(0, 3).map((o) => (
              <li key={o.id}>
                <OrdenCard orden={o} />
              </li>
            ))}
          </ul>
          {datos.listas.length > 3 && (
            <Link
              href="/ordenes?estado=listo"
              className="mt-3 inline-flex items-center gap-1 text-sm text-stone-600 underline decoration-stone-300 underline-offset-4"
            >
              Ver los {datos.listas.length} listos
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}

      {/* ---------- Alertas ---------- */}
      <div>
        <Eyebrow>Requiere atención</Eyebrow>
        <div className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-soft">
          <Link
            href="/garantias"
            className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-stone-50"
          >
            <ShieldCheck className="size-5 shrink-0 text-stone-400" strokeWidth={1.5} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">Garantías por vencer</p>
              <p className="text-[13px] text-stone-500">
                Próximos 7 días · {datos.garantiasVencidas} vencidas en total
              </p>
            </div>
            <span
              className={`font-mono text-xl tabular-nums ${
                datos.garantiasPorVencer > 0 ? "text-ochre-700" : "text-stone-500"
              }`}
            >
              {datos.garantiasPorVencer}
            </span>
            <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden />
          </Link>

          <div>
            <Link
              href="/garantias?semaforo=mantenimiento"
              className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-stone-50"
            >
              <BellRing className="size-5 shrink-0 text-stone-400" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">Mantenimientos preventivos</p>
                <p className="text-[13px] text-stone-500">
                  {datos.mantenimientos.vencidos} vencidos · próximos 15 días
                </p>
              </div>
              <span
                className={`font-mono text-xl tabular-nums ${
                  datos.mantenimientos.vencidos + datos.mantenimientos.proximos > 0
                    ? "text-ochre-700"
                    : "text-stone-400"
                }`}
              >
                {datos.mantenimientos.vencidos + datos.mantenimientos.proximos}
              </span>
              <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden />
            </Link>
            {datos.mantenimientos.lista.length > 0 && (
              <ul className="space-y-2 px-5 pb-4 pl-[3.25rem]">
                {datos.mantenimientos.lista.map((m) => (
                  <li key={m.ordenId} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-stone-600">
                      <span className="font-mono font-semibold tracking-wider text-ink">{m.placa}</span> ·{" "}
                      {m.cliente} ·{" "}
                      <span className={m.dias < 0 ? "text-brick-600" : ""}>
                        {m.dias < 0 ? `venció hace ${Math.abs(m.dias)} d` : m.dias === 0 ? "hoy" : `en ${m.dias} d`}
                      </span>
                    </span>
                    {m.whatsappHref && (
                      <a
                        href={m.whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Recordar mantenimiento a ${m.cliente} por WhatsApp`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-700 text-white active:bg-sage-800"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Link
              href="/inventario?filtro=critico"
              className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-stone-50"
            >
              <Package className="size-5 shrink-0 text-stone-400" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">Stock crítico</p>
                <p className="text-[13px] text-stone-500">Ítems por reponer</p>
              </div>
              <span
                className={`font-mono text-xl tabular-nums ${
                  datos.criticosTotal > 0 ? "text-ochre-700" : "text-stone-400"
                }`}
              >
                {datos.criticosTotal}
              </span>
              <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden />
            </Link>
            {datos.criticos.length > 0 && (
              <ul className="space-y-1.5 px-5 pb-4 pl-[3.25rem] text-[13px]">
                {datos.criticos.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 text-stone-600">
                    <span className="truncate">{i.nombre}</span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {i.tipo_unidad && i.stock_actual !== null
                        ? formatearCantidad(i.stock_actual, i.tipo_unidad)
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Utilidad del mes ---------- */}
      <div className="rounded-2xl bg-ink p-6 text-paper">
        <p className="text-[13px] text-stone-400">Utilidad neta · {datos.mesEtiqueta}</p>
        <p
          className={`mt-2 text-[34px] leading-none font-medium tracking-tight ${
            utilidadNegativa ? "text-brick-300" : ""
          }`}
        >
          <Dinero valor={datos.utilidadMes} />
        </p>
        <Link
          href="/caja-menor?vista=balance"
          className="mt-5 inline-flex items-center gap-1 text-[13px] text-ice-300 underline decoration-ice-300/40 underline-offset-4 transition-colors active:text-white"
        >
          Ver balance completo
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
