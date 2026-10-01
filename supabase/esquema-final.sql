-- COLUMNAS
caja_movimientos.anulado boolean not null default false
caja_movimientos.anulado_at timestamp with time zone null default -
caja_movimientos.anulado_motivo text null default -
caja_movimientos.anulado_por uuid null default -
caja_movimientos.autor text null default -
caja_movimientos.cierre_id uuid null default -
caja_movimientos.created_at timestamp with time zone not null default now()
caja_movimientos.fecha date not null default ((now() AT TIME ZONE 'America/Bogota'::text))::date
caja_movimientos.id uuid not null default gen_random_uuid()
caja_movimientos.monto numeric not null default -
caja_movimientos.notas text null default -
caja_movimientos.registrado_por uuid null default auth.uid()
caja_movimientos.tipo USER-DEFINED not null default -
cierres_caja.anulado boolean not null default false
cierres_caja.anulado_at timestamp with time zone null default -
cierres_caja.anulado_motivo text null default -
cierres_caja.anulado_por uuid null default -
cierres_caja.autor text null default -
cierres_caja.conteo_fisico numeric not null default -
cierres_caja.created_at timestamp with time zone not null default now()
cierres_caja.desglose jsonb not null default '{}'::jsonb
cierres_caja.diferencia numeric null default -
cierres_caja.fecha date not null default -
cierres_caja.id uuid not null default gen_random_uuid()
cierres_caja.notas text null default -
cierres_caja.registrado_por uuid null default auth.uid()
cierres_caja.resultado text null default -
cierres_caja.saldo_sistema numeric not null default -
citas.autor text null default -
citas.created_at timestamp with time zone not null default now()
citas.es_prueba boolean not null default en_modo_prueba()
citas.estado text not null default 'pendiente'::text
citas.fecha_hora timestamp with time zone not null default -
citas.id uuid not null default gen_random_uuid()
citas.notas text null default -
citas.recordatorio_enviado_at timestamp with time zone null default -
citas.registrado_por uuid null default auth.uid()
citas.tipo text not null default 'servicio'::text
citas.updated_at timestamp with time zone not null default now()
citas.vehiculo_id uuid not null default -
clientes.created_at timestamp with time zone not null default now()
clientes.documento text null default -
clientes.es_prueba boolean not null default en_modo_prueba()
clientes.id uuid not null default gen_random_uuid()
clientes.nombre text not null default -
clientes.telefono text not null default -
clientes.updated_at timestamp with time zone not null default now()
cotizacion_items.cantidad numeric not null default -
cotizacion_items.costo_unitario numeric not null default 0
cotizacion_items.cotizacion_id uuid not null default -
cotizacion_items.created_at timestamp with time zone not null default now()
cotizacion_items.descripcion text not null default -
cotizacion_items.es_prueba boolean not null default en_modo_prueba()
cotizacion_items.id uuid not null default gen_random_uuid()
cotizacion_items.inventario_id uuid null default -
cotizacion_items.precio_unitario numeric not null default -
cotizaciones.autor text null default -
cotizaciones.created_at timestamp with time zone not null default now()
cotizaciones.es_prueba boolean not null default en_modo_prueba()
cotizaciones.estado USER-DEFINED not null default 'borrador'::estado_cotizacion
cotizaciones.fecha date not null default ((now() AT TIME ZONE 'America/Bogota'::text))::date
cotizaciones.id uuid not null default gen_random_uuid()
cotizaciones.mano_obra numeric not null default 0
cotizaciones.notas text null default -
cotizaciones.orden_id uuid null default -
cotizaciones.registrado_por uuid null default auth.uid()
cotizaciones.updated_at timestamp with time zone not null default now()
cotizaciones.vehiculo_id uuid not null default -
cotizaciones.vigencia_dias integer not null default 15
evidencias_fotograficas.created_at timestamp with time zone not null default now()
evidencias_fotograficas.es_prueba boolean not null default en_modo_prueba()
evidencias_fotograficas.id uuid not null default gen_random_uuid()
evidencias_fotograficas.notas text null default -
evidencias_fotograficas.orden_id uuid not null default -
evidencias_fotograficas.orden_repuesto_id uuid null default -
evidencias_fotograficas.tipo USER-DEFINED not null default -
evidencias_fotograficas.url_imagen text not null default -
gastos_caja_menor.anulado boolean not null default false
gastos_caja_menor.anulado_at timestamp with time zone null default -
gastos_caja_menor.anulado_autor text null default -
gastos_caja_menor.anulado_motivo text null default -
gastos_caja_menor.anulado_por uuid null default -
gastos_caja_menor.autor text null default -
gastos_caja_menor.categoria USER-DEFINED not null default 'otros'::categoria_gasto
gastos_caja_menor.comprobante_url text null default -
gastos_caja_menor.created_at timestamp with time zone not null default now()
gastos_caja_menor.descripcion text null default -
gastos_caja_menor.es_prueba boolean not null default en_modo_prueba()
gastos_caja_menor.fecha date not null default ((now() AT TIME ZONE 'America/Bogota'::text))::date
gastos_caja_menor.historial jsonb not null default '[]'::jsonb
gastos_caja_menor.id uuid not null default gen_random_uuid()
gastos_caja_menor.monto numeric not null default -
gastos_caja_menor.orden_id uuid null default -
gastos_caja_menor.registrado_por uuid null default auth.uid()
gastos_caja_menor.updated_at timestamp with time zone null default -
inventario.codigo text not null default -
inventario.costo_compra numeric not null default 0
inventario.created_at timestamp with time zone not null default now()
inventario.descripcion text null default -
inventario.es_prueba boolean not null default en_modo_prueba()
inventario.id uuid not null default gen_random_uuid()
inventario.nombre text not null default -
inventario.precio_venta numeric not null default 0
inventario.stock_actual numeric not null default 0
inventario.stock_minimo numeric not null default 0
inventario.tipo_unidad USER-DEFINED not null default 'unidad'::tipo_unidad
inventario.updated_at timestamp with time zone not null default now()
mantenimiento.activo boolean not null default false
mantenimiento.actualizado_por uuid null default -
mantenimiento.desde timestamp with time zone null default -
mantenimiento.id boolean not null default true
mantenimiento.motivo text null default -
orden_repuestos.cantidad_usada numeric not null default -
orden_repuestos.costo_unitario numeric not null default -
orden_repuestos.created_at timestamp with time zone not null default now()
orden_repuestos.es_prueba boolean not null default en_modo_prueba()
orden_repuestos.id uuid not null default gen_random_uuid()
orden_repuestos.inventario_id uuid not null default -
orden_repuestos.orden_id uuid not null default -
orden_repuestos.precio_unitario numeric not null default -
ordenes_servicio.autor text null default -
ordenes_servicio.created_at timestamp with time zone not null default now()
ordenes_servicio.diagnostico_inicial text null default -
ordenes_servicio.dias_garantia integer not null default 0
ordenes_servicio.es_prueba boolean not null default en_modo_prueba()
ordenes_servicio.estado USER-DEFINED not null default 'recibido'::estado_orden
ordenes_servicio.fecha_entrega timestamp with time zone null default -
ordenes_servicio.fecha_fin_garantia date null default -
ordenes_servicio.fecha_ingreso timestamp with time zone not null default now()
ordenes_servicio.id uuid not null default gen_random_uuid()
ordenes_servicio.kilometraje integer null default -
ordenes_servicio.mano_obra numeric not null default 0
ordenes_servicio.mantenimiento_meses smallint null default -
ordenes_servicio.notas text null default -
ordenes_servicio.pertenencias jsonb null default -
ordenes_servicio.proximo_mantenimiento date null default -
ordenes_servicio.token_publico text not null default fn_generar_token_publico()
ordenes_servicio.total_cobrado numeric not null default 0
ordenes_servicio.trabajos_a_realizar text null default -
ordenes_servicio.updated_at timestamp with time zone not null default now()
ordenes_servicio.vehiculo_id uuid not null default -
pagos_orden.anulado boolean not null default false
pagos_orden.anulado_at timestamp with time zone null default -
pagos_orden.anulado_motivo text null default -
pagos_orden.anulado_por uuid null default -
pagos_orden.autor text null default -
pagos_orden.comprobante_url text null default -
pagos_orden.created_at timestamp with time zone not null default now()
pagos_orden.es_devolucion boolean not null default false
pagos_orden.es_prueba boolean not null default en_modo_prueba()
pagos_orden.fecha date not null default ((now() AT TIME ZONE 'America/Bogota'::text))::date
pagos_orden.id uuid not null default gen_random_uuid()
pagos_orden.medio USER-DEFINED not null default 'efectivo'::medio_pago
pagos_orden.monto numeric not null default -
pagos_orden.notas text null default -
pagos_orden.orden_id uuid not null default -
pagos_orden.referencia text null default -
pagos_orden.registrado_por uuid null default auth.uid()
soporte_modo.prueba boolean not null default false
soporte_modo.updated_at timestamp with time zone not null default now()
soporte_modo.user_id uuid not null default -
vehiculos.anio smallint null default -
vehiculos.carga_estandar_gramos numeric null default -
vehiculos.cliente_id uuid not null default -
vehiculos.created_at timestamp with time zone not null default now()
vehiculos.es_prueba boolean not null default en_modo_prueba()
vehiculos.id uuid not null default gen_random_uuid()
vehiculos.marca text not null default -
vehiculos.modelo text not null default -
vehiculos.placa text not null default -
vehiculos.tipo_gas_sugerido text null default -

