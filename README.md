# Polo Air Cool

PWA mobile-first para el taller de aire acondicionado automotriz: clientes y vehículos, órdenes de
servicio con bitácora fotográfica, inventario, caja menor, balance, garantías y portal público
para el cliente con avisos por WhatsApp.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · lucide-react.

## Puesta en marcha

1. **Base de datos** (Supabase > SQL Editor): ejecuta los archivos de `supabase/migrations/` **en orden alfabético**
   (el nombre lleva la versión, así que el orden nunca es ambiguo):
   1. `…01_fase1_base.sql`
   2. `…02_fase2_diagnostico.sql`
   3. `…03_fase3_pagos.sql` (pagos y abonos de clientes; ver su bloque opcional de migración al final)
   4. `…04_fase4_gastos_cotizaciones.sql` (gastos auditables, cotizaciones, pertenencias, mantenimiento)
   5. `…05_fase5_fotos_repuesto.sql` (cada foto de repuesto retirado / instalado queda ligada a su repuesto)
   6. `…06_fase6_soporte.sql` (usuario de soporte: modo prueba y mantenimiento; ver «Usuario de soporte»)
   7. `…07_fase7_agenda.sql` (agenda de citas; requiere la fase 6)
   8. `…08_fase8_avisos.sql` (suscripciones a los avisos de la agenda; requiere la fase 7)
   Si tu base ya tenía las fases 1 a 5 ejecutadas con los archivos anteriores (`polo_air_cool_faseN.sql`), **no hay que
   volver a ejecutar nada**: los archivos nuevos producen exactamente el mismo esquema.
2. **Usuarios y roles.** Crea los usuarios en Supabase > Authentication y asigna el rol
   (`admin` u `operario`) con el SQL que aparece al inicio de la migración `…01_fase1_base.sql`.
   Sin rol, el login se rechaza. El usuario de soporte se asigna con la migración de la fase 6 (ver «Usuario de soporte»).
3. **Variables de entorno.** Copia `.env.example` a `.env.local` y complétalo:

   | Variable | Uso |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión (obligatorias) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor. Firma las fotos del portal público. **Nunca** con prefijo `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SITE_URL` | URL pública (`https://tu-dominio.com`) para los enlaces `/orden/[token]` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | **Avisos** de la agenda (notificaciones push). Ver «Avisos». Sin ellas la app funciona igual, solo sin avisos |
   | `WHATSAPP_*` | Envío automático opcional vía Evolution API / WAHA (ver `.env.example`) |

4. `npm install` y `npm run dev`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas unitarias (Vitest) de las reglas de negocio |

## Despliegue

Producción: https://polo-air-cool.vercel.app · Repositorio: https://github.com/Johan-SnaiderMM/Air-Polo-Cool

- **Vercel ↔ GitHub:** cada push a `main` despliega a producción automáticamente (integración Git de Vercel).
- **Hook de Claude Code:** `.claude/settings.json` ejecuta `scripts/auto-deploy.mjs` al terminar cada respuesta.
  Si hay cambios corre `typecheck`, `lint`, pruebas y `build`; solo si todo pasa hace commit y push. Si algo falla,
  no se sube nada y el error vuelve a Claude para corregirlo.
- **CI en GitHub:** `.github/workflows/ci.yml` repite las verificaciones en cada push y pull request.
- **Manual:** `git push` (despliega) o `npm run deploy` (CLI de Vercel directo; requiere `npx vercel login`).
- Las variables de entorno viven en Vercel (Project Settings > Environment Variables); cambiarlas requiere redesplegar.

## Vocabulario del taller

