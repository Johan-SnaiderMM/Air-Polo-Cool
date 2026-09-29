export type ErrorSupabase = {
  code?: string;
  message: string;
  hint?: string | null;
};

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
  // Columnas de la Fase 2 ausentes: falta ejecutar la migración.
  if (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /diagnostico_inicial|trabajos_a_realizar/.test(error.message)
  ) {
    return "Falta ejecutar polo_air_cool_fase2.sql en Supabase (columnas de diagnóstico y trabajos).";
  }
  if (error.code === "42501") {
    return "No tienes permisos para esta acción (revisa el rol del usuario).";
  }
  if (error.code === "23505") {
    return "Ya existe un registro con esos datos (placa, documento o código duplicado).";
  }
  if (error.code === "23514") {
    return "Alguno de los datos no cumple las reglas de la base de datos.";
  }
  return error.message;
}