-- RESTRICCIONES
caja_movimientos: caja_movimientos_anulado_not_null NOT NULL anulado
caja_movimientos: caja_movimientos_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES auth.users(id) ON DELETE SET NULL
caja_movimientos: caja_movimientos_autor_check CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
caja_movimientos: caja_movimientos_cierre_id_fkey FOREIGN KEY (cierre_id) REFERENCES cierres_caja(id) ON DELETE RESTRICT
caja_movimientos: caja_movimientos_created_at_not_null NOT NULL created_at
caja_movimientos: caja_movimientos_fecha_not_null NOT NULL fecha
caja_movimientos: caja_movimientos_id_not_null NOT NULL id
caja_movimientos: caja_movimientos_monto_check CHECK ((monto > (0)::numeric))
caja_movimientos: caja_movimientos_monto_not_null NOT NULL monto
caja_movimientos: caja_movimientos_pkey PRIMARY KEY (id)
caja_movimientos: caja_movimientos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
caja_movimientos: caja_movimientos_tipo_not_null NOT NULL tipo
caja_movimientos: chk_mov_anulacion CHECK ((((anulado = false) AND (anulado_motivo IS NULL) AND (anulado_at IS NULL)) OR ((anulado = true) AND (length(btrim(COALESCE(anulado_motivo, ''::text))) > 0) AND (anulado_at IS NOT NULL))))
cierres_caja: chk_cierre_anulacion CHECK ((((anulado = false) AND (anulado_motivo IS NULL) AND (anulado_at IS NULL)) OR ((anulado = true) AND (length(btrim(COALESCE(anulado_motivo, ''::text))) > 0) AND (anulado_at IS NOT NULL))))
cierres_caja: cierres_caja_anulado_not_null NOT NULL anulado
cierres_caja: cierres_caja_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES auth.users(id) ON DELETE SET NULL
cierres_caja: cierres_caja_autor_check CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
cierres_caja: cierres_caja_conteo_fisico_check CHECK ((conteo_fisico >= (0)::numeric))
cierres_caja: cierres_caja_conteo_fisico_not_null NOT NULL conteo_fisico
cierres_caja: cierres_caja_created_at_not_null NOT NULL created_at
cierres_caja: cierres_caja_desglose_not_null NOT NULL desglose
cierres_caja: cierres_caja_fecha_not_null NOT NULL fecha
cierres_caja: cierres_caja_id_not_null NOT NULL id
cierres_caja: cierres_caja_pkey PRIMARY KEY (id)
cierres_caja: cierres_caja_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
cierres_caja: cierres_caja_saldo_sistema_not_null NOT NULL saldo_sistema
citas: citas_autor_check CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
citas: citas_created_at_not_null NOT NULL created_at
citas: citas_es_prueba_not_null NOT NULL es_prueba
citas: citas_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'cumplida'::text, 'cancelada'::text])))
citas: citas_estado_not_null NOT NULL estado
citas: citas_fecha_hora_not_null NOT NULL fecha_hora
citas: citas_id_not_null NOT NULL id
citas: citas_notas_check CHECK (((notas IS NULL) OR (length(notas) <= 1000)))
citas: citas_pkey PRIMARY KEY (id)
citas: citas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
citas: citas_tipo_check CHECK ((tipo = ANY (ARRAY['servicio'::text, 'mantenimiento'::text])))
citas: citas_tipo_not_null NOT NULL tipo
citas: citas_updated_at_not_null NOT NULL updated_at
citas: citas_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT
citas: citas_vehiculo_id_not_null NOT NULL vehiculo_id
clientes: clientes_created_at_not_null NOT NULL created_at
clientes: clientes_es_prueba_not_null NOT NULL es_prueba
clientes: clientes_id_not_null NOT NULL id
clientes: clientes_nombre_check CHECK ((length(btrim(nombre)) > 0))
clientes: clientes_nombre_not_null NOT NULL nombre
clientes: clientes_pkey PRIMARY KEY (id)
clientes: clientes_telefono_check CHECK ((telefono ~ '^\+[1-9][0-9]{7,14}$'::text))
clientes: clientes_telefono_not_null NOT NULL telefono
clientes: clientes_updated_at_not_null NOT NULL updated_at
cotizacion_items: cotizacion_items_cantidad_check CHECK ((cantidad > (0)::numeric))
cotizacion_items: cotizacion_items_cantidad_not_null NOT NULL cantidad
cotizacion_items: cotizacion_items_costo_unitario_check CHECK ((costo_unitario >= (0)::numeric))
cotizacion_items: cotizacion_items_costo_unitario_not_null NOT NULL costo_unitario
cotizacion_items: cotizacion_items_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE
cotizacion_items: cotizacion_items_cotizacion_id_not_null NOT NULL cotizacion_id
cotizacion_items: cotizacion_items_created_at_not_null NOT NULL created_at
cotizacion_items: cotizacion_items_descripcion_check CHECK ((length(btrim(descripcion)) > 0))
cotizacion_items: cotizacion_items_descripcion_not_null NOT NULL descripcion
cotizacion_items: cotizacion_items_es_prueba_not_null NOT NULL es_prueba
cotizacion_items: cotizacion_items_id_not_null NOT NULL id
cotizacion_items: cotizacion_items_inventario_id_fkey FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE SET NULL
cotizacion_items: cotizacion_items_pkey PRIMARY KEY (id)
cotizacion_items: cotizacion_items_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric))
cotizacion_items: cotizacion_items_precio_unitario_not_null NOT NULL precio_unitario
cotizaciones: cotizaciones_autor_check CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
cotizaciones: cotizaciones_created_at_not_null NOT NULL created_at
cotizaciones: cotizaciones_es_prueba_not_null NOT NULL es_prueba
cotizaciones: cotizaciones_estado_not_null NOT NULL estado
cotizaciones: cotizaciones_fecha_not_null NOT NULL fecha
cotizaciones: cotizaciones_id_not_null NOT NULL id
cotizaciones: cotizaciones_mano_obra_check CHECK ((mano_obra >= (0)::numeric))
cotizaciones: cotizaciones_mano_obra_not_null NOT NULL mano_obra
cotizaciones: cotizaciones_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE SET NULL
cotizaciones: cotizaciones_pkey PRIMARY KEY (id)
cotizaciones: cotizaciones_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
cotizaciones: cotizaciones_updated_at_not_null NOT NULL updated_at
cotizaciones: cotizaciones_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT
cotizaciones: cotizaciones_vehiculo_id_not_null NOT NULL vehiculo_id
cotizaciones: cotizaciones_vigencia_dias_check CHECK (((vigencia_dias >= 1) AND (vigencia_dias <= 365)))
cotizaciones: cotizaciones_vigencia_dias_not_null NOT NULL vigencia_dias
evidencias_fotograficas: evidencias_fotograficas_created_at_not_null NOT NULL created_at
evidencias_fotograficas: evidencias_fotograficas_es_prueba_not_null NOT NULL es_prueba
evidencias_fotograficas: evidencias_fotograficas_id_not_null NOT NULL id
evidencias_fotograficas: evidencias_fotograficas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE CASCADE
evidencias_fotograficas: evidencias_fotograficas_orden_id_not_null NOT NULL orden_id
evidencias_fotograficas: evidencias_fotograficas_orden_repuesto_id_fkey FOREIGN KEY (orden_repuesto_id) REFERENCES orden_repuestos(id) ON DELETE SET NULL
evidencias_fotograficas: evidencias_fotograficas_pkey PRIMARY KEY (id)
evidencias_fotograficas: evidencias_fotograficas_tipo_not_null NOT NULL tipo
evidencias_fotograficas: evidencias_fotograficas_url_imagen_not_null NOT NULL url_imagen
gastos_caja_menor: chk_gasto_anulacion CHECK ((((anulado = false) AND (anulado_motivo IS NULL) AND (anulado_at IS NULL)) OR ((anulado = true) AND (length(btrim(COALESCE(anulado_motivo, ''::text))) > 0) AND (anulado_at IS NOT NULL))))
gastos_caja_menor: chk_gasto_autor CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
gastos_caja_menor: gastos_caja_menor_anulado_not_null NOT NULL anulado
gastos_caja_menor: gastos_caja_menor_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES auth.users(id) ON DELETE SET NULL
gastos_caja_menor: gastos_caja_menor_categoria_not_null NOT NULL categoria
gastos_caja_menor: gastos_caja_menor_created_at_not_null NOT NULL created_at
gastos_caja_menor: gastos_caja_menor_es_prueba_not_null NOT NULL es_prueba
gastos_caja_menor: gastos_caja_menor_fecha_not_null NOT NULL fecha
gastos_caja_menor: gastos_caja_menor_historial_not_null NOT NULL historial
gastos_caja_menor: gastos_caja_menor_id_not_null NOT NULL id
gastos_caja_menor: gastos_caja_menor_monto_check CHECK ((monto > (0)::numeric))
gastos_caja_menor: gastos_caja_menor_monto_not_null NOT NULL monto
gastos_caja_menor: gastos_caja_menor_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE SET NULL
gastos_caja_menor: gastos_caja_menor_pkey PRIMARY KEY (id)
gastos_caja_menor: gastos_caja_menor_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
inventario: inventario_codigo_check CHECK ((length(btrim(codigo)) > 0))
inventario: inventario_codigo_not_null NOT NULL codigo
inventario: inventario_costo_compra_check CHECK ((costo_compra >= (0)::numeric))
inventario: inventario_costo_compra_not_null NOT NULL costo_compra
inventario: inventario_created_at_not_null NOT NULL created_at
inventario: inventario_es_prueba_not_null NOT NULL es_prueba
inventario: inventario_id_not_null NOT NULL id
inventario: inventario_nombre_check CHECK ((length(btrim(nombre)) > 0))
inventario: inventario_nombre_not_null NOT NULL nombre
inventario: inventario_pkey PRIMARY KEY (id)
inventario: inventario_precio_venta_check CHECK ((precio_venta >= (0)::numeric))
inventario: inventario_precio_venta_not_null NOT NULL precio_venta
inventario: inventario_stock_actual_check CHECK ((stock_actual >= (0)::numeric))
inventario: inventario_stock_actual_not_null NOT NULL stock_actual
inventario: inventario_stock_minimo_check CHECK ((stock_minimo >= (0)::numeric))
inventario: inventario_stock_minimo_not_null NOT NULL stock_minimo
inventario: inventario_tipo_unidad_not_null NOT NULL tipo_unidad
inventario: inventario_updated_at_not_null NOT NULL updated_at
mantenimiento: mantenimiento_activo_not_null NOT NULL activo
mantenimiento: mantenimiento_id_check CHECK (id)
mantenimiento: mantenimiento_id_not_null NOT NULL id
mantenimiento: mantenimiento_pkey PRIMARY KEY (id)
orden_repuestos: orden_repuestos_cantidad_usada_check CHECK ((cantidad_usada > (0)::numeric))
orden_repuestos: orden_repuestos_cantidad_usada_not_null NOT NULL cantidad_usada
orden_repuestos: orden_repuestos_costo_unitario_check CHECK ((costo_unitario >= (0)::numeric))
orden_repuestos: orden_repuestos_costo_unitario_not_null NOT NULL costo_unitario
orden_repuestos: orden_repuestos_created_at_not_null NOT NULL created_at
orden_repuestos: orden_repuestos_es_prueba_not_null NOT NULL es_prueba
orden_repuestos: orden_repuestos_id_not_null NOT NULL id
orden_repuestos: orden_repuestos_inventario_id_fkey FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE RESTRICT
orden_repuestos: orden_repuestos_inventario_id_not_null NOT NULL inventario_id
orden_repuestos: orden_repuestos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE CASCADE
orden_repuestos: orden_repuestos_orden_id_not_null NOT NULL orden_id
orden_repuestos: orden_repuestos_pkey PRIMARY KEY (id)
orden_repuestos: orden_repuestos_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric))
orden_repuestos: orden_repuestos_precio_unitario_not_null NOT NULL precio_unitario
ordenes_servicio: chk_entrega_posterior CHECK (((fecha_entrega IS NULL) OR (fecha_entrega >= fecha_ingreso)))
ordenes_servicio: chk_mantenimiento_meses CHECK (((mantenimiento_meses IS NULL) OR (mantenimiento_meses = ANY (ARRAY[3, 6, 12]))))
ordenes_servicio: chk_ordenes_autor CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
ordenes_servicio: ordenes_servicio_created_at_not_null NOT NULL created_at
ordenes_servicio: ordenes_servicio_dias_garantia_check CHECK ((dias_garantia >= 0))
ordenes_servicio: ordenes_servicio_dias_garantia_not_null NOT NULL dias_garantia
ordenes_servicio: ordenes_servicio_es_prueba_not_null NOT NULL es_prueba
ordenes_servicio: ordenes_servicio_estado_not_null NOT NULL estado
ordenes_servicio: ordenes_servicio_fecha_ingreso_not_null NOT NULL fecha_ingreso
ordenes_servicio: ordenes_servicio_id_not_null NOT NULL id
ordenes_servicio: ordenes_servicio_kilometraje_check CHECK ((kilometraje >= 0))
ordenes_servicio: ordenes_servicio_mano_obra_check CHECK ((mano_obra >= (0)::numeric))
ordenes_servicio: ordenes_servicio_mano_obra_not_null NOT NULL mano_obra
ordenes_servicio: ordenes_servicio_pkey PRIMARY KEY (id)
ordenes_servicio: ordenes_servicio_token_publico_key UNIQUE (token_publico)
ordenes_servicio: ordenes_servicio_token_publico_not_null NOT NULL token_publico
ordenes_servicio: ordenes_servicio_total_cobrado_check CHECK ((total_cobrado >= (0)::numeric))
ordenes_servicio: ordenes_servicio_total_cobrado_not_null NOT NULL total_cobrado
ordenes_servicio: ordenes_servicio_updated_at_not_null NOT NULL updated_at
ordenes_servicio: ordenes_servicio_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT
ordenes_servicio: ordenes_servicio_vehiculo_id_not_null NOT NULL vehiculo_id
pagos_orden: chk_anulacion_completa CHECK ((((anulado = false) AND (anulado_motivo IS NULL) AND (anulado_at IS NULL)) OR ((anulado = true) AND (length(btrim(COALESCE(anulado_motivo, ''::text))) > 0) AND (anulado_at IS NOT NULL))))
pagos_orden: chk_pagos_autor CHECK (((autor IS NULL) OR (autor = ANY (ARRAY['Polo'::text, 'Soporte técnico'::text]))))
pagos_orden: pagos_orden_anulado_not_null NOT NULL anulado
pagos_orden: pagos_orden_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES auth.users(id) ON DELETE SET NULL
pagos_orden: pagos_orden_created_at_not_null NOT NULL created_at
pagos_orden: pagos_orden_es_devolucion_not_null NOT NULL es_devolucion
pagos_orden: pagos_orden_es_prueba_not_null NOT NULL es_prueba
pagos_orden: pagos_orden_fecha_not_null NOT NULL fecha
pagos_orden: pagos_orden_id_not_null NOT NULL id
pagos_orden: pagos_orden_medio_not_null NOT NULL medio
pagos_orden: pagos_orden_monto_check CHECK ((monto > (0)::numeric))
pagos_orden: pagos_orden_monto_not_null NOT NULL monto
pagos_orden: pagos_orden_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE RESTRICT
pagos_orden: pagos_orden_orden_id_not_null NOT NULL orden_id
pagos_orden: pagos_orden_pkey PRIMARY KEY (id)
pagos_orden: pagos_orden_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL
soporte_modo: soporte_modo_pkey PRIMARY KEY (user_id)
soporte_modo: soporte_modo_prueba_not_null NOT NULL prueba
soporte_modo: soporte_modo_updated_at_not_null NOT NULL updated_at
soporte_modo: soporte_modo_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
soporte_modo: soporte_modo_user_id_not_null NOT NULL user_id
vehiculos: vehiculos_anio_check CHECK (((anio >= 1950) AND (anio <= 2100)))
vehiculos: vehiculos_carga_estandar_gramos_check CHECK ((carga_estandar_gramos > (0)::numeric))
vehiculos: vehiculos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
vehiculos: vehiculos_cliente_id_not_null NOT NULL cliente_id
vehiculos: vehiculos_created_at_not_null NOT NULL created_at
vehiculos: vehiculos_es_prueba_not_null NOT NULL es_prueba
vehiculos: vehiculos_id_not_null NOT NULL id
vehiculos: vehiculos_marca_not_null NOT NULL marca
vehiculos: vehiculos_modelo_not_null NOT NULL modelo
vehiculos: vehiculos_pkey PRIMARY KEY (id)
vehiculos: vehiculos_placa_check CHECK ((placa ~ '^[A-Z0-9]{5,8}$'::text))
vehiculos: vehiculos_placa_not_null NOT NULL placa
vehiculos: vehiculos_tipo_gas_sugerido_check CHECK ((tipo_gas_sugerido = ANY (ARRAY['R134a'::text, 'R1234yf'::text, 'otro'::text])))

