-- =====================================================================
-- POLO AIR COOL · FASE 1 · ARQUITECTURA DE DATOS (Supabase / PostgreSQL 15+)
-- Script maestro. Ejecutar completo en: Supabase > SQL Editor.
-- Re-ejecutable (idempotente) en la mayoría de sus sentencias.
--
-- CONTENIDO
--   0. Extensiones
--   1. Enums
--   2. Funciones base (token, updated_at, roles)
--   3. Tablas, constraints y llaves foráneas
--   4. Triggers y lógica transaccional (garantía, stock, placa)
--   5. Índices
--   6. Vistas contables / operativas
--   7. Seguridad: RLS + RPC pública del portal del cliente
--   8. Storage: buckets y políticas
--
-- MODELO DE ROLES
--   Los roles viven en auth.users.raw_app_meta_data->>'rol' (solo editable
--   con service role / dashboard, NO por el propio usuario).
--     'admin'    -> todo: incluye borrar y editar caja menor
--     'operario' -> lee/crea/edita la operación diaria; no borra
--   Asignar rol (ejecutar aparte, con el correo real):
--     update auth.users
--        set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"rol":"admin"}'
--      where email = 'dueño@tallerpolo.com';
--   El cliente final NO se autentica: consulta su orden con el token vía
--   la RPC public.obtener_orden_publica(token).
-- =====================================================================


-- =====================================================================
-- 0. EXTENSIONES
-- =====================================================================
-- gen_random_uuid() es nativo (PG13+): no se necesita uuid-ossp.
create extension if not exists pgcrypto with schema extensions;  -- bytes aleatorios seguros (token)
create extension if not exists pg_trgm  with schema extensions;  -- búsqueda parcial placa/teléfono/nombre


