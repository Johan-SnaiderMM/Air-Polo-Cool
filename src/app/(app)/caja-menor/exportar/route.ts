import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { CATEGORIA_LABEL, normalizarMes, rangoMes } from "@/lib/caja";
import { construirCsv } from "@/lib/csv";
import {
  ENCABEZADOS_LIBRO,
  filaALibroCsv,
  ordenarLibro,
  type FilaLibro,
} from "@/lib/libro";
import type { MedioPago } from "@/types/database";

// Los datos son del usuario y cambian a cada rato: nunca se cachea.
export const dynamic = "force-dynamic";

const MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

/**
 * GET /caja-menor/exportar?mes=YYYY-MM
 * CSV del libro de movimientos del mes (gastos y cobros, con medio de pago) listo para Excel.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("No autorizado", { status: 401 });

  const mes = normalizarMes(request.nextUrl.searchParams.get("mes") ?? undefined);
  const { desde, hasta } = rangoMes(mes);

  const [gastos, pagos] = await Promise.all([
    supabase
      .from("gastos_caja_menor")
      .select("fecha, created_at, categoria, descripcion, monto, autor, anulado, anulado_motivo, ordenes_servicio(vehiculos(placa))")
      .gte("fecha", desde)
      .lt("fecha", hasta),
    supabase
      .from("pagos_orden")
      .select("fecha, created_at, monto, medio, es_devolucion, referencia, notas, autor, anulado, anulado_motivo, ordenes_servicio(vehiculos(placa))")
      .gte("fecha", desde)
      .lt("fecha", hasta),
  ]);

  const error = gastos.error ?? pagos.error;
  if (error) {
    return new NextResponse(
      `No se pudo generar el reporte: ${error.message}. ¿Ya ejecutaste polo_air_cool_fase3.sql y fase4.sql?`,
      { status: 500 }
    );
  }

  const filas: FilaLibro[] = [];

  for (const g of gastos.data ?? []) {
    filas.push({
      fecha: g.fecha,
      creado: g.created_at,
      tipo: "Gasto",
      concepto: CATEGORIA_LABEL[g.categoria],
      descripcion: g.descripcion,
      monto: g.monto,
      sentido: "Salida",
      medio: "Efectivo (caja menor)",
      placa: g.ordenes_servicio?.vehiculos?.placa ?? null,
      autor: g.autor,
      anulado: g.anulado,
      motivoAnulacion: g.anulado_motivo,
      referencia: null,
    });
  }

  for (const p of pagos.data ?? []) {
    filas.push({
      fecha: p.fecha,
      creado: p.created_at,
      tipo: p.es_devolucion ? "Devolución a cliente" : "Cobro de cliente",
      concepto: p.es_devolucion ? "Devolución" : "Abono / pago de orden",
      descripcion: p.notas,
      monto: p.monto,
      sentido: p.es_devolucion ? "Salida" : "Entrada",
      medio: MEDIO[p.medio],
      placa: p.ordenes_servicio?.vehiculos?.placa ?? null,
      autor: p.autor,
      anulado: p.anulado,
      motivoAnulacion: p.anulado_motivo,
      referencia: p.referencia,
    });
  }

  const csv = construirCsv(ENCABEZADOS_LIBRO, ordenarLibro(filas).map(filaALibroCsv));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="polo-air-cool-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