-- INDICES
CREATE UNIQUE INDEX caja_movimientos_pkey ON public.caja_movimientos USING btree (id)
CREATE UNIQUE INDEX cierres_caja_pkey ON public.cierres_caja USING btree (id)
CREATE UNIQUE INDEX citas_pkey ON public.citas USING btree (id)
CREATE UNIQUE INDEX clientes_pkey ON public.clientes USING btree (id)
CREATE UNIQUE INDEX cotizacion_items_pkey ON public.cotizacion_items USING btree (id)
CREATE UNIQUE INDEX cotizaciones_pkey ON public.cotizaciones USING btree (id)
CREATE UNIQUE INDEX evidencias_fotograficas_pkey ON public.evidencias_fotograficas USING btree (id)
CREATE UNIQUE INDEX gastos_caja_menor_pkey ON public.gastos_caja_menor USING btree (id)
CREATE INDEX idx_caja_mov_fecha ON public.caja_movimientos USING btree (fecha DESC) WHERE (NOT anulado)
CREATE INDEX idx_citas_pendientes ON public.citas USING btree (fecha_hora) WHERE (estado = 'pendiente'::text)
CREATE INDEX idx_citas_vehiculo ON public.citas USING btree (vehiculo_id, fecha_hora DESC)
CREATE INDEX idx_clientes_nombre_trgm ON public.clientes USING gin (nombre extensions.gin_trgm_ops)
CREATE INDEX idx_clientes_telefono ON public.clientes USING btree (telefono)
CREATE INDEX idx_clientes_telefono_trgm ON public.clientes USING gin (telefono extensions.gin_trgm_ops)
CREATE INDEX idx_cot_items ON public.cotizacion_items USING btree (cotizacion_id)
CREATE INDEX idx_cotizaciones_estado ON public.cotizaciones USING btree (estado, fecha DESC)
CREATE INDEX idx_cotizaciones_vehiculo ON public.cotizaciones USING btree (vehiculo_id, fecha DESC)
CREATE INDEX idx_evidencias_orden ON public.evidencias_fotograficas USING btree (orden_id, tipo)
CREATE INDEX idx_evidencias_repuesto ON public.evidencias_fotograficas USING btree (orden_repuesto_id) WHERE (orden_repuesto_id IS NOT NULL)
CREATE INDEX idx_gastos_fecha ON public.gastos_caja_menor USING btree (fecha DESC, categoria)
CREATE INDEX idx_gastos_orden ON public.gastos_caja_menor USING btree (orden_id) WHERE (orden_id IS NOT NULL)
CREATE INDEX idx_gastos_vigentes ON public.gastos_caja_menor USING btree (fecha DESC) WHERE (NOT anulado)
CREATE INDEX idx_inventario_nombre_trgm ON public.inventario USING gin (nombre extensions.gin_trgm_ops)
CREATE INDEX idx_inventario_reponer ON public.inventario USING btree (nombre) WHERE (stock_actual <= stock_minimo)
CREATE INDEX idx_orden_repuestos_inv ON public.orden_repuestos USING btree (inventario_id)
CREATE INDEX idx_orden_repuestos_orden ON public.orden_repuestos USING btree (orden_id)
CREATE INDEX idx_ordenes_activas ON public.ordenes_servicio USING btree (fecha_ingreso DESC) WHERE (estado <> ALL (ARRAY['entregado'::estado_orden, 'cancelado'::estado_orden]))
CREATE INDEX idx_ordenes_estado ON public.ordenes_servicio USING btree (estado, fecha_ingreso DESC)
CREATE INDEX idx_ordenes_fin_garantia ON public.ordenes_servicio USING btree (fecha_fin_garantia) WHERE (fecha_fin_garantia IS NOT NULL)
CREATE INDEX idx_ordenes_vehiculo ON public.ordenes_servicio USING btree (vehiculo_id, fecha_ingreso DESC)
CREATE INDEX idx_pagos_fecha ON public.pagos_orden USING btree (fecha DESC) WHERE (NOT anulado)
CREATE INDEX idx_pagos_orden ON public.pagos_orden USING btree (orden_id) WHERE (NOT anulado)
CREATE INDEX idx_pagos_registrado_por ON public.pagos_orden USING btree (registrado_por)
CREATE INDEX idx_vehiculos_cliente ON public.vehiculos USING btree (cliente_id)
CREATE INDEX idx_vehiculos_placa_trgm ON public.vehiculos USING gin (placa extensions.gin_trgm_ops)
CREATE UNIQUE INDEX inventario_pkey ON public.inventario USING btree (id)
CREATE UNIQUE INDEX mantenimiento_pkey ON public.mantenimiento USING btree (id)
CREATE UNIQUE INDEX orden_repuestos_pkey ON public.orden_repuestos USING btree (id)
CREATE UNIQUE INDEX ordenes_servicio_pkey ON public.ordenes_servicio USING btree (id)
CREATE UNIQUE INDEX ordenes_servicio_token_publico_key ON public.ordenes_servicio USING btree (token_publico)
CREATE UNIQUE INDEX pagos_orden_pkey ON public.pagos_orden USING btree (id)
CREATE UNIQUE INDEX soporte_modo_pkey ON public.soporte_modo USING btree (user_id)
CREATE UNIQUE INDEX ux_cierre_fecha ON public.cierres_caja USING btree (fecha) WHERE (NOT anulado)
CREATE UNIQUE INDEX ux_clientes_documento_modo ON public.clientes USING btree (documento, es_prueba) WHERE (documento IS NOT NULL)
CREATE UNIQUE INDEX ux_inventario_codigo_modo ON public.inventario USING btree (codigo, es_prueba)
CREATE UNIQUE INDEX ux_vehiculos_placa_modo ON public.vehiculos USING btree (placa, es_prueba)
CREATE UNIQUE INDEX vehiculos_pkey ON public.vehiculos USING btree (id)

