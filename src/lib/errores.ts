export type ErrorSupabase = {
  code?: string;
  message: string;
  hint?: string | null;
};

/** Códigos de PostgREST/Postgres que indican que falta ejecutar una migración SQL. */
const CODIGOS_MIGRACION = new Set([
  "PGRST202", // función no encontrada (RPC de una fase)
  "PGRST204", // columna no encontrada en el esquema
  "PGRST205", // tabla no encontrada en el esquema
  "42P01", // relation does not exist
  "42703", // undefined column
]);

export function esErrorDeMigracion(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && CODIGOS_MIGRACION.has(error.code);
}

/** Traduce errores de Postgres/PostgREST a mensajes claros para el taller. */
export function mensajeDeError(error: ErrorSupabase): string {
  // Reglas del trigger de repuestos (fn_mover_stock / fn_orden_repuestos_stock):
  // ya vienen redactadas en español y con una pista útil.
  if (
    /^Stock insuficiente/.test(error.message) ||
    /no admite cambios de repuestos/.test(error.message)
  ) {
    return error.hint ? `${error.message}. ${error.hint}` : error.message;
  }
  // Columnas o funciones de una migración ausentes: falta ejecutar el SQL de la fase.
  if (/diagnostico_inicial|trabajos_a_realizar/.test(error.message)) {
    return "Falta ejecutar polo_air_cool_fase2.sql en Supabase (columnas de diagnóstico y trabajos).";
  }
  if (esErrorDeMigracion(error)) {
    return "Falta ejecutar polo_air_cool_fase3.sql / polo_air_cool_fase4.sql en Supabase (tablas o funciones nuevas).";
  }
  // Errores lanzados por nuestras funciones SQL (RAISE EXCEPTION): ya vienen en español y son claros.
  const esDeFuncion = (m: string) => !/^(duplicate key|new row for relation|violates|permission denied|insert or update)/.test(m);
  if (error.code === "42501") {
    return "No tienes permisos para esta acción (revisa el rol del usuario).";
  }
  if (error.code === "23505") {
    return esDeFuncion(error.message)
      ? error.message
      : "Ya existe un registro con esos datos (placa, documento o código duplicado).";
  }
  if (error.code === "23514") {
    return esDeFuncion(error.message)
      ? error.message
      : "Alguno de los datos no cumple las reglas de la base de datos.";
  }
  return error.message;
}