Un vehículo se describe como **Marca – Línea – Modelo** (ej. Chevrolet – Spark GT – 2018), donde *Modelo* es el año.
En la base de datos las columnas siguen llamándose `marca`, `modelo` (= línea) y `anio` (= modelo); solo cambian las etiquetas de la interfaz.

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/` | Inicio: estado del taller, caja, por cobrar, alertas (garantías, mantenimientos, stock) y utilidad |
| `/agenda` | **Agenda de citas**: quién viene y a qué hora (hoy, mañana…), con recordatorio por WhatsApp; incluye los mantenimientos preventivos que aún no tienen cita (ver «Agenda») |
| `/ordenes` | Órdenes con pertenencias al ingreso, repuestos, fotos, **pagos y saldo**, comprobante/PDF |
| `/cotizaciones` | Cotización previa (estados borrador → enviada → aprobada → convertida en orden), WhatsApp y PDF |
| `/cartera` | Cuentas por cobrar por cliente, con recordatorio de saldo por WhatsApp |
| `/vehiculos`, `/garantias` | Historial por placa; garantías y **mantenimientos preventivos** con recordatorio por WhatsApp |
| `/caja-menor` | **Gastos** (POS, plantillas, fecha, orden asociada, edición/anulación auditada), **Cobros** (efectivo vs. transferencia del mes), **Balance** (base cobrado, gráfica por categoría, rentabilidad, CSV/PDF) |

## Agenda

Una cita es «este vehículo viene tal día a tal hora» y solo guarda lo mínimo: vehículo (que ya tiene a su cliente), día, hora,
tipo (servicio / mantenimiento) y una nota. Pertenencias, kilometraje y diagnóstico se toman cuando el vehículo llega y se
crea la orden.

- **Agendar:** el mismo selector de las órdenes y cotizaciones: se busca un vehículo ya registrado o se da de alta uno nuevo con
  lo básico (nombre y WhatsApp del cliente, placa, marca, línea; el año es opcional).
- **Vista:** `/agenda` agrupa por día (Hoy, Mañana, …). Las citas de días anteriores que nadie marcó salen aparte en «Sin
  atender» (hasta 14 días atrás) para recibirlas, reprogramarlas o cancelarlas. Hoy y mañana también se resumen en el inicio.
- **Recordatorio:** el botón abre WhatsApp con el mensaje ya redactado y anota que se avisó (si se reprograma, se puede volver a
  avisar). No hay envío automático.
- **Recibir vehículo:** abre «Nueva orden» con ese vehículo ya elegido. La cita **se cierra sola cuando la orden se guarda** (la
  operación de la orden lleva el id de la cita y el servidor la marca como cumplida, solo si es del mismo vehículo y sigue
  pendiente). Si la orden se guardó sin red, la cita se cierra cuando se sincroniza; si nunca se guarda, la cita sigue pendiente.
- **Nueva orden para un vehículo con citas** (sin pasar por la agenda): al elegir un vehículo ya registrado, el formulario
  revisa sus citas pendientes de **hoy, los próximos 7 días y las atrasadas**. La de **hoy** viene elegida y se cierra sola al guardar la
  orden. Por las de **los próximos días** pregunta «¿Este ingreso es de la cita programada?»: **sí** la marca como cumplida
  aunque el cliente haya venido antes; **no** (ingreso aparte) la deja agendada. Las **atrasadas** (días anteriores que nadie atendió, hasta 14 días atrás, las mismas de
  «Sin atender») se ofrecen igual y también se preguntan: el cliente pudo llegar tarde. Hay que responder antes de crear la orden.
  Un vehículo nuevo no tiene citas; sin red o si la agenda no responde (6 s), la orden se crea igual sin preguntar.
- **Mantenimientos por programar:** los vehículos con mantenimiento preventivo vencido o próximo (ver «Garantías») y sin cita
  aparecen al final de la agenda con «Agendar» (abre el formulario con el vehículo, el tipo y el día que les toca) y «Avisarle».
- **Horas:** se guardan como instante y se muestran siempre en hora de Colombia (UTC-5, sin horario de verano).
- **Límites:** requiere conexión (no pasa por la cola offline). Respeta el modo prueba y el mantenimiento de la fase 6.

## Avisos (notificaciones push)

Dos resúmenes al día llegan al teléfono, aunque la app esté cerrada, a **todos los teléfonos suscritos**:

| Hora (Colombia) | Qué dice |
| --- | --- |
| **7:00 a. m.** | Las citas de **hoy**: «3 citas hoy · 2 por recordar» o «… · todas ya recordadas». Si hay citas atrasadas sin atender, las menciona. |
| **5:30 p. m.** | Las citas de **mañana**, para recordárselas hoy a los clientes: «2 citas mañana · 1 por recordar». |

«Por recordar» son las citas a las que aún no se les tocó el botón de WhatsApp. Si no hay citas, **no avisa**. Al tocar el aviso
se abre la agenda.

- **Activarlos:** campana del encabezado → «Activar avisos en este teléfono» (cada teléfono, una vez). Un punto ocre en la campana
  indica que aún no están activados.
- **iPhone:** solo funcionan con la app **instalada en la pantalla de inicio** (iOS 16.4 o posterior); el panel lo explica.
  En Android basta con Chrome.
- **Cómo funciona:** el teléfono se suscribe (Web Push, claves VAPID) y el servidor guarda la suscripción (`push_suscripciones`;
  solo el servidor la lee, con la clave de servicio). Dos tareas programadas de Vercel (`vercel.json`, **en UTC**: 12:00 y 22:30)
  llaman a `/api/cron/avisos?franja=dia|tarde`, protegida con `CRON_SECRET`. Cada envío se reserva por día y franja
  (`push_envios`), así que un reintento no repite el aviso. Las suscripciones que el navegador ya no reconoce se borran solas.
- **Lo que haga soporte no se nota:** el resumen **solo cuenta citas reales**; las de modo prueba nunca generan avisos. Soporte
  tiene en el mismo panel «Enviar un aviso de prueba», que llega **solo a sus propios teléfonos**.
- **Configuración (una vez):** las claves se generaron en `.env.push.local` (ignorado por git). Hay que copiar sus 4 variables
  a Vercel (Settings → Environment Variables) y volver a desplegar; opcionalmente a `.env.local` para probar en local. Sin
  ellas la campana queda oculta (salvo para soporte, que ve el motivo) y el programador responde «sin configurar».
- **Límites:** la entrega no está garantizada al 100 % (algunos Android con ahorro de batería agresivo la retrasan). En el plan
  gratuito de Vercel las tareas programadas están limitadas (según la documentación vigente: frecuencia y precisión de hora);
  con el plan Pro, que ya se necesita para cobrar, son exactas. Verifica el plan antes de prometer la hora exacta.
- **Pruebas:** el resumen, el envío (con `web-push` simulado), la ruta programada, las acciones y el service worker están
  probados; la entrega real a un teléfono solo se comprueba con un iPhone y un Android de verdad.

## Modo oscuro

El botón de la luna/sol del encabezado alterna entre claro y oscuro y recuerda la elección **en ese teléfono**
(`localStorage`, clave `polo:tema`). Mientras no se toque, se sigue la preferencia del sistema.

- **Cómo se aplica:** un script en `<head>` (`src/lib/tema.ts`) pone `data-tema="dark"` en `<html>` **antes de pintar**, así no hay
  un destello claro al abrir. Todo el tema está en `src/app/tema-oscuro.css`: redefine las variables de color del sistema de
  diseño (grises invertidos, fondos tintados de los estados, papel y tinta) y ajusta las pocas clases donde un mismo color hace dos
  oficios (p. ej. `ink` es el texto y también el relleno de los botones). El modo claro no cambia.
- **El portal del cliente (`/orden/…`) siempre se ve claro**, aunque el teléfono sea oscuro: es un documento de la marca para quien
  no tiene la app. Los comprobantes impresos o en PDF también salen claros.
- **Al añadir colores nuevos:** usa las variables/clases del sistema (`bg-white`, `text-ink`, `stone-*`, `sage/ochre/brick-*`). Si usas un
  color fijo (hexadecimal), no cambiará con el tema.

## Iconos

- **Aviso (notificación):** `public/icons/badge-96.png` es un copo blanco sobre transparente; Android lo pinta como silueta de un
  solo color en la barra de estado.
- **Pantalla de carga del teléfono:** Android la arma con el icono `maskable` (logo sobre azul marino `#0b1633`) puesto sobre el
  `background_color` del manifiesto, que es **ese mismo azul marino**: así el marco del icono no se ve y queda solo el logo sobre
  un fondo liso. El manifiesto no puede cambiar con el tema (claro/oscuro), por eso se eligió un color que se ve bien en ambos.
  Android guarda ese icono y color **dentro de la app instalada**: en un teléfono donde ya estaba instalada, el cambio solo llega
  cuando Chrome actualiza la app (puede tardar días) o si se **desinstala y se vuelve a instalar**.