-- TRIGGERS
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.citas FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.cotizacion_items FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.evidencias_fotograficas FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.gastos_caja_menor FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.inventario FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.pagos_orden FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_00_guardia_soporte BEFORE INSERT OR DELETE OR UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION fn_guardia_soporte()
CREATE TRIGGER trg_citas_updated_at BEFORE UPDATE ON public.citas FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
CREATE TRIGGER trg_cot_items_bloqueo BEFORE INSERT OR DELETE OR UPDATE ON public.cotizacion_items FOR EACH ROW EXECUTE FUNCTION fn_cotizacion_items_bloqueo()
CREATE TRIGGER trg_cotizaciones_updated_at BEFORE UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
CREATE TRIGGER trg_evidencia_repuesto_coherente BEFORE INSERT OR UPDATE OF orden_repuesto_id, tipo, orden_id ON public.evidencias_fotograficas FOR EACH ROW EXECUTE FUNCTION fn_evidencia_repuesto_coherente()
CREATE TRIGGER trg_inventario_updated_at BEFORE UPDATE ON public.inventario FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
CREATE TRIGGER trg_orden_before_write BEFORE INSERT OR UPDATE ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION fn_orden_before_write()
CREATE TRIGGER trg_orden_repuestos_stock BEFORE INSERT OR DELETE OR UPDATE ON public.orden_repuestos FOR EACH ROW EXECUTE FUNCTION fn_orden_repuestos_stock()
CREATE TRIGGER trg_ordenes_updated_at BEFORE UPDATE ON public.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()
CREATE TRIGGER trg_vehiculos_placa BEFORE INSERT OR UPDATE OF placa ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION fn_normalizar_placa()