-- =====================================================================
-- 1. ENUMS
-- =====================================================================
do $$ begin
  create type public.estado_orden as enum
    ('recibido','diagnostico','en_proceso','listo','entregado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_evidencia as enum
    ('ingreso','repuesto_viejo','repuesto_nuevo','prueba_tecnica','factura_compra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_unidad as enum ('unidad','gramo','libra','onza');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.categoria_gasto as enum
    ('ayudante','alimentacion_refrigerio','flete_acarreo','herramienta_consumible','otros');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 2. FUNCIONES BASE
-- =====================================================================

-- Token público: 16 bytes aleatorios (128 bits) en base64url -> 22 caracteres.
create or replace function public.fn_generar_token_publico()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_');
$$;

-- Mantiene updated_at.
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Roles a partir del JWT (app_metadata no es editable por el usuario).
create or replace function public.es_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') in ('admin','operario'), false);
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin', false);
$$;


-- =====================================================================
-- 3. TABLAS
-- =====================================================================

-- ---------- clientes ----------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(btrim(nombre)) > 0),
  -- WhatsApp en formato internacional E.164, ej: +573001234567
  telefono    text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  documento   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.clientes.telefono is 'WhatsApp en E.164 con código de país (+57...).';

-- ---------- vehiculos ----------
create table if not exists public.vehiculos (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references public.clientes(id) on delete restrict,
  -- Se normaliza por trigger: MAYÚSCULAS, sin espacios ni guiones.
  placa                  text not null unique check (placa ~ '^[A-Z0-9]{5,8}$'),
  marca                  text not null,
  modelo                 text not null,
  anio                   smallint check (anio between 1950 and 2100),
  tipo_gas_sugerido      text check (tipo_gas_sugerido in ('R134a','R1234yf','otro')),
  carga_estandar_gramos  numeric(8,1) check (carga_estandar_gramos > 0),   -- extra: carga recomendada
  created_at             timestamptz not null default now()
);

-- ---------- ordenes_servicio ----------
create table if not exists public.ordenes_servicio (
  id                  uuid primary key default gen_random_uuid(),
  vehiculo_id         uuid not null references public.vehiculos(id) on delete restrict,
  estado              public.estado_orden not null default 'recibido',
  fecha_ingreso       timestamptz not null default now(),
  fecha_entrega       timestamptz,
  kilometraje         integer check (kilometraje >= 0),            -- extra: km al ingreso
  dias_garantia       integer not null default 0 check (dias_garantia >= 0),
  fecha_fin_garantia  date,                                         -- la calcula el trigger
  mano_obra           numeric(12,2) not null default 0 check (mano_obra >= 0),
  total_cobrado       numeric(12,2) not null default 0 check (total_cobrado >= 0),
  -- Token opaco para /orden/[token] (portal público del cliente)
  token_publico       text not null unique default public.fn_generar_token_publico(),
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_entrega_posterior
    check (fecha_entrega is null or fecha_entrega >= fecha_ingreso)
);

-- ---------- evidencias_fotograficas ----------
create table if not exists public.evidencias_fotograficas (
  id          uuid primary key default gen_random_uuid(),
  orden_id    uuid not null references public.ordenes_servicio(id) on delete cascade,
  -- Guardar la RUTA dentro del bucket (ej: '<orden_id>/<uuid>.jpg'), no una URL:
  -- el bucket es privado y se firman URLs temporales desde el servidor.
  url_imagen  text not null,
  tipo        public.tipo_evidencia not null,
  notas       text,
  created_at  timestamptz not null default now()
);

-- ---------- inventario ----------
create table if not exists public.inventario (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique check (length(btrim(codigo)) > 0),
  nombre       text not null check (length(btrim(nombre)) > 0),
  descripcion  text,
  tipo_unidad  public.tipo_unidad not null default 'unidad',
  stock_actual numeric(12,3) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(12,3) not null default 0 check (stock_minimo >= 0),
  costo_compra numeric(12,2) not null default 0 check (costo_compra >= 0),
  precio_venta numeric(12,2) not null default 0 check (precio_venta >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- orden_repuestos ----------
-- costo_unitario / precio_unitario son un SNAPSHOT del momento de la venta:
-- si el inventario cambia de precio después, el histórico de la orden no se altera.
create table if not exists public.orden_repuestos (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references public.ordenes_servicio(id) on delete cascade,
  inventario_id   uuid not null references public.inventario(id) on delete restrict,
  cantidad_usada  numeric(12,3) not null check (cantidad_usada > 0),
  costo_unitario  numeric(12,2) not null check (costo_unitario >= 0),  -- el trigger lo completa si viene NULL
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0), -- el trigger lo completa si viene NULL
  created_at      timestamptz not null default now()
);

-- ---------- gastos_caja_menor ----------
-- Gastos operativos del taller. Completamente separados de los costos de órdenes.
create table if not exists public.gastos_caja_menor (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default ((now() at time zone 'America/Bogota')::date),
  categoria       public.categoria_gasto not null default 'otros',
  descripcion     text,
  monto           numeric(12,2) not null check (monto > 0),
  comprobante_url text,   -- ruta dentro del bucket 'facturas-gastos'
  created_at      timestamptz not null default now()
);


-- =====================================================================
-- 4. TRIGGERS Y LÓGICA TRANSACCIONAL
-- =====================================================================

-- ---------- 4.1 updated_at ----------
drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at before update on public.clientes
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_ordenes_updated_at on public.ordenes_servicio;
create trigger trg_ordenes_updated_at before update on public.ordenes_servicio
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_inventario_updated_at on public.inventario;
create trigger trg_inventario_updated_at before update on public.inventario
  for each row execute function public.fn_set_updated_at();

-- ---------- 4.2 Normalizar placa ----------
create or replace function public.fn_normalizar_placa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.placa := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));
  return new;
end $$;

drop trigger if exists trg_vehiculos_placa on public.vehiculos;
create trigger trg_vehiculos_placa before insert or update of placa on public.vehiculos
  for each row execute function public.fn_normalizar_placa();

