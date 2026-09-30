/**
 * Operaciones que se pueden registrar SIN conexión y sincronizar después.
 *
 * Diseño de idempotencia: cada registro nace con un UUID generado en el teléfono
 * (`id`). Si la sincronización se repite (corte de red a mitad, doble envío),
 * el servidor detecta el id duplicado y lo trata como "ya hecho" en vez de duplicar.
 *
 * Módulo puro (sin acceso a red, IndexedDB ni servidor): se comparte entre el
 * cliente (cola) y el servidor (validación) y tiene pruebas unitarias.
 */
import { CATEGORIAS } from "@/lib/caja";
import { autorONull } from "@/lib/autor";
import { esEstado, esTipoEvidencia, esUuid } from "@/lib/ordenes";
import type {
  Autor,
  CategoriaGasto,
  EstadoOrden,
  MedioPago,
  Pertenencias,
  TipoEvidencia,
} from "@/types/database";

export const MEDIOS_PAGO: MedioPago[] = ["efectivo", "transferencia", "tarjeta", "otro"];

export type DatosGasto = {
  id: string;
  fecha: string; // YYYY-MM-DD
  monto: number;
  categoria: CategoriaGasto;
  descripcion: string | null;
  orden_id: string | null;
  autor: Autor | null;
};

export type DatosPago = {
  id: string;
  orden_id: string;
  fecha: string;
  monto: number;
  medio: MedioPago;
  es_devolucion: boolean;
  referencia: string | null;
  notas: string | null;
  autor: Autor | null;
};

export type DatosVehiculoOrden =
  | { nuevo: false; id: string }
  | {
      nuevo: true;
      id: string;
      cliente_id: string;
      cliente_nombre: string;
      cliente_telefono: string;
      placa: string;
      marca: string;
      modelo: string;
      anio: number | null;
    };

export type DatosOrden = {
  id: string;
  vehiculo: DatosVehiculoOrden;
  kilometraje: number | null;
  diagnostico_inicial: string | null;
  trabajos_a_realizar: string | null;
  mano_obra: number;
  total_cobrado: number;
  dias_garantia: number;
  estado: EstadoOrden;
  pertenencias: Pertenencias | null;
  mantenimiento_meses: 3 | 6 | 12 | null;
  autor: Autor | null;
};

export type DatosEvidencia = {
  id: string;
  orden_id: string;
  tipo: TipoEvidencia;
  extension: "webp" | "jpg";
  notas: string | null;
};

/** `conArchivo`: la operación trae una imagen adjunta (comprobante / evidencia). */
export type Operacion =
  | { tipo: "gasto.crear"; datos: DatosGasto; conArchivo?: boolean; extension?: "webp" | "jpg" }
  | { tipo: "pago.crear"; datos: DatosPago; conArchivo?: boolean; extension?: "webp" | "jpg" }
  | { tipo: "orden.crear"; datos: DatosOrden }
  | { tipo: "evidencia.subir"; datos: DatosEvidencia; conArchivo: true };

export type TipoOperacion = Operacion["tipo"];

export function nuevoId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------
// Validación (el servidor NUNCA confía en lo que llega de la cola)
// ---------------------------------------------------------------------

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string };

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONTO = 9_999_999_999;