-- POLITICAS RLS
public.caja_movimientos movs_staff_insert INSERT using(-) check((( SELECT es_staff() AS es_staff) AND (tipo = ANY (ARRAY['fondo_inicial'::tipo_mov_caja, 'reposicion'::tipo_mov_caja, 'retiro'::tipo_mov_caja])) AND (anulado = false) AND (cierre_id IS NULL))) roles={authenticated}
public.caja_movimientos movs_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.cierres_caja cierres_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.citas citas_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.citas citas_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.citas citas_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.citas citas_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.citas citas_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.clientes clientes_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.clientes clientes_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.clientes clientes_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.clientes clientes_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.clientes clientes_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.cotizacion_items cotizacion_items_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.cotizacion_items cotizacion_items_staff_delete DELETE using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.cotizacion_items cotizacion_items_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.cotizacion_items cotizacion_items_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.cotizacion_items cotizacion_items_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.cotizaciones cotizaciones_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.cotizaciones cotizaciones_staff_delete DELETE using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.cotizaciones cotizaciones_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.cotizaciones cotizaciones_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.cotizaciones cotizaciones_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.evidencias_fotograficas evidencias_fotograficas_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.evidencias_fotograficas evidencias_fotograficas_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.evidencias_fotograficas evidencias_fotograficas_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.evidencias_fotograficas evidencias_fotograficas_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.evidencias_fotograficas evidencias_fotograficas_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.gastos_caja_menor gastos_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.gastos_caja_menor gastos_admin_update UPDATE using(( SELECT es_admin() AS es_admin)) check(( SELECT es_admin() AS es_admin)) roles={authenticated}
public.gastos_caja_menor gastos_caja_menor_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.gastos_caja_menor gastos_staff_insert INSERT using(-) check((( SELECT es_staff() AS es_staff) AND (anulado = false))) roles={authenticated}
public.gastos_caja_menor gastos_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.inventario inventario_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.inventario inventario_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.inventario inventario_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.inventario inventario_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.inventario inventario_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.mantenimiento mantenimiento_lectura SELECT using(true) check(-) roles={authenticated}
public.orden_repuestos orden_repuestos_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.orden_repuestos orden_repuestos_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.orden_repuestos orden_repuestos_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.orden_repuestos orden_repuestos_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.orden_repuestos orden_repuestos_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.ordenes_servicio ordenes_servicio_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.ordenes_servicio ordenes_servicio_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.ordenes_servicio ordenes_servicio_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.ordenes_servicio ordenes_servicio_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.ordenes_servicio ordenes_servicio_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.pagos_orden pagos_orden_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.pagos_orden pagos_staff_insert INSERT using(-) check((( SELECT es_staff() AS es_staff) AND (NOT (registrado_por IS DISTINCT FROM ( SELECT auth.uid() AS uid))) AND (anulado = false))) roles={authenticated}
public.pagos_orden pagos_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.soporte_modo soporte_modo_propio SELECT using((user_id = ( SELECT auth.uid() AS uid))) check(-) roles={authenticated}
public.vehiculos vehiculos_admin_delete DELETE using(( SELECT es_admin() AS es_admin)) check(-) roles={authenticated}
public.vehiculos vehiculos_modo ALL using((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) check((es_prueba = ( SELECT en_modo_prueba() AS en_modo_prueba))) roles={authenticated}
public.vehiculos vehiculos_staff_insert INSERT using(-) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
public.vehiculos vehiculos_staff_select SELECT using(( SELECT es_staff() AS es_staff)) check(-) roles={authenticated}
public.vehiculos vehiculos_staff_update UPDATE using(( SELECT es_staff() AS es_staff)) check(( SELECT es_staff() AS es_staff)) roles={authenticated}
storage.objects polo_storage_admin_delete DELETE using(((bucket_id = ANY (ARRAY['evidencias-ordenes'::text, 'facturas-gastos'::text])) AND ( SELECT es_admin() AS es_admin))) check(-) roles={authenticated}
storage.objects polo_storage_staff_insert INSERT using(-) check(((bucket_id = ANY (ARRAY['evidencias-ordenes'::text, 'facturas-gastos'::text])) AND ( SELECT es_staff() AS es_staff))) roles={authenticated}
storage.objects polo_storage_staff_select SELECT using(((bucket_id = ANY (ARRAY['evidencias-ordenes'::text, 'facturas-gastos'::text])) AND ( SELECT es_staff() AS es_staff))) check(-) roles={authenticated}
storage.objects polo_storage_staff_update UPDATE using(((bucket_id = ANY (ARRAY['evidencias-ordenes'::text, 'facturas-gastos'::text])) AND ( SELECT es_staff() AS es_staff))) check(((bucket_id = ANY (ARRAY['evidencias-ordenes'::text, 'facturas-gastos'::text])) AND ( SELECT es_staff() AS es_staff))) roles={authenticated}

-- RLS ACTIVADO
caja_movimientos t
cierres_caja t
citas t
clientes t
cotizacion_items t
cotizaciones t
evidencias_fotograficas t
gastos_caja_menor t
inventario t
mantenimiento t
orden_repuestos t
ordenes_servicio t
pagos_orden t
soporte_modo t
vehiculos t

-- FUNCIONES
CREATE OR REPLACE FUNCTION public.anular_cierre(p_id uuid, p_motivo text)
 RETURNS cierres_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.cierres_caja;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;

  update public.cierres_caja
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and anulado = false
   returning * into v;
  if not found then
    raise exception 'El cierre no existe o ya está anulado' using errcode = 'no_data_found';
  end if;

  -- El ajuste generado por ese arqueo también deja de contar.
  update public.caja_movimientos
     set anulado = true, anulado_motivo = 'Cierre anulado: ' || btrim(p_motivo),
         anulado_por = auth.uid(), anulado_at = now()
   where cierre_id = p_id and not anulado;

  return v;
end $function$

CREATE OR REPLACE FUNCTION public.anular_gasto(p_id uuid, p_motivo text, p_autor text)
 RETURNS gastos_caja_menor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.gastos_caja_menor;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  update public.gastos_caja_menor
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(),
         anulado_autor = p_autor, anulado_at = now()
   where id = p_id and anulado = false
   returning * into v;
  if not found then
    raise exception 'El gasto no existe o ya está anulado' using errcode = 'no_data_found';
  end if;
  return v;
end $function$

CREATE OR REPLACE FUNCTION public.anular_movimiento_caja(p_id uuid, p_motivo text)
 RETURNS caja_movimientos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.caja_movimientos;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.caja_movimientos where id = p_id and cierre_id is not null) then
    raise exception 'Este ajuste pertenece a un arqueo: anula el cierre en su lugar'
      using errcode = 'check_violation';
  end if;

  update public.caja_movimientos
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and not anulado
   returning * into v;
  if not found then
    raise exception 'El movimiento no existe o ya está anulado' using errcode = 'no_data_found';
  end if;
  return v;
end $function$

CREATE OR REPLACE FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text)
 RETURNS pagos_orden
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.pagos_orden;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'El motivo de la anulación es obligatorio'
      using errcode = 'check_violation';
  end if;

  update public.pagos_orden
     set anulado        = true,
         anulado_motivo = btrim(p_motivo),
         anulado_por    = auth.uid(),
         anulado_at     = now()
   where id = p_pago_id
     and anulado = false
   returning * into v;

  if not found then
    raise exception 'El pago no existe o ya está anulado'
      using errcode = 'no_data_found';
  end if;

  return v;
end $function$

CREATE OR REPLACE FUNCTION public.cambiar_mantenimiento(p_activo boolean, p_motivo text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not public.es_soporte() then
    raise exception 'Solo el usuario de soporte puede cambiar el mantenimiento.' using errcode = '42501';
  end if;
  update public.mantenimiento
     set activo = coalesce(p_activo, false),
         motivo = case when coalesce(p_activo, false) then nullif(left(btrim(coalesce(p_motivo, '')), 200), '') end,
         desde = case when coalesce(p_activo, false) then now() end,
         actualizado_por = auth.uid()
   where id;
  return coalesce(p_activo, false);
end $function$

CREATE OR REPLACE FUNCTION public.cambiar_modo_prueba(p_activo boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not public.es_soporte() then
    raise exception 'Solo el usuario de soporte puede cambiar de modo.' using errcode = '42501';
  end if;
  insert into public.soporte_modo (user_id, prueba)
  values (auth.uid(), coalesce(p_activo, false))
  on conflict (user_id) do update set prueba = excluded.prueba, updated_at = now();
  return coalesce(p_activo, false);
end $function$

CREATE OR REPLACE FUNCTION public.cerrar_caja(p_fecha date, p_conteo numeric, p_desglose jsonb, p_notas text, p_autor text)
 RETURNS cierres_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  hoy    date := (now() at time zone 'America/Bogota')::date;
  saldo  numeric;
  v      public.cierres_caja;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;
  if p_conteo is null or p_conteo < 0 then
    raise exception 'El conteo físico no puede ser negativo' using errcode = 'check_violation';
  end if;
  if p_fecha is null or p_fecha > hoy then
    raise exception 'No se puede cerrar la caja de una fecha futura' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.cierres_caja where fecha = p_fecha and not anulado) then
    raise exception 'Ya existe un cierre vigente para %. Anúlalo primero si necesitas rehacerlo.', p_fecha
      using errcode = 'unique_violation';
  end if;

  saldo := public.fn_saldo_caja(p_fecha);

  insert into public.cierres_caja (fecha, saldo_sistema, conteo_fisico, desglose, notas, autor)
  values (p_fecha, saldo, p_conteo, coalesce(p_desglose, '{}'::jsonb),
          nullif(btrim(coalesce(p_notas, '')), ''), p_autor)
  returning * into v;

  if v.diferencia <> 0 then
    insert into public.caja_movimientos (fecha, tipo, monto, notas, autor, cierre_id)
    values (p_fecha,
            case when v.diferencia > 0 then 'ajuste_sobrante'::public.tipo_mov_caja
                 else 'ajuste_faltante'::public.tipo_mov_caja end,
            abs(v.diferencia),
            'Ajuste por arqueo del ' || p_fecha,
            p_autor,
            v.id);
  end if;

  return v;
end $function$

CREATE OR REPLACE FUNCTION public.convertir_cotizacion(p_id uuid, p_autor text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  c          public.cotizaciones;
  v_total    numeric;
  v_trabajos text;
  v_orden    uuid;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  select * into c from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe' using errcode = 'no_data_found';
  end if;
  if c.estado = 'convertida' then
    raise exception 'La cotización ya fue convertida en una orden' using errcode = 'check_violation';
  end if;
  if c.estado = 'rechazada' then
    raise exception 'La cotización fue rechazada; no se puede convertir' using errcode = 'check_violation';
  end if;

  select c.mano_obra + coalesce(sum(cantidad * precio_unitario), 0),
         string_agg(trim_scale(cantidad)::text || ' × ' || descripcion, E'\n' order by created_at)
    into v_total, v_trabajos
    from public.cotizacion_items where cotizacion_id = c.id;
  v_total := coalesce(v_total, c.mano_obra);

  insert into public.ordenes_servicio
    (vehiculo_id, estado, mano_obra, total_cobrado, trabajos_a_realizar, notas, autor)
  values
    (c.vehiculo_id, 'recibido', c.mano_obra, v_total, v_trabajos,
     'Origen: cotización del ' || c.fecha || coalesce(E'\n' || c.notas, ''), p_autor)
  returning id into v_orden;

  update public.cotizaciones
     set estado = 'convertida', orden_id = v_orden
   where id = c.id;

  return v_orden;
end $function$

CREATE OR REPLACE FUNCTION public.editar_gasto(p_id uuid, p_fecha date, p_categoria categoria_gasto, p_monto numeric, p_descripcion text, p_orden_id uuid, p_autor text)
 RETURNS gastos_caja_menor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  antes public.gastos_caja_menor;
  v     public.gastos_caja_menor;
begin
  if not public.es_staff() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = 'check_violation';
  end if;
  if p_autor is not null and p_autor not in ('Polo', 'Soporte técnico') then
    raise exception 'Autor inválido' using errcode = 'check_violation';
  end if;

  select * into antes from public.gastos_caja_menor where id = p_id for update;
  if not found then
    raise exception 'El gasto no existe' using errcode = 'no_data_found';
  end if;
  if antes.anulado then
    raise exception 'El gasto está anulado y no se puede editar' using errcode = 'check_violation';
  end if;

  update public.gastos_caja_menor
     set fecha       = p_fecha,
         categoria   = p_categoria,
         monto       = p_monto,
         descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
         orden_id    = p_orden_id,
         updated_at  = now(),
         historial   = historial || jsonb_build_array(jsonb_build_object(
                         'at',    now(),
                         'por',   auth.uid(),
                         'autor', p_autor,
                         'antes', jsonb_build_object(
                           'fecha', antes.fecha, 'categoria', antes.categoria, 'monto', antes.monto,
                           'descripcion', antes.descripcion, 'orden_id', antes.orden_id)))
   where id = p_id
   returning * into v;
  return v;
end $function$

CREATE OR REPLACE FUNCTION public.en_mantenimiento()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select activo from public.mantenimiento where id), false);
$function$

