-- =====================================================================
-- POLO AIR COOL · FASE 7 · AGENDA DE CITAS
-- Ejecutar en: Supabase > SQL Editor (re-ejecutable). Requiere la fase 6.
--
-- Una cita es «este vehículo viene tal día a tal hora» (revisión, servicio o mantenimiento).
-- Solo guarda el vehículo (que ya tiene a su cliente), la fecha y hora, el tipo y una nota: lo demás
-- (pertenencias, kilometraje…) se toma cuando el vehículo llega y se crea la orden.
--
-- Se rige por las mismas protecciones de la fase 6: una cita creada en modo prueba solo la ve soporte,
-- y durante el mantenimiento solo soporte puede escribir.
-- =====================================================================

create table if not exists public.citas (
  id                      uuid primary key default gen_random_uuid(),
  -- RESTRICT: un vehículo con citas no se borra (en la práctica los vehículos no se borran).
  vehiculo_id             uuid not null references public.vehiculos(id) on delete restrict,
  -- Instante exacto; la app lo muestra siempre en hora de Colombia (sin horario de verano).
  fecha_hora              timestamptz not null,
  tipo                    text not null default 'servicio' check (tipo in ('servicio', 'mantenimiento')),
  -- pendiente: por atender · cumplida: el vehículo llegó · cancelada: no se hará
  estado                  text not null default 'pendiente' check (estado in ('pendiente', 'cumplida', 'cancelada')),
  notas                   text check (notas is null or length(notas) <= 1000),
  -- Se llena al tocar el botón de WhatsApp: el taller sabe a quién ya se le recordó.
  recordatorio_enviado_at timestamptz,
  autor                   text check (autor is null or autor in ('Polo', 'Soporte técnico')),
  registrado_por          uuid default auth.uid() references auth.users(id) on delete set null,
  es_prueba               boolean not null default public.en_modo_prueba(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.citas is 'Agenda: vehículos que vienen al taller en una fecha y hora.';

create index if not exists idx_citas_pendientes on public.citas (fecha_hora) where estado = 'pendiente';
create index if not exists idx_citas_vehiculo   on public.citas (vehiculo_id, fecha_hora desc);

drop trigger if exists trg_citas_updated_at on public.citas;
create trigger trg_citas_updated_at before update on public.citas
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.citas enable row level security;

drop policy if exists citas_staff_select on public.citas;
drop policy if exists citas_staff_insert on public.citas;
drop policy if exists citas_staff_update on public.citas;
drop policy if exists citas_admin_delete on public.citas;

create policy citas_staff_select on public.citas
  for select to authenticated using ((select public.es_staff()));
create policy citas_staff_insert on public.citas
  for insert to authenticated with check ((select public.es_staff()));
create policy citas_staff_update on public.citas
  for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()));
create policy citas_admin_delete on public.citas
  for delete to authenticated using ((select public.es_admin()));

-- Modo prueba (fase 6): solo se ve y se toca lo del modo propio.
drop policy if exists citas_modo on public.citas;
create policy citas_modo on public.citas as restrictive for all to authenticated
  using (es_prueba = (select public.en_modo_prueba()))
  with check (es_prueba = (select public.en_modo_prueba()));

-- Mantenimiento (fase 6): Polo no escribe mientras esté activo.
drop trigger if exists trg_00_guardia_soporte on public.citas;
create trigger trg_00_guardia_soporte before insert or update or delete on public.citas
  for each row execute function public.fn_guardia_soporte();

revoke all on public.citas from anon;

-- =====================================================================
-- FIN · Fase 7
-- =====================================================================
