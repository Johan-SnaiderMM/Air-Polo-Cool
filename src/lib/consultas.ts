import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { normalizarPlaca } from "@/lib/ordenes";

/**
 * Construye el filtro .or() de PostgREST para vehículos cuya placa o cuyo
 * cliente (nombre o teléfono) coincidan parcialmente con el texto. Devuelve null si nada coincide.
 */
export async function filtroVehiculos(
  supabase: SupabaseClient<Database>,
  texto: string
): Promise<string | null> {
  const placa = normalizarPlaca(texto);
  // Se quitan caracteres con significado especial en filtros/ILIKE de PostgREST.
  const nombre = texto.replace(/[%_,()*\\]/g, " ").trim();

  const filtros: string[] = [];
  if (placa) filtros.push(`placa.ilike.%${placa}%`);

  if (nombre) {
    // Cliente por nombre o, si el texto trae 3+ dígitos, por teléfono.
    const digitos = texto.replace(/\D/g, "");
    const porCliente = [`nombre.ilike.%${nombre}%`];
    if (digitos.length >= 3) porCliente.push(`telefono.ilike.%${digitos}%`);
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id")
      .or(porCliente.join(","))
      .limit(100);
    const ids = (clientes ?? []).map((c) => c.id);
    if (ids.length > 0) filtros.push(`cliente_id.in.(${ids.join(",")})`);
  }

  return filtros.length > 0 ? filtros.join(",") : null;
}