CREATE OR REPLACE FUNCTION public.en_modo_prueba()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.es_soporte()
     and coalesce((select prueba from public.soporte_modo where user_id = auth.uid()), false);
$function$

CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin', false);
$function$

CREATE OR REPLACE FUNCTION public.es_soporte()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'soporte') = 'true', false);
$function$

CREATE OR REPLACE FUNCTION public.es_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') in ('admin','operario'), false);
$function$

CREATE OR REPLACE FUNCTION public.fn_cotizacion_items_bloqueo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_estado public.estado_cotizacion;
begin
  select estado into v_estado from public.cotizaciones
   where id = coalesce(new.cotizacion_id, old.cotizacion_id);
  if v_estado = 'convertida' then
    raise exception 'La cotización ya fue convertida en orden y no admite cambios'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $function$

CREATE OR REPLACE FUNCTION public.fn_evidencia_repuesto_coherente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.orden_repuesto_id is null then
    return new;
  end if;
  if new.tipo not in ('repuesto_viejo', 'repuesto_nuevo') then
    raise exception 'Solo las fotos de repuesto retirado o instalado se ligan a un repuesto.';
  end if;
  if not exists (
    select 1 from public.orden_repuestos r
    where r.id = new.orden_repuesto_id and r.orden_id = new.orden_id
  ) then
    raise exception 'El repuesto elegido no pertenece a esta orden.';
  end if;
  return new;
end
$function$

CREATE OR REPLACE FUNCTION public.fn_generar_token_publico()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public', 'extensions'
AS $function$
  select translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_');
$function$

CREATE OR REPLACE FUNCTION public.fn_guardia_soporte()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null then
    if public.en_mantenimiento() and not public.es_soporte() then
      raise exception 'La app está en mantenimiento y solo permite consultar. Inténtalo de nuevo en unos minutos.'
        using errcode = 'PC001';
    end if;
    if tg_op <> 'INSERT' then
      if old.es_prueba is distinct from public.en_modo_prueba() then
        raise exception 'Ese registro no existe en el modo actual.' using errcode = 'PC002';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $function$

CREATE OR REPLACE FUNCTION public.fn_mover_stock(p_inventario_id uuid, p_delta numeric)
 RETURNS inventario
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$

CREATE OR REPLACE FUNCTION public.fn_normalizar_placa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.placa := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));
  return new;
end $function$

CREATE OR REPLACE FUNCTION public.fn_orden_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  base date;
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

  -- Próximo mantenimiento preventivo (solo si el vehículo está listo/entregado).
  if new.mantenimiento_meses is null or new.estado not in ('listo', 'entregado') then
    new.proximo_mantenimiento := null;
  else
    if new.fecha_entrega is not null then
      base := (new.fecha_entrega at time zone 'America/Bogota')::date;
    elsif tg_op = 'UPDATE'
          and old.proximo_mantenimiento is not null
          and old.mantenimiento_meses is not distinct from new.mantenimiento_meses then
      base := null;                                  -- se conserva la fecha ya calculada
      new.proximo_mantenimiento := old.proximo_mantenimiento;
    else
      base := (now() at time zone 'America/Bogota')::date;
    end if;
    if base is not null then
      new.proximo_mantenimiento := (base + make_interval(months => new.mantenimiento_meses))::date;
    end if;
  end if;

  return new;
end $function$

CREATE OR REPLACE FUNCTION public.fn_orden_repuestos_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$

CREATE OR REPLACE FUNCTION public.fn_saldo_caja(p_hasta date DEFAULT NULL::date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with h as (select coalesce(p_hasta, (now() at time zone 'America/Bogota')::date) as hasta)
  select
    coalesce((select sum(case when m.tipo in ('fondo_inicial','reposicion','ajuste_sobrante')
                              then m.monto else -m.monto end)
                from public.caja_movimientos m, h
               where not m.anulado and m.fecha <= h.hasta), 0)
  + coalesce((select sum(case when p.es_devolucion then -p.monto else p.monto end)
                from public.pagos_orden p, h
               where p.medio = 'efectivo' and not p.anulado and p.fecha <= h.hasta), 0)
  - coalesce((select sum(g.monto)
                from public.gastos_caja_menor g, h
               where not g.anulado and g.fecha <= h.hasta), 0);
$function$

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$

CREATE OR REPLACE FUNCTION public.obtener_orden_publica(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      'total_cobrado',      o.total_cobrado,
      'pagado',             pg.pagado,
      'saldo',              o.total_cobrado - pg.pagado
    ),
    'cliente',  jsonb_build_object('nombre', c.nombre),
    'vehiculo', jsonb_build_object(
      'placa', v.placa, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio
    ),
    'repuestos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',              r.id,
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
               'notas',      e.notas,
               'orden_repuesto_id', e.orden_repuesto_id
             ) order by e.created_at)
      from public.evidencias_fotograficas e
      where e.orden_id = o.id
        and e.tipo <> 'factura_compra'      -- las facturas de proveedor son internas
    ), '[]'::jsonb)
  )
  from public.ordenes_servicio o
  join public.vehiculos v on v.id = o.vehiculo_id
  join public.clientes  c on c.id = v.cliente_id
  cross join lateral (
    select coalesce(sum(case when p.es_devolucion then -p.monto else p.monto end), 0) as pagado
    from public.pagos_orden p
    where p.orden_id = o.id and not p.anulado
  ) pg
  where o.token_publico = p_token
    and o.estado <> 'cancelado'
  limit 1;
$function$


-- PERMISOS DE EJECUCION
anular_cierre(p_id uuid, p_motivo text) anon=f authenticated=t service_role=t
anular_gasto(p_id uuid, p_motivo text, p_autor text) anon=f authenticated=t service_role=t
anular_movimiento_caja(p_id uuid, p_motivo text) anon=f authenticated=t service_role=t
anular_pago(p_pago_id uuid, p_motivo text) anon=f authenticated=t service_role=t
cambiar_mantenimiento(p_activo boolean, p_motivo text) anon=f authenticated=t service_role=t
cambiar_modo_prueba(p_activo boolean) anon=f authenticated=t service_role=t
cerrar_caja(p_fecha date, p_conteo numeric, p_desglose jsonb, p_notas text, p_autor text) anon=f authenticated=t service_role=t
convertir_cotizacion(p_id uuid, p_autor text) anon=f authenticated=t service_role=t
editar_gasto(p_id uuid, p_fecha date, p_categoria categoria_gasto, p_monto numeric, p_descripcion text, p_orden_id uuid, p_autor text) anon=f authenticated=t service_role=t
en_mantenimiento() anon=f authenticated=t service_role=t
en_modo_prueba() anon=f authenticated=t service_role=t
es_admin() anon=t authenticated=t service_role=t
es_soporte() anon=f authenticated=t service_role=t
es_staff() anon=t authenticated=t service_role=t
fn_cotizacion_items_bloqueo() anon=t authenticated=t service_role=t
fn_evidencia_repuesto_coherente() anon=f authenticated=f service_role=t
fn_generar_token_publico() anon=t authenticated=t service_role=t
fn_guardia_soporte() anon=f authenticated=f service_role=t
fn_mover_stock(p_inventario_id uuid, p_delta numeric) anon=f authenticated=f service_role=t
fn_normalizar_placa() anon=t authenticated=t service_role=t
fn_orden_before_write() anon=t authenticated=t service_role=t
fn_orden_repuestos_stock() anon=f authenticated=f service_role=t
fn_saldo_caja(p_hasta date) anon=f authenticated=t service_role=t
fn_set_updated_at() anon=t authenticated=t service_role=t
obtener_orden_publica(p_token text) anon=t authenticated=t service_role=t