- **Barra del navegador / estado:** `theme-color` tiene una versión clara y otra oscura según el sistema, y el botón del tema la
  ajusta cuando se elige a mano.

## Legal y buscadores

- **Páginas públicas** (sin sesión): `/legal/privacidad` (política de tratamiento de datos, Ley 1581 de 2012) y `/legal/aviso`
  (aviso legal). Tienen enlace en el login, en el pie del portal del cliente y al final del inicio. El texto está en
  `src/lib/legal.ts`.
- **Es un borrador de partida**, escrito según cómo funciona la app hoy (datos que guarda, proveedores, el enlace de seguimiento,
  cookies). Antes de darlo por definitivo debe revisarlo una persona con criterio legal; sobre todo si la app se va a usar en
  otros talleres (cada taller es responsable de sus datos y necesita su propia política).
- **Datos que faltan:** en `RESPONSABLE` (`src/lib/legal.ts`) están, sin completar, la razón social, el NIT, la dirección y el
  correo para consultas de datos. Lo que no se complete se omite del texto; siempre queda el teléfono/WhatsApp del taller como canal.
  Al cambiar el texto, actualiza `ACTUALIZADO_LEGAL`.
- **Buscadores:** la app es privada. `robots.txt` bloquea todo (`src/app/robots.ts`) y todas las páginas llevan `noindex`.
  Si algún día hay una página pública del taller, se permite solo esa ruta.

