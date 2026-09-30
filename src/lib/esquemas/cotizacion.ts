/**
 * Esquemas de cotización: ítems, formulario y selección de vehículo. Las reglas de cada dato
 * (cantidad, precio, vigencia…) están aquí; la pantalla solo envía lo que el usuario escribió y el
 * servidor las aplica (nunca se confía en el navegador).
 */
import { z } from "zod";
import { autorSchema, campo, MAX_MONTO, numeroDeTexto, textoONull } from "@/lib/esquemas/comunes";
import { camposVehiculoNuevoSchema } from "@/lib/esquemas/vehiculo";
import { esUuid } from "@/lib/ordenes";

export const MAX_ITEMS = 60;
export const VIGENCIAS_DIAS = [7, 15, 30] as const;

const aNumero = (v: unknown) => Number(v);
const redondear = (n: number, decimales: number) => Math.round(n * 10 ** decimales) / 10 ** decimales;

// ---------------------------------------------------------------------
// Ítem
// ---------------------------------------------------------------------
/**
 * Un ítem de la cotización. Los mensajes de error los arma `itemsCotizacionSchema`, que conoce
 * el número del ítem y su descripción; aquí cada campo solo dice si sirve.
 */
export const itemCotizacionSchema = z.object({
  descripcion: campo((v) => textoONull(v, 200) ?? undefined, "descripcion"),
  /** Hasta 3 decimales (insumos a granel). */
  cantidad: campo((v) => {
    const n = aNumero(v);
    return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? redondear(n, 3) : undefined;
  }, "cantidad"),
  precio_unitario: campo((v) => {
    const n = aNumero(v);
    return Number.isFinite(n) && n >= 0 && n <= MAX_MONTO ? redondear(n, 2) : undefined;
  }, "precio_unitario"),
  /** Costo estimado (para el margen interno; no se muestra al cliente). */
  costo_unitario: campo((v) => {
    const n = v === undefined ? 0 : aNumero(v);
    return Number.isFinite(n) && n >= 0 && n <= MAX_MONTO ? redondear(n, 2) : undefined;
  }, "costo_unitario"),
  /** Un id que no sea UUID se descarta (el ítem queda como «libre»), no se rechaza. */
  inventario_id: z.unknown().optional().transform((v) => (typeof v === "string" && esUuid(v) ? v : null)),
});

export type ItemCotizacion = z.output<typeof itemCotizacionSchema>;

const MENSAJE_ITEM: Record<string, (n: number, descripcion: string) => string> = {
  descripcion: (n) => `El ítem ${n} no tiene descripción.`,
  cantidad: (_n, d) => `Cantidad inválida en "${d}".`,
  precio_unitario: (_n, d) => `Precio inválido en "${d}".`,
  costo_unitario: (_n, d) => `Costo inválido en "${d}".`,
};

/** Lista de ítems (llega como JSON del formulario): máximo 60, cada uno válido; el error nombra el ítem. */
export const itemsCotizacionSchema = z.unknown().transform((entrada, ctx): ItemCotizacion[] => {
  const falla = (message: string) => {
    ctx.issues.push({ code: "custom", message, input: entrada });
    return z.NEVER;
  };
  if (!Array.isArray(entrada)) return falla("Los ítems no tienen un formato válido.");
  if (entrada.length > MAX_ITEMS) return falla(`Máximo ${MAX_ITEMS} ítems por cotización.`);

  const items: ItemCotizacion[] = [];
  for (const [i, crudo] of entrada.entries()) {
    if (!crudo || typeof crudo !== "object") return falla(`Ítem ${i + 1} inválido.`);
    const r = itemCotizacionSchema.safeParse(crudo);
    if (!r.success) {
      const campoMalo = String(r.error.issues[0]?.path[0]);
      const descripcion = textoONull((crudo as { descripcion?: unknown }).descripcion, 200) ?? "";
      return falla(MENSAJE_ITEM[campoMalo]?.(i + 1, descripcion) ?? `Ítem ${i + 1} inválido.`);
    }
    items.push(r.data);
  }
  return items;
});

// ---------------------------------------------------------------------
// Formulario (crear y editar): los valores llegan como texto
// ---------------------------------------------------------------------
export const cotizacionFormSchema = z
  .object({
    items: itemsCotizacionSchema,
    mano_obra: numeroDeTexto("La mano de obra debe ser un valor mayor o igual a 0.", 0, (n) => n >= 0 && n <= MAX_MONTO),
    vigencia_dias: campo((v) => {
      const n = v == null || v === "" ? 15 : aNumero(v);
      return VIGENCIAS_DIAS.find((d) => d === n);
    }, "Vigencia inválida."),
    notas: z.unknown().optional().transform((v) => (typeof v === "string" ? v.trim().slice(0, 1000) || null : null)),
    autor: autorSchema,
  })
  .refine((d) => d.items.length > 0 || d.mano_obra > 0, { error: "Agrega al menos un ítem o la mano de obra." });

export type CotizacionForm = z.output<typeof cotizacionFormSchema>;

// ---------------------------------------------------------------------
// Vehículo elegido en el formulario (solo al crear)
// ---------------------------------------------------------------------
const MSG_SELECCIONA = "Selecciona un vehículo o registra uno nuevo.";

export type SeleccionVehiculoCotizacion =
  | { nuevo: false; id: string }
  | ({ nuevo: true } & z.output<typeof camposVehiculoNuevoSchema>);

/**
 * `{ modo: "existente", vehiculo: { id } }` o `{ modo: "nuevo", datos: {...} }` tal como lo manda el
 * selector. Un vehículo nuevo se valida con las mismas reglas que al crear una orden.
 */
export const seleccionVehiculoSchema = z.unknown().transform((valor, ctx): SeleccionVehiculoCotizacion => {
  const falla = (message: string) => {
    ctx.issues.push({ code: "custom", message, input: valor });
    return z.NEVER;
  };
  if (typeof valor !== "object" || valor === null) return falla(MSG_SELECCIONA);
  const sel = valor as { modo?: unknown; vehiculo?: { id?: unknown } | null; datos?: unknown };

  if (sel.modo === "existente") {
    const id = sel.vehiculo?.id;
    return typeof id === "string" && esUuid(id) ? { nuevo: false, id } : falla(MSG_SELECCIONA);
  }
  if (sel.modo === "nuevo") {
    const r = camposVehiculoNuevoSchema.safeParse(sel.datos);
    return r.success ? { nuevo: true, ...r.data } : falla(r.error.issues[0]?.message ?? MSG_SELECCIONA);
  }
  return falla(MSG_SELECCIONA);
});
