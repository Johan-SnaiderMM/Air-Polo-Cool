-- =====================================================================
-- POLO AIR COOL · FASE 8 · AVISOS (NOTIFICACIONES PUSH)
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere la fase 7.
--
-- Dos veces al día (7:00 a. m. y 5:30 p. m., hora de Colombia) un proceso programado manda a los
-- teléfonos suscritos un RESUMEN de la agenda: cuántas citas hay y cuántas faltan por recordar.
--
--   push_suscripciones : un teléfono (navegador) suscrito a los avisos.
--   push_envios        : qué resumen se mandó ya cada día (evita mandarlo dos veces).
--
-- Ninguna de las dos tablas la toca la app con la sesión de un usuario: solo el servidor, con la
-- clave de servicio (RLS activado y sin políticas = ningún usuario las lee ni las escribe directamente).
-- Los datos de PRUEBA de soporte (fase 6) nunca entran en un resumen: el proceso solo cuenta citas reales.
-- =====================================================================

create table if not exists public.push_suscripciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Dirección única que da el navegador para enviarle avisos a ese teléfono.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- true = el teléfono es del usuario de soporte (para poder probar sin molestar a los demás).
  es_soporte  boolean not null default false,
  user_agent  text,
  created_at  timestamptz not null default now()
);
comment on table public.push_suscripciones is 'Teléfonos suscritos a los avisos de la agenda (solo el servidor, con service role).';

create index if not exists idx_push_suscripciones_usuario on public.push_suscripciones (user_id);

create table if not exists public.push_envios (
  fecha       date not null,
  -- dia: 7:00 a. m. (citas de hoy) · tarde: 5:30 p. m. (citas de mañana)
  franja      text not null check (franja in ('dia', 'tarde')),
  enviados    integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (fecha, franja)
);
comment on table public.push_envios is 'Resumen ya enviado por día y franja (idempotencia del proceso programado).';

alter table public.push_suscripciones enable row level security;
alter table public.push_envios        enable row level security;

revoke all on public.push_suscripciones, public.push_envios from anon, authenticated;

-- =====================================================================
-- FIN · Fase 8
-- =====================================================================
