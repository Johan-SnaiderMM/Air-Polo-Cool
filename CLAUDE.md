# ESPECIFICACIONES TÉCNICAS Y FUNCIONALES: POLO AIR COOL
 
## 1. Visión General del Sistema
Plataforma de gestión integral diseñada como Progressive Web App (PWA) con enfoque mobile-first para el taller automotriz especializado en aire acondicionado "Polo Air Cool". El sistema centraliza la recepción de vehículos, el control de inventario de piezas y consumibles, la bitácora fotográfica de reparaciones con control de garantías, la contabilidad operativa (distinguiendo costos de órdenes vs. caja menor) y la notificación desatendida a clientes mediante WhatsApp.
 
---
 
## 2. Requerimientos Funcionales por Módulo
 
### Módulo 1: Clientes y Flota de Vehículos
- Registro de Clientes: Nombre completo, teléfono WhatsApp (con código de país) y documento de identidad.
- Registro de Vehículos: Placa (identificador primario de búsqueda), marca, modelo, año, tipo de refrigerante sugerido (R134a / R1234yf) y carga estándar recomendada.
- Historial por Placa: Trazabilidad completa de servicios anteriores, kilometraje registrado y repuestos instalados históricamente.
### Módulo 2: Órdenes de Servicio y Bitácora Fotográfica
- Flujo de Estados:
  1. Recibido (ingreso, kilometraje, pertenencias).
  2. Diagnóstico (pruebas de fuga, escaneo, presiones).
  3. En Proceso (desmontaje, reemplazo, vacío, recarga).
  4. Listo para Entrega (pruebas térmicas superadas).
  5. Entregado / Cerrado (liquidado y garantía activa).
- Clasificación de Evidencias Fotográficas:
  * Ingreso / Fuga detectada.
  * Comparativa obligatoria: Repuesto averiado retirado vs. Repuesto nuevo a montar.
  * Pruebas técnicas (vacío, manómetros en alta/baja, temperatura en difusor).
  * Facturas de compra de repuestos a proveedores.
- Gestión de Garantías:
  * Asignación de días de vigencia por trabajo (ej. 30, 90, 180 días).
  * Cálculo automático de fecha de expiración.
  * Indicador semafórico: Verde (vigente), Amarillo (vence en 7 días o menos), Rojo (vencida).
### Módulo 3: Control de Inventario y Consumos
- Catálogo Dual:
  * Unidades físicas: Compresores, condensadores, evaporadores, válvulas, filtros.
  * Consumibles a granel: Libras/gramos de refrigerante, onzas de aceite sintético PAG, selladores.
- Deducción Automática: Al vincular un repuesto a la orden de trabajo, se descuenta de forma inmediata del inventario y se carga al costo del servicio.
- Alertas de Stock: Indicador de reposición cuando las unidades sean menores o iguales al stock mínimo configurado.
### Módulo 4: Contabilidad y Caja Menor
- Finanzas por Vehículo:
  * Cobro al cliente (mano de obra + repuestos).
  * Costo real de compra de piezas.
  * Margen bruto generado por el servicio.
- Caja Menor (Gastos Operativos Diarios):
  * Registro rápido en móvil: Monto, categoría y foto de comprobante opcional.
  * Categorías: Pago de ayudantes/jornales, alimentación/refrigerios, fletes de repuestos, compra de herramientas o consumibles.
- Balance Neto: Utilidad Real = (Ingresos por Servicios - Costo de Repuestos) - Gastos de Caja Menor.
### Módulo 5: Automatización de WhatsApp y Vista Pública
- Mensajería Automática:
  * Mensaje de recepción al ingresar el vehículo.
  * Mensaje de vehículo listo con total a pagar y enlace web único.
- Portal de Consulta para el Cliente:
  * Acceso público mediante URL con token único (ej. /orden/[token]).
  * Visualización de fotos antes/después, repuestos cambiados y certificado de garantía digital sin necesidad de registro ni descarga de apps.
---
 
## 3. Arquitectura Técnica y Stack
 
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, componentes de shadcn/ui e iconos de lucide-react.
- Optimización de Imágenes: Compresión en el navegador del cliente antes de subir a la nube (máximo 1280px, ~300 KB por foto) para optimizar almacenamiento y velocidad.
- Backend & Base de Datos: Supabase (PostgreSQL 15+) con Row Level Security (RLS) habilitado.
- Almacenamiento: Supabase Storage (buckets: `evidencias-ordenes` y `facturas-gastos`).
- Notificaciones: Integración vía Webhooks REST hacia servidor con Evolution API / Waha conectado a la cuenta de WhatsApp del taller.
---
 
## 4. Estructura de Tablas (Esquema Relacional)
 
- `clientes`: id, nombre, telefono, documento, created_at.
- `vehiculos`: id, cliente_id, placa, marca, modelo, anio.
- `ordenes_servicio`: id, vehiculo_id, estado, fecha_ingreso, fecha_entrega, dias_garantia, mano_obra, total_cobrado, token_publico, notas.
- `evidencias_fotograficas`: id, orden_id, url_imagen, tipo (ingreso, repuesto_viejo, repuesto_nuevo, prueba, factura), notas.
- `inventario`: id, codigo, nombre, tipo_unidad (unidad, gramo, onza), stock_actual, stock_minimo, costo_compra, precio_venta.
- `orden_repuestos`: id, orden_id, inventario_id, cantidad_usada, costo_unitario, precio_unitario.
- `gastos_caja_menor`: id, fecha, categoria (ayudante, alimentacion, flete, herramienta, otros), monto, comprobante_url, notas.
s