function esFecha(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function esMonto(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_MONTO;
}

function textoONull(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function extensionValida(v: unknown): "webp" | "jpg" | undefined {
  return v === "webp" || v === "jpg" ? v : undefined;
}

export function validarOperacion(entrada: unknown): Validacion<Operacion> {
  if (!obj(entrada) || typeof entrada.tipo !== "string" || !obj(entrada.datos)) {
    return { ok: false, error: "Operación inválida." };
  }
  const d = entrada.datos;

  switch (entrada.tipo) {
    case "gasto.crear": {
      if (!esUuid(String(d.id))) return { ok: false, error: "Gasto inválido (id)." };
      if (!esFecha(d.fecha)) return { ok: false, error: "Fecha inválida." };
      if (!esMonto(d.monto)) return { ok: false, error: "El monto debe ser mayor a 0." };
      if (!(CATEGORIAS as string[]).includes(String(d.categoria))) {
        return { ok: false, error: "Categoría inválida." };
      }
      if (d.orden_id != null && !esUuid(String(d.orden_id))) {
        return { ok: false, error: "Orden asociada inválida." };
      }
      return {
        ok: true,
        valor: {
          tipo: "gasto.crear",
          conArchivo: entrada.conArchivo === true,
          extension: extensionValida(entrada.extension),
          datos: {
            id: String(d.id),
            fecha: d.fecha,
            monto: Math.round(d.monto * 100) / 100,
            categoria: d.categoria as CategoriaGasto,
            descripcion: textoONull(d.descripcion),
            orden_id: d.orden_id == null ? null : String(d.orden_id),
            autor: autorONull(d.autor),
          },
        },
      };
    }

    case "pago.crear": {
      if (!esUuid(String(d.id)) || !esUuid(String(d.orden_id))) {
        return { ok: false, error: "Pago inválido (id u orden)." };
      }
      if (!esFecha(d.fecha)) return { ok: false, error: "Fecha inválida." };
      if (!esMonto(d.monto)) return { ok: false, error: "El monto debe ser mayor a 0." };
      if (!(MEDIOS_PAGO as string[]).includes(String(d.medio))) {
        return { ok: false, error: "Medio de pago inválido." };
      }
      return {
        ok: true,
        valor: {
          tipo: "pago.crear",
          conArchivo: entrada.conArchivo === true,
          extension: extensionValida(entrada.extension),
          datos: {
            id: String(d.id),
            orden_id: String(d.orden_id),
            fecha: d.fecha,
            monto: Math.round(d.monto * 100) / 100,
            medio: d.medio as MedioPago,
            es_devolucion: d.es_devolucion === true,
            referencia: textoONull(d.referencia, 120),
            notas: textoONull(d.notas),
            autor: autorONull(d.autor),
          },
        },
      };
    }

    case "evidencia.subir": {
      if (!esUuid(String(d.id)) || !esUuid(String(d.orden_id))) {
        return { ok: false, error: "Evidencia inválida (id u orden)." };
      }
      if (!esTipoEvidencia(d.tipo)) return { ok: false, error: "Tipo de foto inválido." };
      const extension = extensionValida(d.extension);
      if (!extension) return { ok: false, error: "Formato de imagen inválido." };
      return {
        ok: true,
        valor: {
          tipo: "evidencia.subir",
          conArchivo: true,
          datos: {
            id: String(d.id),
            orden_id: String(d.orden_id),
            tipo: d.tipo,
            extension,
            notas: textoONull(d.notas),
          },
        },
      };
    }

    case "orden.crear": {
      if (!esUuid(String(d.id))) return { ok: false, error: "Orden inválida (id)." };
      if (!obj(d.vehiculo) || !esUuid(String(d.vehiculo.id))) {
        return { ok: false, error: "Vehículo inválido." };
      }
      const v = d.vehiculo;
      let vehiculo: DatosVehiculoOrden;
      if (v.nuevo === true) {
        if (!esUuid(String(v.cliente_id))) return { ok: false, error: "Cliente inválido (id)." };
        vehiculo = {
          nuevo: true,
          id: String(v.id),
          cliente_id: String(v.cliente_id),
          cliente_nombre: textoONull(v.cliente_nombre, 120) ?? "",
          cliente_telefono: typeof v.cliente_telefono === "string" ? v.cliente_telefono : "",
          placa: typeof v.placa === "string" ? v.placa : "",
          marca: textoONull(v.marca, 60) ?? "",
          modelo: textoONull(v.modelo, 60) ?? "",
          anio: typeof v.anio === "number" && Number.isInteger(v.anio) ? v.anio : null,
        };
      } else {
        vehiculo = { nuevo: false, id: String(v.id) };
      }

      const estado = d.estado ?? "recibido";
      if (!esEstado(estado)) return { ok: false, error: "Estado inválido." };
      const num = (x: unknown, def = 0) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : def);
      const meses = d.mantenimiento_meses;

      return {
        ok: true,
        valor: {
          tipo: "orden.crear",
          datos: {
            id: String(d.id),
            vehiculo,
            kilometraje:
              typeof d.kilometraje === "number" && Number.isInteger(d.kilometraje) && d.kilometraje >= 0
                ? d.kilometraje
                : null,
            diagnostico_inicial: textoONull(d.diagnostico_inicial, 4000),
            trabajos_a_realizar: textoONull(d.trabajos_a_realizar, 4000),
            mano_obra: num(d.mano_obra),
            total_cobrado: num(d.total_cobrado),
            dias_garantia: num(d.dias_garantia),
            estado,
            pertenencias: pertenenciasONull(d.pertenencias),
            mantenimiento_meses: meses === 3 || meses === 6 || meses === 12 ? meses : null,
            autor: autorONull(d.autor),
          },
        },
      };
    }

    default:
      return { ok: false, error: `Tipo de operación desconocido: ${entrada.tipo}` };
  }
}

export function pertenenciasONull(v: unknown): Pertenencias | null {
  if (!obj(v)) return null;
  const carroceria = v.carroceria === "rayones" || v.carroceria === "golpes" ? v.carroceria : "sin_danos";
  return {
    carroceria,
    llanta_repuesto: v.llanta_repuesto === true,
    herramientas: v.herramientas === true,
    documentos: v.documentos === true,
    objetos_valor: textoONull(v.objetos_valor, 300) ?? "",
    notas: textoONull(v.notas, 500) ?? "",
  };
}

// ---------------------------------------------------------------------
// Descripción legible (lista de pendientes)
// ---------------------------------------------------------------------

const moneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function describirOperacion(op: Operacion): string {
  switch (op.tipo) {
    case "gasto.crear":
      return `Gasto ${moneda.format(op.datos.monto)}${op.conArchivo ? " · con recibo" : ""}`;
    case "pago.crear":
      return `${op.datos.es_devolucion ? "Devolución" : "Abono"} ${moneda.format(op.datos.monto)} (${op.datos.medio})`;
    case "orden.crear":
      return op.datos.vehiculo.nuevo
        ? `Orden nueva · ${op.datos.vehiculo.placa.toUpperCase()}`
        : "Orden nueva";
    case "evidencia.subir":
      return `Foto (${op.datos.tipo.replace("_", " ")})`;
  }
}

/** Errores transitorios de conexión/recursos en la base: se reintentan, no se marcan como fallidos. */
export function esErrorTransitorio(codigo: string | undefined): boolean {
  return !!codigo && (codigo.startsWith("08") || codigo.startsWith("53") || codigo === "57014");
}