-- ---------- 4.3 Orden: fecha de entrega, garantía y token ----------
-- La garantía corre desde la ENTREGA:
--   fecha_fin_garantia = fecha_entrega (hora Colombia) + dias_garantia
-- Sin entrega o sin días de garantía -> NULL.
create or replace function public.fn_orden_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.token_publico is null then
    new.token_publico := public.fn_generar_token_publico();
  end if;

  -- Al marcar 'entregado' sin fecha explícita, se sella la fecha de entrega.
  if new.estado = 'entregado' and new.fecha_entrega is null then
    new.fecha_entrega := now();
  end if;

  if new.fecha_entrega is not null and coalesce(new.dias_garantia, 0) > 0 then
    new.fecha_fin_garantia :=
      (new.fecha_entrega at time zone 'America/Bogota')::date + new.dias_garantia;
  else
    new.fecha_fin_garantia := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_orden_before_write on public.ordenes_servicio;
create trigger trg_orden_before_write
  before insert or update on public.ordenes_servicio
  for each row execute function public.fn_orden_before_write();

-- ---------- 4.4 Movimiento de stock (helper, con bloqueo de fila) ----------
-- p_delta > 0 devuelve stock; p_delta < 0 descuenta. Falla si el stock no alcanza.
create or replace function public.fn_mover_stock(p_inventario_id uuid, p_delta numeric)
returns public.inventario
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.inventario;
begin
  select * into v from public.inventario where id = p_inventario_id for update;

  if not found then
    raise exception 'El ítem de inventario % no existe', p_inventario_id
      using errcode = 'foreign_key_violation';
  end if;

  if v.stock_actual + p_delta < 0 then
    raise exception 'Stock insuficiente de "%" (disponible: % %, requerido: %)',
      v.nombre, v.stock_actual, v.tipo_unidad, -p_delta
      using errcode = 'check_violation',
            hint = 'Registra primero la compra/reposición en inventario.';
  end if;

  update public.inventario
     set stock_actual = stock_actual + p_delta
   where id = p_inventario_id
   returning * into v;

  return v;
end $$;

-- ---------- 4.5 orden_repuestos <-> inventario ----------
--  INSERT : descuenta stock y congela costo/precio (si no vienen informados).
--  UPDATE : ajusta la diferencia (o mueve stock entre ítems si cambia el ítem).
--  DELETE : devuelve el stock (también aplica al borrar la orden por CASCADE).
--  No permite agregar/editar repuestos en órdenes 'entregado' o 'cancelado'.
--  Todo ocurre en la misma transacción que la operación: si algo falla, no queda nada a medias.
create or replace function public.fn_orden_repuestos_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado public.estado_orden;
  v_inv    public.inventario;
begin
  if tg_op = 'DELETE' then
    perform public.fn_mover_stock(old.inventario_id, old.cantidad_usada);
    return old;
  end if;

  select estado into v_estado from public.ordenes_servicio where id = new.orden_id;
  if v_estado in ('entregado', 'cancelado') then
    raise exception 'La orden está % y no admite cambios de repuestos', v_estado
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    v_inv := public.fn_mover_stock(new.inventario_id, -new.cantidad_usada);
    new.costo_unitario  := coalesce(new.costo_unitario,  v_inv.costo_compra);
    new.precio_unitario := coalesce(new.precio_unitario, v_inv.precio_venta);

  else -- UPDATE
    if new.orden_id <> old.orden_id then
      raise exception 'No se puede mover un repuesto a otra orden; elimínalo y créalo de nuevo'
        using errcode = 'check_violation';
    end if;

    if new.inventario_id = old.inventario_id then
      if new.cantidad_usada <> old.cantidad_usada then
        perform public.fn_mover_stock(new.inventario_id, old.cantidad_usada - new.cantidad_usada);
      end if;
    else
      perform public.fn_mover_stock(old.inventario_id,  old.cantidad_usada);
      v_inv := public.fn_mover_stock(new.inventario_id, -new.cantidad_usada);
      new.costo_unitario  := coalesce(new.costo_unitario,  v_inv.costo_compra);
      new.precio_unitario := coalesce(new.precio_unitario, v_inv.precio_venta);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_orden_repuestos_stock on public.orden_repuestos;
create trigger trg_orden_repuestos_stock
  before insert or update or delete on public.orden_repuestos
  for each row execute function public.fn_orden_repuestos_stock();