## Fotos de repuestos

Al tomar una foto de **repuesto retirado** o **instalado**, primero se elige de qué repuesto de la orden es. En la
bitácora las fotos se agrupan «Por repuesto» (retirado | instalado) y el cliente las ve igual en su enlace. Las fotos
anteriores a la fase 5 quedan «sin asignar» y se ligan con el selector «Asignar a…». Si se quita un repuesto de la
orden, sus fotos se conservan. Sin ejecutar `fase5.sql` todo sigue funcionando, solo sin el vínculo.

## Reglas contables

- **Sin caja física**: el taller maneja el dinero de forma informal, así que no hay saldo, fondo, arqueo ni cierre.
  Cada cobro guarda su **medio de pago** (efectivo, transferencia, tarjeta, otro) y la pestaña **Cobros** muestra
  cuánto entró por cada uno. Las tablas de caja que creó `fase4.sql` siguen en la base pero la app ya no las usa.
- **Utilidad neta real** = cobrado del mes − costo de repuestos (órdenes entregadas) − gastos de caja menor.
  No se asume que lo facturado está pagado; el saldo por cobrar sale de `pagos_orden`.
- **Nada se borra**: gastos y pagos se **anulan con motivo** (queda quién, cuándo y por qué);
  las ediciones de un gasto guardan los valores anteriores.
- **Autoría**: cada operador entra con su propio usuario y el sello ("Polo" / "Soporte técnico") sale de la sesión; se
  estampa en los registros nuevos. Es informativo: la seguridad real es la sesión y el RLS de Supabase.

## Persistencia y modo sin conexión