-- VISTAS
v_balance_mensual (security_invoker=true)
 WITH ing AS (
         SELECT date_trunc('month'::text, (v_finanzas_orden.fecha_entrega AT TIME ZONE 'America/Bogota'::text))::date AS mes,
            sum(v_finanzas_orden.total_cobrado) AS ingresos,
            sum(v_finanzas_orden.costo_repuestos) AS costo_repuestos
           FROM v_finanzas_orden
          WHERE v_finanzas_orden.estado = 'entregado'::estado_orden AND v_finanzas_orden.fecha_entrega IS NOT NULL
          GROUP BY (date_trunc('month'::text, (v_finanzas_orden.fecha_entrega AT TIME ZONE 'America/Bogota'::text))::date)
        ), gas AS (
         SELECT date_trunc('month'::text, gastos_caja_menor.fecha::timestamp with time zone)::date AS mes,
            sum(gastos_caja_menor.monto) AS gastos_caja_menor
           FROM gastos_caja_menor
          WHERE NOT gastos_caja_menor.anulado
          GROUP BY (date_trunc('month'::text, gastos_caja_menor.fecha::timestamp with time zone)::date)
        )
 SELECT COALESCE(ing.mes, gas.mes) AS mes,
    COALESCE(ing.ingresos, 0::numeric) AS ingresos,
    COALESCE(ing.costo_repuestos, 0::numeric) AS costo_repuestos,
    COALESCE(gas.gastos_caja_menor, 0::numeric) AS gastos_caja_menor,
    COALESCE(ing.ingresos, 0::numeric) - COALESCE(ing.costo_repuestos, 0::numeric) - COALESCE(gas.gastos_caja_menor, 0::numeric) AS utilidad_real
   FROM ing
     FULL JOIN gas ON gas.mes = ing.mes;
v_balance_real (security_invoker=true)
 WITH fact AS (
         SELECT date_trunc('month'::text, (v_finanzas_orden.fecha_entrega AT TIME ZONE 'America/Bogota'::text))::date AS mes,
            sum(v_finanzas_orden.total_cobrado) AS facturado,
            sum(v_finanzas_orden.costo_repuestos) AS costo_repuestos
           FROM v_finanzas_orden
          WHERE v_finanzas_orden.estado = 'entregado'::estado_orden AND v_finanzas_orden.fecha_entrega IS NOT NULL
          GROUP BY (date_trunc('month'::text, (v_finanzas_orden.fecha_entrega AT TIME ZONE 'America/Bogota'::text))::date)
        ), cob AS (
         SELECT v_recaudo_mensual.mes,
            v_recaudo_mensual.neto AS cobrado
           FROM v_recaudo_mensual
        ), gas AS (
         SELECT date_trunc('month'::text, gastos_caja_menor.fecha::timestamp with time zone)::date AS mes,
            sum(gastos_caja_menor.monto) AS gastos
           FROM gastos_caja_menor
          WHERE NOT gastos_caja_menor.anulado
          GROUP BY (date_trunc('month'::text, gastos_caja_menor.fecha::timestamp with time zone)::date)
        ), meses AS (
         SELECT fact.mes
           FROM fact
        UNION
         SELECT cob.mes
           FROM cob
        UNION
         SELECT gas.mes
           FROM gas
        )
 SELECT m.mes,
    COALESCE(f.facturado, 0::numeric) AS facturado,
    COALESCE(c.cobrado, 0::numeric) AS cobrado,
    COALESCE(f.costo_repuestos, 0::numeric) AS costo_repuestos,
    COALESCE(g.gastos, 0::numeric) AS gastos,
    COALESCE(c.cobrado, 0::numeric) - COALESCE(f.costo_repuestos, 0::numeric) - COALESCE(g.gastos, 0::numeric) AS utilidad_real
   FROM meses m
     LEFT JOIN fact f ON f.mes = m.mes
     LEFT JOIN cob c ON c.mes = m.mes
     LEFT JOIN gas g ON g.mes = m.mes;
v_caja_diaria (security_invoker=true)
 WITH mov AS (
         SELECT caja_movimientos.fecha,
            sum(
                CASE
                    WHEN caja_movimientos.tipo = ANY (ARRAY['fondo_inicial'::tipo_mov_caja, 'reposicion'::tipo_mov_caja, 'ajuste_sobrante'::tipo_mov_caja]) THEN caja_movimientos.monto
                    ELSE 0::numeric
                END) AS entradas,
            sum(
                CASE
                    WHEN caja_movimientos.tipo = ANY (ARRAY['retiro'::tipo_mov_caja, 'ajuste_faltante'::tipo_mov_caja]) THEN caja_movimientos.monto
                    ELSE 0::numeric
                END) AS salidas
           FROM caja_movimientos
          WHERE NOT caja_movimientos.anulado
          GROUP BY caja_movimientos.fecha
        ), cob AS (
         SELECT pagos_orden.fecha,
            sum(
                CASE
                    WHEN pagos_orden.es_devolucion THEN - pagos_orden.monto
                    ELSE pagos_orden.monto
                END) AS cobros_efectivo
           FROM pagos_orden
          WHERE pagos_orden.medio = 'efectivo'::medio_pago AND NOT pagos_orden.anulado
          GROUP BY pagos_orden.fecha
        ), gas AS (
         SELECT gastos_caja_menor.fecha,
            sum(gastos_caja_menor.monto) AS gastos
           FROM gastos_caja_menor
          WHERE NOT gastos_caja_menor.anulado
          GROUP BY gastos_caja_menor.fecha
        ), dias AS (
         SELECT mov.fecha
           FROM mov
        UNION
         SELECT cob.fecha
           FROM cob
        UNION
         SELECT gas.fecha
           FROM gas
        )
 SELECT d.fecha,
    COALESCE(m.entradas, 0::numeric) AS entradas,
    COALESCE(m.salidas, 0::numeric) AS salidas,
    COALESCE(c.cobros_efectivo, 0::numeric) AS cobros_efectivo,
    COALESCE(g.gastos, 0::numeric) AS gastos,
    COALESCE(m.entradas, 0::numeric) - COALESCE(m.salidas, 0::numeric) + COALESCE(c.cobros_efectivo, 0::numeric) - COALESCE(g.gastos, 0::numeric) AS neto_dia
   FROM dias d
     LEFT JOIN mov m ON m.fecha = d.fecha
     LEFT JOIN cob c ON c.fecha = d.fecha
     LEFT JOIN gas g ON g.fecha = d.fecha;
v_cartera (security_invoker=true)
 SELECT orden_id,
    placa,
    cliente,
    telefono,
    estado,
    fecha_entrega,
    total_cobrado,
    pagado,
    saldo,
    estado_pago,
    ultimo_pago,
        CASE
            WHEN fecha_entrega IS NULL THEN NULL::integer
            ELSE (now() AT TIME ZONE 'America/Bogota'::text)::date - (fecha_entrega AT TIME ZONE 'America/Bogota'::text)::date
        END AS dias_desde_entrega
   FROM v_saldo_ordenes s
  WHERE estado <> 'cancelado'::estado_orden AND total_cobrado > 0::numeric AND saldo > 0::numeric;
v_cotizacion_totales (security_invoker=true)
 SELECT c.id AS cotizacion_id,
    COALESCE(i.total_repuestos, 0::numeric) AS total_repuestos,
    c.mano_obra,
    c.mano_obra + COALESCE(i.total_repuestos, 0::numeric) AS total,
    COALESCE(i.costo_estimado, 0::numeric) AS costo_estimado,
    c.mano_obra + COALESCE(i.total_repuestos, 0::numeric) - COALESCE(i.costo_estimado, 0::numeric) AS margen_estimado,
    COALESCE(i.items, 0) AS items
   FROM cotizaciones c
     LEFT JOIN ( SELECT cotizacion_items.cotizacion_id,
            sum(cotizacion_items.cantidad * cotizacion_items.precio_unitario) AS total_repuestos,
            sum(cotizacion_items.cantidad * cotizacion_items.costo_unitario) AS costo_estimado,
            count(*)::integer AS items
           FROM cotizacion_items
          GROUP BY cotizacion_items.cotizacion_id) i ON i.cotizacion_id = c.id;
v_finanzas_orden (security_invoker=true)
 SELECT o.id AS orden_id,
    v.placa,
    o.estado,
    o.fecha_entrega,
    o.mano_obra,
    o.total_cobrado,
    COALESCE(r.costo_repuestos, 0::numeric) AS costo_repuestos,
    COALESCE(r.precio_repuestos, 0::numeric) AS precio_repuestos,
    o.total_cobrado - COALESCE(r.costo_repuestos, 0::numeric) AS margen_bruto
   FROM ordenes_servicio o
     JOIN vehiculos v ON v.id = o.vehiculo_id
     LEFT JOIN ( SELECT orden_repuestos.orden_id,
            sum(orden_repuestos.cantidad_usada * orden_repuestos.costo_unitario) AS costo_repuestos,
            sum(orden_repuestos.cantidad_usada * orden_repuestos.precio_unitario) AS precio_repuestos
           FROM orden_repuestos
          GROUP BY orden_repuestos.orden_id) r ON r.orden_id = o.id;
v_garantias (security_invoker=true)
 SELECT o.id AS orden_id,
    v.placa,
    c.nombre AS cliente,
    c.telefono,
    o.fecha_entrega,
    o.dias_garantia,
    o.fecha_fin_garantia,
    o.fecha_fin_garantia - h.hoy AS dias_restantes,
        CASE
            WHEN o.fecha_fin_garantia < h.hoy THEN 'rojo'::text
            WHEN (o.fecha_fin_garantia - h.hoy) <= 7 THEN 'amarillo'::text
            ELSE 'verde'::text
        END AS semaforo
   FROM ordenes_servicio o
     JOIN vehiculos v ON v.id = o.vehiculo_id
     JOIN clientes c ON c.id = v.cliente_id
     CROSS JOIN LATERAL ( SELECT (now() AT TIME ZONE 'America/Bogota'::text)::date AS hoy) h
  WHERE o.fecha_fin_garantia IS NOT NULL;
