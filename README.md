# OSKI Store v1 Multi-tienda limpia

Base nueva para vender catálogos/paneles como membresía.

## Usuarios iniciales

El SQL deja preparados estos correos en la base:

- Master / super usuario: `oskxrt@gmail.com`
- Usuario de prueba asignado a tienda demo: `prueba@oski.store`

Importante: el SQL prepara permisos y asignaciones, pero los usuarios de Auth se crean en Supabase.

Crea estos usuarios en:

Supabase → Authentication → Users → Add user

Sugerencia de passwords para prueba:

- `oskxrt@gmail.com` → tu password personal
- `prueba@oski.store` → `Prueba123!`

También puedes usar `/signup` para que cada usuario cree su cuenta con el correo asignado.

## Instalación

1. Crea proyecto nuevo en Supabase.
2. SQL Editor → New query.
3. Pega `PEGAR_EN_SUPABASE_OSKI_STORE_V1.sql` y Run.
4. Crea los usuarios en Authentication.
5. En `cloud-config.js`, pega tu Supabase URL y publishable key.
6. Sube todo a GitHub.
7. Conecta GitHub a Vercel.

## Rutas

- `/` landing básica.
- `/admin` panel de usuario/super admin.
- `/signup` crear cuenta.
- `/t/tienda-prueba` catálogo público demo.

## Qué incluye

- Super admin.
- Crear tiendas.
- Asignar dueño por email.
- Usuario de tienda.
- Catálogo público por slug.
- Productos, variantes, imágenes por URL.
- Clientes.
- Pedidos básicos.
- Configuración white label: logo URL, WhatsApp, redes, tema, colores, novedades.
- Responsive base.

## Siguiente etapa sugerida

v2:
- Recibos completos.
- Abonos más detallados.
- Panel de planes/membresías.
- Suspensión por pago vencido.
- Subida de logo a Supabase Storage.
- Exportación Excel.


## v2 public route fix

- Corrige rutas absolutas de CSS y JS para que `/t/:slug` cargue bien en Vercel.
- El catálogo público ya no se queda sin estilos cuando se abre como `/t/tienda-prueba`.

## v3 - Tienda operativa

Esta versión agrega operación completa por tienda:

- Pedidos con productos del pedido.
- Abonos / pagos por pedido.
- Recibo imprimible / PDF desde el navegador.
- Envío de recibo por WhatsApp.
- Cuentas por cobrar por cliente.
- Conversión de pedidos web a pedidos internos.
- Eliminación de pedidos internos con sus productos y pagos.

### Supabase

Ejecuta en SQL Editor:

`PEGAR_EN_SUPABASE_OSKI_STORE_V3_OPERATIVA.sql`

No borra datos. Solo agrega columnas e índices necesarios.


## v3.1

- Corrección de impresión de recibos: ahora el botón **Imprimir / PDF** abre una vista limpia del recibo y manda a imprimir solo el comprobante.
- Ajuste de tablas, totales y tamaños para evitar textos encimados al guardar como PDF.

## v3.2 — Logo por archivo, colores e iconos sociales

- La configuración de tienda ahora permite subir logo como archivo a Supabase Storage.
- Se agregó el bucket público `store-assets` mediante SQL.
- Se mejoró el selector de colores para que sea más claro y usable.
- El catálogo público muestra iconos de Instagram, TikTok y Facebook en lugar de solo texto.
- El logo del panel lateral también se actualiza cuando la tienda tiene logo.

Para activar la subida de logo por archivo, ejecuta en Supabase:

`PEGAR_EN_SUPABASE_OSKI_STORE_V3_2_LOGO_UPLOAD.sql`