**Qué funciona sin red** (se guarda en el teléfono y se sube solo al volver la conexión): registrar **gastos**,
**abonos/pagos**, **crear órdenes** (con vehículo/cliente nuevos) y **subir fotos**
(evidencias y recibos). Además se pueden **consultar las pantallas ya visitadas**.

**Qué requiere conexión**: editar o anular registros, cotizaciones, editar una orden existente y cualquier pantalla que no se haya abierto antes en ese teléfono.

**Dónde vive cada dato local**

| Almacén | Dónde | Qué guarda |
| --- | --- | --- |
| `outbox` | IndexedDB (`polo-air-cool`) | Cola de sincronización FIFO: operaciones pendientes/fallidas |
| `blobs` | IndexedDB | Fotos pendientes de subir (Blob nativo, sin base64) |
| `cache` | IndexedDB | Snapshot de vehículos y órdenes (selectores offline), plantillas de gasto |
| Páginas visitadas | Cache Storage (`public/sw.js`) | Última copia de cada pantalla (HTML y datos RSC) |

**Cómo se sincroniza** (`src/lib/offline/`):
1. Cada registro nace con un **UUID generado en el teléfono**. Al reenviar, el servidor detecta el id repetido y lo trata
   como "ya hecho": un corte de red a mitad de camino **nunca duplica** dinero ni órdenes.
2. `registrar()` envía directo si hay red y la cola está vacía; si no, encola y sincroniza al volver la conexión
   (evento `online`, cada 30 s y al abrir la app).
3. Estricto **FIFO** (una foto nunca llega antes que su orden). Errores permanentes (validación, permisos) marcan la
   operación como *fallida* con su motivo y siguen con las demás; errores de red/servidor detienen y reintentan luego;
   sesión expirada detiene sin perder nada.
4. El encabezado muestra el estado real de conexión y el número de pendientes; al tocarlo se abre el panel con la cola,
   los errores a revisar (reintentar / descartar) y la antigüedad de los datos de referencia.
5. Se pide `navigator.storage.persist()` para que el navegador no purgue la cola. Al **cerrar sesión** se borran las
   cachés de páginas y de referencia, pero **no** la cola de pendientes.

## Estructura

- `src/app/(app)/` — pantallas internas (protegidas): inicio, órdenes, cotizaciones, cartera, vehículos, garantías, inventario, caja menor.
- `src/app/orden/[token]/` — portal público del cliente (sin login; datos vía RPC `obtener_orden_publica`).
- `src/app/login/` — acceso del taller.
- `src/proxy.ts` — refresca la sesión de Supabase y redirige a `/login` (en Next 16 reemplaza a `middleware.ts`).
- `src/utils/supabase/` — clientes: navegador, servidor, público (anónimo) y admin (service role, solo servidor).
- `src/lib/` — reglas puras (garantías, teléfonos, meses, cobros por medio, CSV, cotizaciones, plantillas de WhatsApp) y sus pruebas.
- `src/lib/datos/` — capa de acceso a datos, una por área: `ordenes` (lista, detalle, comprobante), `inicio`, `caja` (gastos, cobros, balance, reporte), `vehiculos`, `garantias`, `cartera`, `inventario`, `cotizaciones`, `agenda`. Los avisos viven en `src/lib/push/` (texto del resumen, envío y tarea diaria). Las páginas no hacen consultas: piden un modelo ya armado (con tipos propios, sin `as`), y lo independiente se consulta en paralelo. `mapeo.ts` tiene las transformaciones puras; se prueban con un Supabase simulado.
- `src/lib/offline/` — operaciones offline (validación), almacén IndexedDB, algoritmo de sincronización y búsqueda local.
- `src/components/sync/` — `sync-provider.tsx` compone tres hooks: `use-red` (conexión efectiva), `use-snapshot` (datos de referencia locales) y `use-cola` (registrar, sincronizar, reintentar); además el proveedor de autoría y el panel de pendientes.
- `public/sw.js` — service worker (lectura offline de páginas ya visitadas); `public/offline.html` — pantalla sin conexión.

## Usuario de soporte