v_inventario_reposicion (security_invoker=true)
 SELECT id,
    codigo,
    nombre,
    tipo_unidad,
    stock_actual,
    stock_minimo,
    stock_minimo - stock_actual AS faltante
   FROM inventario
  WHERE stock_actual <= stock_minimo;
v_mantenimientos (security_invoker=true)
 SELECT orden_id,
    vehiculo_id,
    placa,
    marca,
    modelo,
    anio,
    cliente,
    telefono,
    mantenimiento_meses,
    proximo_mantenimiento,
    proximo_mantenimiento - (now() AT TIME ZONE 'America/Bogota'::text)::date AS dias_restantes,
        CASE
            WHEN proximo_mantenimiento < (now() AT TIME ZONE 'America/Bogota'::text)::date THEN 'vencido'::text
            WHEN (proximo_mantenimiento - (now() AT TIME ZONE 'America/Bogota'::text)::date) <= 15 THEN 'proximo'::text
            ELSE 'lejano'::text
        END AS estado_mantenimiento
   FROM ( SELECT DISTINCT ON (o.vehiculo_id) o.id AS orden_id,
            o.vehiculo_id,
            v.placa,
            v.marca,
            v.modelo,
            v.anio,
            c.nombre AS cliente,
            c.telefono,
            o.mantenimiento_meses,
            o.proximo_mantenimiento
           FROM ordenes_servicio o
             JOIN vehiculos v ON v.id = o.vehiculo_id
             JOIN clientes c ON c.id = v.cliente_id
          WHERE o.estado = ANY (ARRAY['listo'::estado_orden, 'entregado'::estado_orden])
          ORDER BY o.vehiculo_id, (COALESCE(o.fecha_entrega, o.created_at)) DESC) x
  WHERE proximo_mantenimiento IS NOT NULL;
v_recaudo_mensual (security_invoker=true)
 SELECT date_trunc('month'::text, fecha::timestamp with time zone)::date AS mes,
    sum(
        CASE
            WHEN es_devolucion THEN 0::numeric
            ELSE monto
        END) AS recaudado,
    sum(
        CASE
            WHEN es_devolucion THEN monto
            ELSE 0::numeric
        END) AS devoluciones,
    sum(
        CASE
            WHEN es_devolucion THEN - monto
            ELSE monto
        END) AS neto,
    sum(
        CASE
            WHEN es_devolucion THEN - monto
            ELSE monto
        END) FILTER (WHERE medio = 'efectivo'::medio_pago) AS neto_efectivo,
    sum(
        CASE
            WHEN es_devolucion THEN - monto
            ELSE monto
        END) FILTER (WHERE medio = 'transferencia'::medio_pago) AS neto_transferencia,
    sum(
        CASE
            WHEN es_devolucion THEN - monto
            ELSE monto
        END) FILTER (WHERE medio = 'tarjeta'::medio_pago) AS neto_tarjeta,
    sum(
        CASE
            WHEN es_devolucion THEN - monto
            ELSE monto
        END) FILTER (WHERE medio = 'otro'::medio_pago) AS neto_otro
   FROM pagos_orden
  WHERE NOT anulado
  GROUP BY (date_trunc('month'::text, fecha::timestamp with time zone)::date);
v_rentabilidad_orden (security_invoker=true)
 SELECT o.id AS orden_id,
    o.vehiculo_id,
    v.placa,
    c.nombre AS cliente,
    o.estado,
    o.fecha_entrega,
    o.total_cobrado,
    COALESCE(pg.pagado, 0::numeric) AS pagado,
    COALESCE(r.costo, 0::numeric) AS costo_repuestos,
    COALESCE(g.gastos, 0::numeric) AS gastos_directos,
    COALESCE(pg.pagado, 0::numeric) - COALESCE(r.costo, 0::numeric) - COALESCE(g.gastos, 0::numeric) AS utilidad_real,
    o.total_cobrado - COALESCE(r.costo, 0::numeric) - COALESCE(g.gastos, 0::numeric) AS utilidad_facturada
   FROM ordenes_servicio o
     JOIN vehiculos v ON v.id = o.vehiculo_id
     JOIN clientes c ON c.id = v.cliente_id
     LEFT JOIN ( SELECT orden_repuestos.orden_id,
            sum(orden_repuestos.cantidad_usada * orden_repuestos.costo_unitario) AS costo
           FROM orden_repuestos
          GROUP BY orden_repuestos.orden_id) r ON r.orden_id = o.id
     LEFT JOIN ( SELECT pagos_orden.orden_id,
            sum(
                CASE
                    WHEN pagos_orden.es_devolucion THEN - pagos_orden.monto
                    ELSE pagos_orden.monto
                END) AS pagado
           FROM pagos_orden
          WHERE NOT pagos_orden.anulado
          GROUP BY pagos_orden.orden_id) pg ON pg.orden_id = o.id
     LEFT JOIN ( SELECT gastos_caja_menor.orden_id,
            sum(gastos_caja_menor.monto) AS gastos
           FROM gastos_caja_menor
          WHERE gastos_caja_menor.orden_id IS NOT NULL AND NOT gastos_caja_menor.anulado
          GROUP BY gastos_caja_menor.orden_id) g ON g.orden_id = o.id
  WHERE o.estado <> 'cancelado'::estado_orden;
v_saldo_ordenes (security_invoker=true)
 SELECT o.id AS orden_id,
    v.placa,
    c.nombre AS cliente,
    c.telefono,
    o.estado,
    o.fecha_entrega,
    o.total_cobrado,
    COALESCE(p.pagado, 0::numeric) AS pagado,
    o.total_cobrado - COALESCE(p.pagado, 0::numeric) AS saldo,
        CASE
            WHEN o.total_cobrado <= 0::numeric AND COALESCE(p.pagado, 0::numeric) <= 0::numeric THEN 'sin_total'::text
            WHEN COALESCE(p.pagado, 0::numeric) <= 0::numeric THEN 'sin_pago'::text
            WHEN COALESCE(p.pagado, 0::numeric) < o.total_cobrado THEN 'parcial'::text
            WHEN COALESCE(p.pagado, 0::numeric) = o.total_cobrado THEN 'pagado'::text
            ELSE 'sobrepago'::text
        END AS estado_pago,
    p.ultimo_pago
   FROM ordenes_servicio o
     JOIN vehiculos v ON v.id = o.vehiculo_id
     JOIN clientes c ON c.id = v.cliente_id
     LEFT JOIN ( SELECT pagos_orden.orden_id,
            sum(
                CASE
                    WHEN pagos_orden.es_devolucion THEN - pagos_orden.monto
                    ELSE pagos_orden.monto
                END) AS pagado,
            max(pagos_orden.fecha) FILTER (WHERE NOT pagos_orden.es_devolucion) AS ultimo_pago
           FROM pagos_orden
          WHERE NOT pagos_orden.anulado
          GROUP BY pagos_orden.orden_id) p ON p.orden_id = o.id;

-- ENUMS
categoria_gasto: ayudante,alimentacion_refrigerio,flete_acarreo,herramienta_consumible,otros
estado_cotizacion: borrador,enviada,aprobada,rechazada,convertida
estado_orden: recibido,diagnostico,en_proceso,listo,entregado,cancelado
medio_pago: efectivo,transferencia,tarjeta,otro
tipo_evidencia: ingreso,repuesto_viejo,repuesto_nuevo,prueba_tecnica,factura_compra
tipo_mov_caja: fondo_inicial,reposicion,retiro,ajuste_sobrante,ajuste_faltante
tipo_unidad: unidad,gramo,libra,onza

-- PERMISOS DE TABLA
caja_movimientos authenticated INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE
cierres_caja authenticated INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE
citas authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
clientes authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
cotizacion_items authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
cotizaciones authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
evidencias_fotograficas authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
gastos_caja_menor authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
inventario authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
mantenimiento authenticated REFERENCES,SELECT,TRIGGER
orden_repuestos authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
ordenes_servicio authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
pagos_orden authenticated INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE
soporte_modo authenticated REFERENCES,SELECT,TRIGGER
v_balance_mensual authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_balance_real anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_balance_real authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_caja_diaria anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_caja_diaria authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_cartera anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_cartera authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_cotizacion_totales anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_cotizacion_totales authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_finanzas_orden authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_garantias authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_inventario_reposicion authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_mantenimientos anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_mantenimientos authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_recaudo_mensual anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_recaudo_mensual authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_rentabilidad_orden anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_rentabilidad_orden authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_saldo_ordenes anon DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
v_saldo_ordenes authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
vehiculos authenticated DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE

-- BUCKETS
evidencias-ordenes public=f limite=2097152 tipos={image/jpeg,image/png,image/webp}
facturas-gastos public=f limite=3145728 tipos={image/jpeg,image/png,image/webp,application/pdf}