-- Las funciones internas no deben ser invocables desde la API (PostgREST/RPC).
revoke all on function public.fn_mover_stock(uuid, numeric)  from public, anon, authenticated;
revoke all on function public.fn_orden_repuestos_stock()     from public, anon, authenticated;


-- =====================================================================
-- 5. ÍNDICES
-- =====================================================================
-- Ya existen índices únicos implícitos en: vehiculos.placa, inventario.codigo,
-- ordenes_servicio.token_publico (búsqueda exacta por placa y por token).

-- Búsqueda parcial (ILIKE '%abc%') por placa, teléfono y nombre
create index if not exists idx_vehiculos_placa_trgm  on public.vehiculos using gin (placa extensions.gin_trgm_ops);
create index if not exists idx_clientes_telefono     on public.clientes (telefono);
create index if not exists idx_clientes_telefono_trgm on public.clientes using gin (telefono extensions.gin_trgm_ops);
create index if not exists idx_clientes_nombre_trgm  on public.clientes using gin (nombre extensions.gin_trgm_ops);
create unique index if not exists ux_clientes_documento
  on public.clientes (documento) where documento is not null;

-- FKs y consultas frecuentes
create index if not exists idx_vehiculos_cliente     on public.vehiculos (cliente_id);
create index if not exists idx_ordenes_vehiculo      on public.ordenes_servicio (vehiculo_id, fecha_ingreso desc);
create index if not exists idx_ordenes_estado        on public.ordenes_servicio (estado, fecha_ingreso desc);
create index if not exists idx_ordenes_activas       on public.ordenes_servicio (fecha_ingreso desc)
  where estado not in ('entregado', 'cancelado');
create index if not exists idx_ordenes_fin_garantia  on public.ordenes_servicio (fecha_fin_garantia)
  where fecha_fin_garantia is not null;
create index if not exists idx_evidencias_orden      on public.evidencias_fotograficas (orden_id, tipo);
create index if not exists idx_orden_repuestos_orden on public.orden_repuestos (orden_id);
create index if not exists idx_orden_repuestos_inv   on public.orden_repuestos (inventario_id);
create index if not exists idx_inventario_nombre_trgm on public.inventario using gin (nombre extensions.gin_trgm_ops);
create index if not exists idx_inventario_reponer    on public.inventario (nombre)
  where stock_actual <= stock_minimo;
create index if not exists idx_gastos_fecha          on public.gastos_caja_menor (fecha desc, categoria);


-- =====================================================================
-- 6. VISTAS (security_invoker: respetan el RLS del usuario que consulta)
-- =====================================================================

-- Finanzas por orden: cobro vs. costo real de piezas. NO incluye caja menor.
create or replace view public.v_finanzas_orden
with (security_invoker = true) as
select
  o.id                                         as orden_id,
  v.placa,
  o.estado,
  o.fecha_entrega,
  o.mano_obra,
  o.total_cobrado,
  coalesce(r.costo_repuestos, 0)               as costo_repuestos,
  coalesce(r.precio_repuestos, 0)              as precio_repuestos,
  o.total_cobrado - coalesce(r.costo_repuestos, 0) as margen_bruto
from public.ordenes_servicio o
join public.vehiculos v on v.id = o.vehiculo_id
left join (
  select orden_id,
         sum(cantidad_usada * costo_unitario)  as costo_repuestos,
         sum(cantidad_usada * precio_unitario) as precio_repuestos
  from public.orden_repuestos
  group by orden_id
) r on r.orden_id = o.id;

