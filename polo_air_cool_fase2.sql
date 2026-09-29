  -- =====================================================================
  -- POLO AIR COOL · FASE 2 · Migración incremental
  -- Ejecutar en: Supabase > SQL Editor (después de polo_air_cool_fase1.sql).
  -- Idempotente.
  --
  -- Agrega a ordenes_servicio los campos del formulario de recepción:
  --   diagnostico_inicial : hallazgos al ingreso (fugas, presiones, escaneo)
  --   trabajos_a_realizar : lista de trabajos acordados con el cliente
  -- Ambos son INTERNOS: obtener_orden_publica() no los expone al cliente.
  -- =====================================================================
  alter table public.ordenes_servicio
    add column if not exists diagnostico_inicial text,
    add column if not exists trabajos_a_realizar text;
