/**
 * Transformaciones PURAS de filas de la base a modelos de vista (sin red, sin React).
 * Las usan los cargadores de src/lib/datos y se prueban aparte. Reemplazan a los `as` que había
 * en las páginas: si la forma de una fila cambia, el compilador o la prueba lo avisan.
 */
import type { EdicionHistorial } from "@/components/caja/lista-gastos";
import type { EvidenciaVista } from "@/components/ordenes/galeria-evidencias";
import type { PagoVista } from "@/components/ordenes/pagos-orden";
import type { LineaRepuesto } from "@/components/ordenes/repuestos-orden";
import { autorONull } from "@/lib/autor";
import { redondearDinero } from "@/lib/inventario";
import type { Autor, Json, MedioPago, TipoEvidencia, TipoUnidad } from "@/types/database";

export type MesesMantenimiento = 3 | 6 | 12 | null;

/** Meses de mantenimiento que admite el sistema; cualquier otro valor (o null) → null. */
export function mesesMantenimiento(valor: number | null | undefined): MesesMantenimiento {
  return valor === 3 || valor === 6 || valor === 12 ? valor : null;
}

// ---------------------------------------------------------------------
// Pagos y saldo
// ---------------------------------------------------------------------

type PagoFila = {
  id: string;
  fecha: string;
  monto: number;
  medio: MedioPago;
  es_devolucion: boolean;
  referencia: string | null;
  notas: string | null;
  autor: Autor | null;
  anulado: boolean;
  anulado_motivo: string | null;
  comprobante_url: string | null;
};

export function armarPagos(filas: PagoFila[], urlsFirmadas: Map<string, string>): PagoVista[] {
  return filas.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    monto: p.monto,
    medio: p.medio,
    esDevolucion: p.es_devolucion,
    referencia: p.referencia,
    notas: p.notas,
    autor: p.autor,
    anulado: p.anulado,
    anuladoMotivo: p.anulado_motivo,
    comprobanteUrl: p.comprobante_url ? (urlsFirmadas.get(p.comprobante_url) ?? null) : null,
  }));
}

/** Cobrado neto: suma de abonos menos devoluciones, sin contar pagos anulados. */
export function pagadoNeto(pagos: { monto: number; es_devolucion: boolean; anulado: boolean }[]): number {
  return pagos.reduce((s, p) => (p.anulado ? s : s + (p.es_devolucion ? -p.monto : p.monto)), 0);
}

/** Lo que aún se debe de una orden (nunca negativo). */
export function saldoPendiente(
  totalCobrado: number,
  pagos: { monto: number; es_devolucion: boolean; anulado: boolean }[]
): number {
  return Math.max(0, redondearDinero(totalCobrado - pagadoNeto(pagos)));
}

// ---------------------------------------------------------------------
// Repuestos
// ---------------------------------------------------------------------

type RepuestoFila = {
  id: string;
  cantidad_usada: number;
  costo_unitario: number;
  precio_unitario: number;
  inventario: { nombre: string; codigo: string; tipo_unidad: TipoUnidad } | null;
};

export function armarLineas(filas: RepuestoFila[]): LineaRepuesto[] {
  return filas.flatMap((r) =>
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
}

/** Totales de repuestos de una orden: lo que se cobra (precio) y lo que costó (costo). */
export function totalesRepuestos(filas: { cantidad_usada: number; costo_unitario: number; precio_unitario: number }[]) {
  return {
    precio: redondearDinero(filas.reduce((s, r) => s + r.cantidad_usada * r.precio_unitario, 0)),
    costo: redondearDinero(filas.reduce((s, r) => s + r.cantidad_usada * r.costo_unitario, 0)),
  };
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------

type EvidenciaFila = {
  id: string;
  tipo: TipoEvidencia;
  notas: string | null;
  url_imagen: string;
  created_at: string;
  /** Ausente si aún no se ejecutó la migración de la fase 5. */
  orden_repuesto_id?: string | null;
};

export function armarEvidencias(filas: EvidenciaFila[], urlsFirmadas: Map<string, string>): EvidenciaVista[] {
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    notas: f.notas,
    created_at: f.created_at,
    orden_repuesto_id: f.orden_repuesto_id ?? null,
    url: urlsFirmadas.get(f.url_imagen) ?? null,
  }));
}

// ---------------------------------------------------------------------
// Historial de ediciones de un gasto (columna jsonb)
// ---------------------------------------------------------------------

/** Valida la forma del jsonb `historial`: descarta entradas que no traigan al menos una fecha. */
export function edicionesHistorial(valor: Json): EdicionHistorial[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((e) => {
    if (typeof e !== "object" || e === null || Array.isArray(e) || typeof e.at !== "string") return [];
    const antes = e.antes;
    return [
      {
        at: e.at,
        por: typeof e.por === "string" ? e.por : null,
        autor: autorONull(e.autor),
        antes: typeof antes === "object" && antes !== null && !Array.isArray(antes) ? antes : undefined,
      },
    ];
  });
}

// ---------------------------------------------------------------------
// Comprobante (orden y garantía impresa)
// ---------------------------------------------------------------------

export type LineaComprobante = {
  nombre: string;
  cantidad: number;
  unidad: TipoUnidad;
  precio: number;
  subtotal: number;
};

/**
 * Cifras del comprobante de una orden: líneas de repuestos con su subtotal, total de repuestos,
 * «ajuste» (lo que falta o sobra entre el total cobrado y mano de obra + repuestos: otros cargos
 * o descuento), lo pagado (abonos menos devoluciones) y el saldo.
 */
export function armarComprobante(
  orden: { total_cobrado: number; mano_obra: number },
  repuestos: { cantidad_usada: number; precio_unitario: number; inventario: { nombre: string; tipo_unidad: TipoUnidad } | null }[],
  pagos: { monto: number; es_devolucion: boolean }[]
) {
  const lineas: LineaComprobante[] = repuestos.flatMap((r) =>
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
  const pagado = redondearDinero(pagos.reduce((s, p) => s + (p.es_devolucion ? -p.monto : p.monto), 0));
  return {
    lineas,
    totalRepuestos,
    ajuste: redondearDinero(orden.total_cobrado - orden.mano_obra - totalRepuestos),
    pagado,
    saldo: redondearDinero(orden.total_cobrado - pagado),
  };
}
