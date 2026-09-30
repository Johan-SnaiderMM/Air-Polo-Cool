/**
 * Esquemas del inventario (formularios: los números llegan como texto). Las reglas que dependen de
 * la base de datos (¿existe el ítem?, ¿qué unidad tiene?) siguen en las acciones.
 */
import { z } from "zod";
import { campo, numeroDeTexto, textoObligatorio, textoOpcional } from "@/lib/esquemas/comunes";
import { admiteDecimales, esTipoUnidad } from "@/lib/inventario";

const MSG_STOCK = "El stock debe ser un número mayor o igual a 0.";
const MSG_PRECIOS = "Los precios deben ser valores mayores o iguales a 0.";
const noNegativo = (n: number) => n >= 0;

const codigo = () => textoObligatorio("Ingresa el código del ítem.", 100);
const nombre = () => textoObligatorio("Ingresa el nombre del ítem.", 200);
const costo = () => numeroDeTexto(MSG_PRECIOS, 0, noNegativo);
const precio = () => numeroDeTexto(MSG_PRECIOS, 0, noNegativo);

export const crearItemSchema = z
  .object({
    codigo: codigo(),
    nombre: nombre(),
    tipo_unidad: campo((v) => {
      const t = typeof v === "string" && v.trim() !== "" ? v.trim() : "unidad";
      return esTipoUnidad(t) ? t : undefined;
    }, "Unidad de medida inválida."),
    stock_actual: numeroDeTexto(MSG_STOCK, 0, noNegativo),
    stock_minimo: numeroDeTexto(MSG_STOCK, 0, noNegativo),
    costo_compra: costo(),
    precio_venta: precio(),
    descripcion: textoOpcional(1000),
  })
  .refine(
    (d) => admiteDecimales(d.tipo_unidad) || (Number.isInteger(d.stock_actual) && Number.isInteger(d.stock_minimo)),
    { error: "Las unidades físicas deben ser cantidades enteras." }
  );

export const editarItemSchema = z.object({
  inventario_id: campo((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), "Ítem inválido."),
  codigo: codigo(),
  nombre: nombre(),
  stock_minimo: numeroDeTexto("El stock mínimo debe ser un número mayor o igual a 0.", 0, noNegativo),
  costo_compra: costo(),
  precio_venta: precio(),
  descripcion: textoOpcional(1000),
});

export const ajustarStockSchema = z.object({
  inventario_id: campo((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), "Ítem inválido."),
  cantidad: campo((v) => {
    const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, "Ingresa una cantidad mayor a 0."),
  costo_compra: numeroDeTexto("El costo de compra debe ser mayor o igual a 0.", null, noNegativo),
});
