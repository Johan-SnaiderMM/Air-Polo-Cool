import type { Metadata } from "next";
import Image from "next/image";
import { agruparPorRepuesto } from "@/lib/fotos-repuesto";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CarFront,
  Check,
  Hourglass,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ImprimirPortal } from "@/components/print/imprimir-portal";
import { createPublicClient } from "@/utils/supabase/public";
import { createAdminClient } from "@/utils/supabase/admin";
import { hoyBogota } from "@/lib/caja";
import { redondearDinero, formatearCantidad } from "@/lib/inventario";
import {
  ESTADO_LABEL,
  formatearFecha,
  formatearFechaDate,
} from "@/lib/ordenes";
import {
  GaleriaPortal,
  type FotoPortal,
  type SeccionGaleria,
} from "@/components/portal/galeria-portal";
import type { EstadoOrden, OrdenPublica, SemaforoGarantia, TipoEvidencia } from "@/types/database";

import { Dinero } from "@/components/ui/dinero";
import { BUCKET_EVIDENCIAS, VIGENCIA_URL_PORTAL_SEGUNDOS } from "@/lib/almacenamiento";
// Página pública: sin cookies ni sesión. Nunca cachear (URLs firmadas con caducidad).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estado de tu servicio",
  description: "Consulta el estado, las fotos y la garantía de tu vehículo en Polo Air Cool.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** Tokens de 22 caracteres base64url; se acota para rechazar basura antes de tocar la BD. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

const PASOS: EstadoOrden[] = ["recibido", "diagnostico", "en_proceso", "listo", "entregado"];

const DESCRIPCION_ESTADO: Record<EstadoOrden, string> = {
  recibido: "Recibimos tu vehículo y lo registramos en el taller.",
  diagnostico: "Estamos revisando el sistema de aire acondicionado.",
  en_proceso: "Estamos realizando la reparación.",
  listo: "Tu vehículo está listo para entrega.",
  entregado: "Servicio entregado. ¡Gracias por confiar en nosotros!",
  cancelado: "Servicio cancelado.",
};

const ETIQUETA_TIPO: Record<Exclude<TipoEvidencia, "factura_compra">, string> = {
  ingreso: "Estado al ingreso",
  repuesto_viejo: "Repuesto retirado",
  repuesto_nuevo: "Repuesto instalado",
  prueba_tecnica: "Prueba técnica",
};

const SEMAFORO = {
  verde: {
    titulo: "Garantía vigente",
    caja: "border-sage-300 bg-sage-50",
    insignia: "bg-sage-600 text-white",
    icono: ShieldCheck,
  },
  amarillo: {
    titulo: "Garantía por vencer",
    caja: "border-ochre-300 bg-ochre-50",
    insignia: "bg-ochre-500 text-white",
    icono: Hourglass,
  },
  rojo: {
    titulo: "Garantía vencida",
    caja: "border-brick-300 bg-brick-50",
    insignia: "bg-brick-600 text-white",
    icono: ShieldAlert,
  },
} satisfies Record<SemaforoGarantia, object>;

