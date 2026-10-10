-- =====================================================================
-- POLO AIR COOL · FASE 11 · COSTO DEL REPUESTO AL SUBIR LA FOTO
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable).
--
-- Al subir la foto de un repuesto instalado, la app pide cuánto costó y lo registra como un egreso (gasto)
-- LIGADO A LA ORDEN con la categoría «repuesto». Así se descuenta del margen de esa orden y del balance sin
-- depender de que el repuesto estuviera cargado antes en el inventario.
--
-- Solo añade el valor «repuesto» a la lista de categorías de gasto. Se ejecuta ANTES de usarlo desde la app;
-- mientras no se ejecute, la app avisa que falta esta migración al intentar guardar un costo de repuesto.
-- =====================================================================

alter type public.categoria_gasto add value if not exists 'repuesto';

-- =====================================================================
-- FIN · Fase 11
-- =====================================================================