-- Balance mensual: Utilidad Real = (Ingresos - Costo repuestos) - Caja menor
-- Ingresos = órdenes 'entregado', mes según fecha_entrega (hora Colombia).
create or replace view public.v_balance_mensual
with (security_invoker = true) as
with ing as (
  select date_trunc('month', fecha_entrega at time zone 'America/Bogota')::date as mes,
         sum(total_cobrado)   as ingresos,
         sum(costo_repuestos) as costo_repuestos
  from public.v_finanzas_orden
  where estado = 'entregado' and fecha_entrega is not null
  group by 1
),
gas as (
  select date_trunc('month', fecha)::date as mes,
         sum(monto) as gastos_caja_menor
  from public.gastos_caja_menor
  group by 1
)
select
  coalesce(ing.mes, gas.mes)                          as mes,
  coalesce(ing.ingresos, 0)                           as ingresos,
  coalesce(ing.costo_repuestos, 0)                    as costo_repuestos,
  coalesce(gas.gastos_caja_menor, 0)                  as gastos_caja_menor,
  (coalesce(ing.ingresos, 0) - coalesce(ing.costo_repuestos, 0))
    - coalesce(gas.gastos_caja_menor, 0)              as utilidad_real
from ing
full join gas on gas.mes = ing.mes;

-- Garantías con semáforo: verde (vigente) / amarillo (<= 7 días) / rojo (vencida)
create or replace view public.v_garantias
with (security_invoker = true) as
select
  o.id                                   as orden_id,
  v.placa,
  c.nombre                               as cliente,
  c.telefono,
  o.fecha_entrega,
  o.dias_garantia,
  o.fecha_fin_garantia,
  (o.fecha_fin_garantia - h.hoy)         as dias_restantes,
  case
    when o.fecha_fin_garantia <  h.hoy     then 'rojo'
    when o.fecha_fin_garantia - h.hoy <= 7 then 'amarillo'
    else 'verde'
  end                                    as semaforo
from public.ordenes_servicio o
join public.vehiculos v on v.id = o.vehiculo_id
join public.clientes  c on c.id = v.cliente_id
cross join lateral (select (now() at time zone 'America/Bogota')::date as hoy) h
where o.fecha_fin_garantia is not null;

-- Ítems a reponer (stock_actual <= stock_minimo)
create or replace view public.v_inventario_reposicion
with (security_invoker = true) as
select id, codigo, nombre, tipo_unidad, stock_actual, stock_minimo,
       (stock_minimo - stock_actual) as faltante
from public.inventario
where stock_actual <= stock_minimo;


-- =====================================================================
-- 7. SEGURIDAD: RLS
-- =====================================================================
alter table public.clientes                enable row level security;
alter table public.vehiculos               enable row level security;
alter table public.ordenes_servicio        enable row level security;
alter table public.evidencias_fotograficas enable row level security;
alter table public.inventario              enable row level security;
alter table public.orden_repuestos         enable row level security;
alter table public.gastos_caja_menor       enable row level security;

-- Tablas operativas: staff (admin/operario) lee, crea y edita; solo admin borra.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','vehiculos','ordenes_servicio',
    'evidencias_fotograficas','inventario','orden_repuestos'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using ((select public.es_staff()))',
                   t || '_staff_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.es_staff()))',
                   t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()))',
                   t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.es_admin()))',
                   t || '_admin_delete', t);
  end loop;
end $$;

-- Caja menor: staff registra y consulta; solo admin edita o borra.
drop policy if exists gastos_staff_select on public.gastos_caja_menor;
drop policy if exists gastos_staff_insert on public.gastos_caja_menor;
drop policy if exists gastos_admin_update on public.gastos_caja_menor;
drop policy if exists gastos_admin_delete on public.gastos_caja_menor;

create policy gastos_staff_select on public.gastos_caja_menor
  for select to authenticated using ((select public.es_staff()));
create policy gastos_staff_insert on public.gastos_caja_menor
  for insert to authenticated with check ((select public.es_staff()));
create policy gastos_admin_update on public.gastos_caja_menor
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy gastos_admin_delete on public.gastos_caja_menor
  for delete to authenticated using ((select public.es_admin()));