Un segundo usuario (`soporte@aircool.com`) con los mismos permisos que el admin, más dos poderes que se manejan desde el
icono de llave del encabezado (solo él lo ve):

- **Modo prueba.** Cada fila de las tablas operativas lleva `es_prueba` (por defecto, el modo de quien la crea). Un usuario
  solo ve y toca filas de su modo: Polo siempre ve lo real; soporte ve lo real o lo de prueba según el interruptor. Lo de
  prueba no suma en cobros, balance, inventario ni garantías reales (las vistas heredan el RLS), y placa, código de
  inventario y documento son únicos *por modo*. Una franja ocre avisa mientras se trabaja en prueba. Al cambiar de modo se
  borra lo guardado en el teléfono y no se permite si hay registros sin sincronizar (se enviarían al modo equivocado).
  Las fotos de prueba sí se guardan en los mismos buckets (quedan ligadas a filas de prueba).
- **Mantenimiento.** Interruptor global con motivo opcional. Mientras está activo, Polo solo consulta: la base rechaza sus
  escrituras (`PC001`), también dentro de las funciones que se saltan el RLS (anular pago, convertir cotización…), y la app
  le muestra una pantalla de aviso. Lo que registre sin red queda en la cola y se sube solo al terminar. Soporte sigue
  escribiendo. Si se quedara activo sin nadie que lo apague: `update public.mantenimiento set activo = false;` en el SQL Editor.
- **Cómo se asigna.** La migración de la fase 6 marca `app_metadata.soporte = true` (y rol `admin` si no tenía) al usuario
  `soporte@aircool.com`; hay que cerrar sesión y volver a entrar para que el token la lleve. Si el usuario se crea después,
  se vuelve a ejecutar la migración. La marca no la puede editar el propio usuario.
- **Cómo se hace cumplir.** Una política RESTRICTIVA y un trigger (`fn_guardia_soporte`) por tabla, sin redefinir ninguna
  función ni política existente. Sin sesión de usuario (service role, SQL Editor) no restringen nada. Lo prueba
  `src/types/soporte.test.ts` contra un Postgres real en memoria.

## Seguridad (resumen)

- RLS en todas las tablas; `anon` no puede leer tablas, vistas ni funciones internas.
- El portal público solo usa la RPC `obtener_orden_publica`: no expone costos de compra, notas internas,
  facturas de proveedor, teléfono ni documento.
- El service role se usa únicamente para firmar URLs de fotos y está marcado `server-only`.
- Permisos: el `operario` crea y edita; solo el `admin` borra (repuestos de una orden, fotos, gastos).
- El envío automático de WhatsApp está **apagado** salvo `WHATSAPP_AUTO_ENVIO=true`.

## Pruebas

`npm test` (Vitest) cubre las reglas puras, la validación de operaciones offline, el algoritmo de sincronización
(FIFO, errores permanentes/transitorios, sesión expirada), el almacén IndexedDB (con `fake-indexeddb`) y la
estrategia del service worker (con un entorno simulado). Las migraciones SQL se validaron con un Postgres local
(PGlite): 50 comprobaciones de seguridad, saldos, anulaciones, cotizaciones y mantenimiento.

## Migraciones

- **Cambios de esquema = un archivo nuevo** `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql`, idempotente (que se
  pueda ejecutar dos veces). No edites una migración que ya ejecutaste en producción, salvo para retirar una definición
  duplicada (ver abajo). Nombre y versión son compatibles con la CLI de Supabase (`supabase db push`) si algún día se adopta.
- **Una sola definición** de cada función, vista y política (`src/types/migraciones.test.ts`). Las capas justificadas
  (p. ej. `fn_orden_before_write`, que la fase 4 amplía) están listadas allí con su motivo.
