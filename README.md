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
   Si tu base ya tenía las fases 1 a 5 ejecutadas con los archivos anteriores (`polo_air_cool_faseN.sql`), **no hay que
   volver a ejecutar nada**: los archivos nuevos producen exactamente el mismo esquema.
2. **Usuarios y roles.** Crea los usuarios en Supabase > Authentication y asigna el rol
   (`admin` u `operario`) con el SQL que aparece al inicio de la migración `…01_fase1_base.sql`.
   Sin rol, el login se rechaza.
3. **Variables de entorno.** Copia `.env.example` a `.env.local` y complétalo:

   | Variable | Uso |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión (obligatorias) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor. Firma las fotos del portal público. **Nunca** con prefijo `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SITE_URL` | URL pública (`https://tu-dominio.com`) para los enlaces `/orden/[token]` |
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
| `/ordenes` | Órdenes con pertenencias al ingreso, repuestos, fotos, **pagos y saldo**, comprobante/PDF |
| `/cotizaciones` | Cotización previa (estados borrador → enviada → aprobada → convertida en orden), WhatsApp y PDF |
| `/cartera` | Cuentas por cobrar por cliente, con recordatorio de saldo por WhatsApp |
| `/vehiculos`, `/garantias` | Historial por placa; garantías y **mantenimientos preventivos** con recordatorio por WhatsApp |
| `/caja-menor` | **Gastos** (POS, plantillas, fecha, orden asociada, edición/anulación auditada), **Cobros** (efectivo vs. transferencia del mes), **Balance** (base cobrado, gráfica por categoría, rentabilidad, CSV/PDF) |

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
- **Autoría**: selector "Polo / Soporte" en el encabezado; se estampa en los registros nuevos. No es un login ni un rol:
  la seguridad real sigue siendo la sesión de Supabase.

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
| Operador actual | `localStorage` (`polo:autor`) | "Polo" o "Soporte técnico" |
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
- `src/lib/datos/` — capa de acceso a datos: `cargarDetalleOrden`, `listarOrdenes`, `cargarDatosInicio`, `cargarGastosMes` / `cargarCobrosMes` / `cargarBalanceMes`. Las páginas no hacen consultas: piden un modelo ya armado (con tipos propios, sin `as`), y lo independiente se consulta en paralelo. `mapeo.ts` tiene las transformaciones puras; se prueban con un Supabase simulado.
- `src/lib/offline/` — operaciones offline (validación), almacén IndexedDB, algoritmo de sincronización y búsqueda local.
- `src/components/sync/` — `sync-provider.tsx` compone tres hooks: `use-red` (conexión efectiva), `use-snapshot` (datos de referencia locales) y `use-cola` (registrar, sincronizar, reintentar); además el proveedor de autoría y el panel de pendientes.
- `public/sw.js` — service worker (lectura offline de páginas ya visitadas); `public/offline.html` — pantalla sin conexión.

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
- `vehiculo.ts`, `orden.ts`, `gasto.ts`, `inventario.ts` — formularios y ediciones (los números llegan como texto).
- `operaciones.ts` — las operaciones offline (gasto, pago, foto, orden nueva). **Los tipos** (`Operacion`, `DatosGasto`…)
  **se derivan del esquema**: el validador y el tipo no pueden desincronizarse.

Para añadir un campo: declara la regla en el esquema de su entidad y úsala donde corresponda; las claves se declaran en el
orden en que deben validarse (el usuario ve el primer error). Las reglas que dependen de la base de datos (¿existe el
ítem?, ¿qué unidad tiene?) siguen en la acción. Aún con validación propia, fuera de los esquemas: cotizaciones
(`lib/cotizaciones.ts`) y las comprobaciones de los formularios de gasto y pago en el navegador.

## Pruebas de las acciones que mueven dinero o estado

`src/test/supabase-falso.ts` es un Supabase simulado que registra cada consulta, RPC y subida a Storage. Con él se prueban (junto a cada archivo, `*.test.ts`) los pagos (`anularPago`), los gastos (`editarGasto` / `anularGasto`), el cambio de estado y la edición de la orden, los repuestos (stock y total), fotos, y el punto único de escritura offline (`procesarOperacion` / `ejecutarOperacion`): qué le piden a la base, cómo reaccionan a errores (duplicado, sin permiso, sin sesión, conexión) y que nunca quedan archivos huérfanos. Las reglas propias de Postgres (triggers, RLS) se verifican aparte con PGlite (`database.contract.test.ts`).

## Pendiente conocido

- El service worker no se pudo probar en un navegador real durante el desarrollo (el navegador embebido no admite
  service workers); su lógica está probada con un entorno simulado. Conviene una prueba manual: abrir la app, poner el
  teléfono en modo avión y navegar.
- Registro de mensajes de WhatsApp enviados.
- Excel real (.xlsx): hoy se exporta CSV con separador `;` y BOM, que Excel abre directamente.