-- El rol anónimo no toca tablas ni vistas directamente (defensa en profundidad).
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- RPC PÚBLICA: portal del cliente  ->  /orden/[token]
-- Devuelve solo lo que el cliente puede ver. NO expone: costos de compra,
-- notas internas, facturas de proveedores, teléfono ni documento.
-- Las rutas de imágenes (url_imagen) se firman en el servidor (Next.js) con
-- el service role: createSignedUrls() sobre el bucket 'evidencias-ordenes'.
-- Retorna NULL si el token no existe o la orden está cancelada.
-- ---------------------------------------------------------------------
create or replace function public.obtener_orden_publica(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'orden', jsonb_build_object(
      'estado',             o.estado,
      'fecha_ingreso',      o.fecha_ingreso,
      'fecha_entrega',      o.fecha_entrega,
      'dias_garantia',      o.dias_garantia,
      'fecha_fin_garantia', o.fecha_fin_garantia,
      'garantia_semaforo',  case
                              when o.fecha_fin_garantia is null then null
                              when o.fecha_fin_garantia < (now() at time zone 'America/Bogota')::date then 'rojo'
                              when o.fecha_fin_garantia - (now() at time zone 'America/Bogota')::date <= 7 then 'amarillo'
                              else 'verde'
                            end,
      'mano_obra',          o.mano_obra,
      'total_cobrado',      o.total_cobrado
    ),
    'cliente',  jsonb_build_object('nombre', c.nombre),
    'vehiculo', jsonb_build_object(
      'placa', v.placa, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio
    ),
    'repuestos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre',          i.nombre,
               'cantidad',        r.cantidad_usada,
               'unidad',          i.tipo_unidad,
               'precio_unitario', r.precio_unitario
             ) order by r.created_at)
      from public.orden_repuestos r
      join public.inventario i on i.id = r.inventario_id
      where r.orden_id = o.id
    ), '[]'::jsonb),
    'evidencias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo',       e.tipo,
               'url_imagen', e.url_imagen,
               'notas',      e.notas
             ) order by e.created_at)
      from public.evidencias_fotograficas e
      where e.orden_id = o.id
        and e.tipo <> 'factura_compra'      -- las facturas de proveedor son internas
    ), '[]'::jsonb)
  )
  from public.ordenes_servicio o
  join public.vehiculos v on v.id = o.vehiculo_id
  join public.clientes  c on c.id = v.cliente_id
  where o.token_publico = p_token
    and o.estado <> 'cancelado'
  limit 1;
$$;

revoke all on function public.obtener_orden_publica(text) from public, anon, authenticated;
grant execute on function public.obtener_orden_publica(text) to anon, authenticated, service_role;


-- =====================================================================
-- 8. STORAGE: BUCKETS Y POLÍTICAS
-- =====================================================================
-- Ambos buckets son PRIVADOS. Convención de rutas:
--   evidencias-ordenes : <orden_id>/<uuid>.jpg
--   facturas-gastos    : <yyyy-mm>/<uuid>.jpg
-- El cliente final ve las fotos con URLs firmadas generadas en el servidor.
-- Las fotos se comprimen en el navegador (~300 KB); el límite es solo un tope de seguridad.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias-ordenes', 'evidencias-ordenes', false, 2097152,
     array['image/jpeg','image/png','image/webp']),
  ('facturas-gastos',    'facturas-gastos',    false, 3145728,
     array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (storage.objects ya trae RLS habilitado en Supabase.)
drop policy if exists polo_storage_staff_select on storage.objects;
drop policy if exists polo_storage_staff_insert on storage.objects;
drop policy if exists polo_storage_staff_update on storage.objects;
drop policy if exists polo_storage_admin_delete on storage.objects;

create policy polo_storage_staff_select on storage.objects
  for select to authenticated
  using (bucket_id in ('evidencias-ordenes','facturas-gastos') and (select public.es_staff()));

create policy polo_storage_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('evidencias-ordenes','facturas-gastos') and (select public.es_staff()));

create policy polo_storage_staff_update on storage.objects
  for update to authenticated
  using (bucket_id in ('evidencias-ordenes','facturas-gastos') and (select public.es_staff()))
  with check (bucket_id in ('evidencias-ordenes','facturas-gastos') and (select public.es_staff()));

create policy polo_storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('evidencias-ordenes','facturas-gastos') and (select public.es_admin()));

-- =====================================================================
-- FIN · Fase 1
-- =====================================================================