- **Huella del esquema final** (`supabase/esquema-final.sql`): la prueba de contrato compara el esquema que resulta de
  ejecutar todas las migraciones (tablas, restricciones, índices, triggers, políticas RLS, funciones, vistas, permisos y
  buckets) con esa huella. Si un cambio altera el esquema **sin que lo pretendas**, la prueba falla y muestra la diferencia;
  si lo pretendes, actualízala con `npx vitest run -u` y la diferencia queda visible en la revisión.

## Tipos de la base de datos

`src/types/database.ts` se mantiene a mano (con tipos de dominio como `Autor` o `Pertenencias`), pero **no puede
desfasarse en silencio**: `src/types/database.contract.test.ts` levanta un Postgres en memoria (PGlite), ejecuta
las migraciones de `supabase/migrations/` (de la tercera en adelante dos veces, para comprobar que se pueden re-ejecutar) y compara
con los tipos: tablas, vistas, columnas, nulabilidad, columnas opcionales al insertar, enums y funciones RPC. Corre con
`npm test` y en CI, sin secretos. Si añades una migración, actualiza `database.ts` hasta que esa prueba pase.

- Las tablas de caja física de la fase 4 siguen en la base pero ya no se tipan (lista `SIN_TIPAR` en la prueba).
- Para contrastar además con el proyecto **real** de Supabase (por si alguien cambió algo a mano en el panel):
  `npx supabase login` y `npx supabase gen types typescript --project-id <ref>`, y comparar el resultado con
  `database.ts`. Requiere tu sesión de Supabase, por eso no está automatizado.

## Validación (esquemas compartidos)

Las reglas de cada dato viven en **un solo lugar**, `src/lib/esquemas/` (Zod), y las usan el cliente (antes de
encolar o enviar) y el servidor (que nunca confía en lo que recibe):

- `comunes.ts` — piezas reutilizables (id, fecha, monto, WhatsApp, placa, año…), cada una con su mensaje en español, y
  `validar(esquema, datos)` que devuelve `{ ok, valor }` o el mensaje del primer problema.
- `vehiculo.ts`, `orden.ts`, `gasto.ts`, `inventario.ts`, `cotizacion.ts`, `cita.ts` — formularios y ediciones (los números llegan como texto). En cotizaciones, el error de un ítem nombra el ítem o su descripción.
- `operaciones.ts` — las operaciones offline (gasto, pago, foto, orden nueva). **Los tipos** (`Operacion`, `DatosGasto`…)
  **se derivan del esquema**: el validador y el tipo no pueden desincronizarse.

Para añadir un campo: declara la regla en el esquema de su entidad y úsala donde corresponda; las claves se declaran en el
orden en que deben validarse (el usuario ve el primer error). Las reglas que dependen de la base de datos (¿existe el
ítem?, ¿qué unidad tiene?) siguen en la acción. Única validación fuera de los esquemas: las comprobaciones de los
formularios de gasto y pago en el navegador (el servidor las vuelve a aplicar).

## Pruebas de las acciones que mueven dinero o estado

`src/test/supabase-falso.ts` es un Supabase simulado que registra cada consulta, RPC y subida a Storage. Con él se prueban (junto a cada archivo, `*.test.ts`) los pagos (`anularPago`), los gastos (`editarGasto` / `anularGasto`), el cambio de estado y la edición de la orden, los repuestos (stock y total), fotos, y el punto único de escritura offline (`procesarOperacion` / `ejecutarOperacion`): qué le piden a la base, cómo reaccionan a errores (duplicado, sin permiso, sin sesión, conexión) y que nunca quedan archivos huérfanos. Las reglas propias de Postgres (triggers, RLS) se verifican aparte con PGlite (`database.contract.test.ts`).

## Pendiente conocido

- El service worker no se pudo probar en un navegador real durante el desarrollo (el navegador embebido no admite
  service workers); su lógica está probada con un entorno simulado. Conviene una prueba manual: abrir la app, poner el
  teléfono en modo avión y navegar.
- Registro de mensajes de WhatsApp enviados.
- Excel real (.xlsx): hoy se exporta CSV con separador `;` y BOM, que Excel abre directamente.
