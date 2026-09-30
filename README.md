# Polo Air Cool

PWA mobile-first para el taller de aire acondicionado automotriz: clientes y vehículos, órdenes de
servicio con bitácora fotográfica, inventario, caja menor, balance, garantías y portal público
para el cliente con avisos por WhatsApp.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · lucide-react.

## Puesta en marcha

1. **Base de datos** (Supabase > SQL Editor), en este orden:
   1. `polo_air_cool_fase1.sql`
   2. `polo_air_cool_fase2.sql`
2. **Usuarios y roles.** Crea los usuarios en Supabase > Authentication y asigna el rol
   (`admin` u `operario`) con el SQL que aparece al inicio de `polo_air_cool_fase1.sql`.
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

## Estructura

- `src/app/(app)/` — pantallas internas (protegidas): inicio, órdenes, vehículos, garantías, inventario, caja menor.
- `src/app/orden/[token]/` — portal público del cliente (sin login; datos vía RPC `obtener_orden_publica`).
- `src/app/login/` — acceso del taller.
- `src/proxy.ts` — refresca la sesión de Supabase y redirige a `/login` (en Next 16 reemplaza a `middleware.ts`).
- `src/utils/supabase/` — clientes: navegador, servidor, público (anónimo) y admin (service role, solo servidor).
- `src/lib/` — reglas puras (garantías, teléfonos, meses, plantillas de WhatsApp) y sus pruebas.

## Seguridad (resumen)

- RLS en todas las tablas; `anon` no puede leer tablas, vistas ni funciones internas.
- El portal público solo usa la RPC `obtener_orden_publica`: no expone costos de compra, notas internas,
  facturas de proveedor, teléfono ni documento.
- El service role se usa únicamente para firmar URLs de fotos y está marcado `server-only`.
- Permisos: el `operario` crea y edita; solo el `admin` borra (repuestos de una orden, fotos, gastos).
- El envío automático de WhatsApp está **apagado** salvo `WHATSAPP_AUTO_ENVIO=true`.

## Pendiente conocido

- Modo sin conexión real (service worker / cola de subidas).
- Editar gastos de caja menor (hoy: borrar y volver a registrar, solo admin).
- Registro de mensajes de WhatsApp enviados.