function diasHasta(fecha: string): number {
  const dia = 86_400_000;
  return Math.round(
    (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoyBogota()}T00:00:00Z`)) / dia
  );
}

async function firmarFotos(evidencias: OrdenPublica["evidencias"]) {
  // Defensa en profundidad: la RPC ya excluye las facturas de proveedor; aquí también.
  const visibles = evidencias.filter((e) => (e.tipo as string) !== "factura_compra");
  const admin = createAdminClient();
  if (!admin || visibles.length === 0) {
    return { visibles, urls: new Map<string, string>(), sinClave: !admin && visibles.length > 0 };
  }

  const { data } = await admin.storage
    .from(BUCKET_EVIDENCIAS)
    .createSignedUrls(
      visibles.map((e) => e.url_imagen),
      VIGENCIA_URL_PORTAL_SEGUNDOS
    );

  const urls = new Map<string, string>();
  for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  return { visibles, urls, sinClave: false };
}

export default async function PortalOrdenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { data, error } = await createPublicClient().rpc("obtener_orden_publica", {
    p_token: token,
  });
  if (error) console.error("[portal] obtener_orden_publica:", error.message);
  if (error || !data) notFound();

  const { orden, cliente, vehiculo, repuestos, evidencias } = data;

  // ---------- Fotos ----------
  const { visibles, urls, sinClave } = await firmarFotos(evidencias);
  if (sinClave) {
    console.warn("[portal] SUPABASE_SERVICE_ROLE_KEY no configurada: no se pueden firmar fotos.");
  }

  const aFoto = (e: (typeof visibles)[number], etiqueta: string): FotoPortal[] => {
    const url = urls.get(e.url_imagen);
    return url ? [{ url, alt: `${etiqueta} · ${vehiculo.placa}`, notas: e.notas }] : [];
  };
  const fotosDe = (lista: typeof visibles, tipo: keyof typeof ETIQUETA_TIPO): FotoPortal[] =>
    lista.filter((e) => e.tipo === tipo).flatMap((e) => aFoto(e, ETIQUETA_TIPO[tipo]));

  // Fase 5: las fotos de repuesto ligadas a su repuesto se muestran pieza por pieza;
  // el resto (sin asignar, ingreso, pruebas) se agrupa por tipo como antes.
  const { grupos, sueltas } = agruparPorRepuesto(visibles, repuestos);
  const ingreso = fotosDe(sueltas, "ingreso");
  const viejo = fotosDe(sueltas, "repuesto_viejo");
  const nuevo = fotosDe(sueltas, "repuesto_nuevo");
  const pruebas = fotosDe(sueltas, "prueba_tecnica");

  const secciones: SeccionGaleria[] = [];
  if (ingreso.length > 0) {
    secciones.push({
      titulo: "Al ingreso",
      descripcion: "Así recibimos tu vehículo.",
      columnas: [{ titulo: "Ingreso", tono: "neutro", fotos: ingreso }],
    });
  }
  grupos.forEach(({ repuesto, retirado, instalado }, i) => {
    secciones.push({
      titulo: repuesto.nombre,
      descripcion: i === 0 ? "Cada repuesto: el que retiramos y el nuevo que instalamos." : undefined,
      columnas: [
        {
          titulo: "Retirado",
          tono: "rojo",
          fotos: retirado.flatMap((e) => aFoto(e, `Retirado: ${repuesto.nombre}`)),
        },
        {
          titulo: "Instalado",
          tono: "verde",
          fotos: instalado.flatMap((e) => aFoto(e, `Instalado: ${repuesto.nombre}`)),
        },
      ],
    });
  });
  if (viejo.length > 0 || nuevo.length > 0) {
    secciones.push({
      titulo: grupos.length > 0 ? "Otros repuestos" : "Antes y después",
      descripcion: "Comparativa del repuesto retirado y el nuevo instalado.",
      columnas: [
        { titulo: "Retirado", tono: "rojo", fotos: viejo },
        { titulo: "Instalado", tono: "verde", fotos: nuevo },
      ],
    });
  }
  if (pruebas.length > 0) {
    secciones.push({
      titulo: "Pruebas técnicas",
      descripcion: "Vacío, presiones y temperatura en el difusor.",
      columnas: [{ titulo: "Pruebas", tono: "neutro", fotos: pruebas }],
    });
  }

  // ---------- Garantía ----------
  const fin = orden.fecha_fin_garantia;
  const restantes = fin ? diasHasta(fin) : null;
  const semaforo = orden.garantia_semaforo;

  // ---------- Pago ----------
  const totalRepuestos = redondearDinero(
    repuestos.reduce((s, r) => s + r.cantidad * r.precio_unitario, 0)
  );
  const ajuste = redondearDinero(orden.total_cobrado - orden.mano_obra - totalRepuestos);
  const entregado = orden.estado === "entregado";

  const pasoActual = PASOS.indexOf(orden.estado);

  return (
    <div className="min-h-dvh bg-paper print:bg-white">
      {/* ---------- Marca ---------- */}
      <header className="border-b border-stone-200/60 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={36} height={36} priority className="size-9 rounded-full" />
            <p className="font-serif text-2xl leading-none font-medium tracking-tight">
              Polo Air Cool
            </p>
          </div>
          <p className="text-[12px] tracking-wide text-stone-500">Aire acondicionado automotriz</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="px-1 pt-1">
          <p className="text-[13px] text-stone-500">Estado de tu servicio</p>
          <p className="font-serif text-[32px] leading-tight font-medium tracking-tight">
            Hola, {cliente.nombre.trim().split(/\s+/)[0]}
          </p>
        </div>

        {/* ---------- Vehículo y estado ---------- */}
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-stone-500">
                <CarFront className="size-4" aria-hidden /> Tu vehículo
              </p>
              <p className="mt-1 text-lg font-semibold">
                {vehiculo.marca} {vehiculo.modelo}
                {vehiculo.anio ? ` ${vehiculo.anio}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-ink px-3 py-1.5 font-mono text-xl font-semibold tracking-widest text-white">
              {vehiculo.placa}
            </span>
          </div>

          <div className="mt-5">
            <p className="text-sm text-stone-500">Estado del servicio</p>
            <p className="text-xl font-semibold text-ink">{ESTADO_LABEL[orden.estado]}</p>
            <p className="text-sm text-stone-600">{DESCRIPCION_ESTADO[orden.estado]}</p>

            {pasoActual >= 0 && (
              <ol className="mt-4 flex items-center" aria-label="Progreso del servicio">
                {PASOS.map((paso, i) => {
                  const hecho = i < pasoActual || (i === pasoActual && paso === "entregado");
                  const activo = i === pasoActual;
                  return (
                    <li
                      key={paso}
                      aria-current={activo ? "step" : undefined}
                      className="flex flex-1 flex-col items-center gap-1 first:items-start last:items-end"
                    >
                      <div className="flex w-full items-center">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            hecho
                              ? "bg-ink text-white"
                              : activo
                                ? "bg-ink text-white ring-4 ring-stone-300"
                                : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          {hecho ? <Check className="size-4" aria-hidden /> : i + 1}
                        </span>
                        {i < PASOS.length - 1 && (
                          <span
                            className={`h-1 flex-1 ${i < pasoActual ? "bg-ink" : "bg-stone-200"}`}
                          />
                        )}
                      </div>
                      <span
                        className={`text-[10px] leading-tight ${
                          activo ? "font-semibold text-ink" : "text-stone-500"
                        }`}
                      >
                        {ESTADO_LABEL[paso]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="mt-4 flex items-center gap-2 text-xs text-stone-500">
              <CalendarClock className="size-4" aria-hidden />
              Ingreso: {formatearFecha(orden.fecha_ingreso)}
              {orden.fecha_entrega && ` · Entrega: ${formatearFecha(orden.fecha_entrega)}`}
            </p>
          </div>
        </section>

        {/* ---------- Garantía digital ---------- */}
        <section
          aria-labelledby="titulo-garantia"
          className={`rounded-2xl border-2 p-5 ${
            semaforo && fin ? SEMAFORO[semaforo].caja : "border-stone-200/70 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="titulo-garantia" className="flex items-center gap-2 font-serif text-xl font-medium tracking-tight">
              <BadgeCheck className="size-5" aria-hidden /> Certificado de garantía digital
            </h2>
          </div>

          {orden.dias_garantia === 0 ? (
            <p className="mt-3 text-sm text-stone-600">
              Este servicio no tiene garantía asignada.
            </p>
          ) : !fin || !semaforo ? (
            <div className="mt-3 space-y-1">
              <p className="text-3xl font-semibold">{orden.dias_garantia} días</p>
              <p className="text-sm text-stone-600">
                de garantía. Empiezan a contar desde el día de la entrega del vehículo.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {(() => {
                const s = SEMAFORO[semaforo];
                const Icono = s.icono;
                return (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${s.insignia}`}
                  >
                    <Icono className="size-4" aria-hidden />
                    {s.titulo}
                  </span>
                );
              })()}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/70 p-3">
                  <dt className="text-xs text-stone-500">Días otorgados</dt>
                  <dd className="text-xl font-semibold">{orden.dias_garantia}</dd>
                </div>
                <div className="rounded-xl bg-white/70 p-3">
                  <dt className="text-xs text-stone-500">Vence el</dt>
                  <dd className="font-mono text-lg font-medium tabular-nums">{formatearFechaDate(fin)}</dd>
                </div>
              </dl>

              {restantes !== null && (
                <p className="text-sm font-medium">
                  {restantes < 0
                    ? `Venció hace ${Math.abs(restantes)} ${Math.abs(restantes) === 1 ? "día" : "días"}.`
                    : restantes === 0
                      ? "Vence hoy."
                      : `Te quedan ${restantes} ${restantes === 1 ? "día" : "días"} de garantía.`}
                </p>
              )}
              <p className="text-xs text-stone-500">
                Vehículo {vehiculo.placa} · {vehiculo.marca} {vehiculo.modelo}
              </p>
            </div>
          )}
        </section>

        {/* ---------- Fotos ---------- */}
        {secciones.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="mb-4 font-serif text-xl font-medium tracking-tight">Fotos del trabajo</h2>
            <GaleriaPortal secciones={secciones} />
          </section>
        )}

        {/* ---------- Repuestos ---------- */}
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-medium tracking-tight">
            <Wrench className="size-5" aria-hidden /> Repuestos e insumos
          </h2>
          {repuestos.length === 0 ? (
            <p className="text-sm text-stone-500">Aún no se han registrado repuestos.</p>
          ) : (
            <ul className="divide-y divide-stone-200/70">
              {repuestos.map((r, i) => (
                <li key={`${r.nombre}-${i}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.nombre}</p>
                    <p className="text-sm text-stone-500">
                      {formatearCantidad(r.cantidad, r.unidad)} ×{" "}
                      <Dinero valor={r.precio_unitario} />
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    <Dinero valor={redondearDinero(r.cantidad * r.precio_unitario)} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Resumen de pago ---------- */}
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="mb-3 font-serif text-xl font-medium tracking-tight">Resumen de pago</h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-stone-600">Mano de obra</dt>
              <dd className="font-semibold"><Dinero valor={orden.mano_obra} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">+ Repuestos e insumos</dt>
              <dd className="font-semibold"><Dinero valor={totalRepuestos} /></dd>
            </div>
            {ajuste !== 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-600">{ajuste > 0 ? "+ Otros cargos" : "− Descuento"}</dt>
                <dd className="font-semibold"><Dinero valor={Math.abs(ajuste)} /></dd>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
              <dt className="font-semibold">
                {orden.pagado === undefined ? (entregado ? "Total cancelado" : "Total a cancelar") : "Total"}
              </dt>
              <dd className="text-2xl font-semibold"><Dinero valor={orden.total_cobrado} /></dd>
            </div>
            {orden.pagado !== undefined && orden.total_cobrado > 0 && (
              <>
                <div className="flex justify-between pt-1">
                  <dt className="text-stone-600">Abonado</dt>
                  <dd className="font-semibold"><Dinero valor={orden.pagado} /></dd>
                </div>
                <div
                  className={`flex justify-between rounded-lg px-3 py-2 ${
                    (orden.saldo ?? 0) > 0 ? "bg-ochre-50 text-ochre-800" : "bg-sage-50 text-sage-800"
                  }`}
                >
                  <dt className="font-semibold">{(orden.saldo ?? 0) > 0 ? "Saldo pendiente" : "Pagado en su totalidad"}</dt>
                  <dd className="font-semibold">
                    {(orden.saldo ?? 0) > 0 ? <Dinero valor={orden.saldo ?? 0} /> : "✓"}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <ImprimirPortal />

        <footer className="pt-2 text-center text-xs text-stone-500">
          <p className="font-semibold text-stone-600">Polo Air Cool</p>
          <p>Gracias por confiar en nosotros.</p>
        </footer>
      </main>
    </div>
  );
}
