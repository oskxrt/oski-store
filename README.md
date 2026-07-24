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

## v3.3 — personalización visual de tienda

- Color editable para la barra lateral del catálogo público.
- Fondo editable para la pantalla de carga.
- Logo de tienda visible en la pantalla de carga.
- Botón de restablecer colores ahora también restaura barra lateral y loading.

Corre primero `PEGAR_EN_SUPABASE_OSKI_STORE_V3_3_VISUAL.sql` en Supabase.


## v3.4

- Corrige que el color de la barra lateral del catálogo público se aplique realmente desde `store_settings.sidebar_color`.
- Corrige que el fondo de pantalla de carga use `store_settings.loading_bg_color`.


## v3.5

- Agrega color editable para texto/iconos de la barra lateral del catálogo público.
- Corrige contraste cuando la barra lateral usa colores oscuros.
- El color se aplica a categorías, logo en texto, redes sociales y encabezado móvil.


## v3.6

- Selector claro para **Fondo barra lateral** y **Texto / iconos barra lateral**.
- Vista previa de contraste dentro de Tienda / Tema.
- Botones rápidos: Texto blanco, Texto negro y Auto contraste.
- El catálogo aplica el color de texto a categorías, redes, copyright, iconos y header móvil.


## v4 — Membresía mensual manual

- Un solo plan: **Mensual**.
- Super Admin puede crear tiendas con mensualidad y fecha de vencimiento.
- Super Admin puede renovar una tienda 1 mes, suspenderla, activarla o editar su membresía.
- Se agrega bitácora `membership_payments` para registrar renovaciones manuales.
- Las tiendas suspendidas dejan de estar disponibles en el catálogo público.

SQL:
`PEGAR_EN_SUPABASE_OSKI_STORE_V4_MEMBRESIA_MENSUAL.sql`

Archivos principales actualizados:
- `admin.js`
- `styles.css`
- `README.md`


## V4 COMPLETO

Este paquete incluye un solo SQL integrado:

`PEGAR_EN_SUPABASE_OSKI_STORE_V4_COMPLETO.sql`

Úsalo en Supabase SQL Editor para dejar la base con multi-tienda, tienda operativa, personalización visual y membresía mensual manual.

El archivo `cloud-config.js` ya está configurado para el proyecto actual de Supabase usado durante el desarrollo. Si cambias de proyecto, actualiza `SUPABASE_URL` y `SUPABASE_ANON_KEY`.


## v4.2 Super Admin compacto

- Super Admin rediseñado como lista compacta.
- Cada tienda se abre con acordeón para ver detalle completo.
- La vista principal muestra solo nombre, estado, vencimiento y mensualidad.
- Acciones avanzadas quedan dentro del detalle: renovar, historial, editar, copiar link, catálogo, entrar al admin y suspender.


## v4.3.2 Login estable

Esta versión regresa el panel admin a la base estable v4.2 con Super Admin en acordeón, porque la v4.3 rompió el submit/login en algunos navegadores. No requiere cambios de Supabase si ya corriste v4 completo o v4.2.

Reemplaza principalmente admin.js y styles.css.

## v4.4 — Imágenes de producto más limpias

- El carrusel de vista rápida ya encaja la imagen completa dentro del cuadro sin hacer zoom ni recortar.
- En el formulario de producto se reemplazó el textarea de URLs por filas individuales.
- Cada URL muestra miniatura de previsualización.
- Al llenar la última fila, se crea automáticamente otra fila vacía.
- Las imágenes pueden reordenarse arrastrando las filas o usando botones de subir/bajar.
- El orden guardado define el orden en el catálogo y en la vista rápida.

No requiere cambios nuevos en Supabase si ya estás usando la base v4 completa.

## v4.4.1 — Variantes arriba de imágenes

- En el formulario de producto, el bloque de variantes ahora aparece antes del administrador de imágenes.
- Se mantiene la previsualización, reordenamiento y orden guardado de imágenes de la v4.4.
- No requiere cambios nuevos en Supabase.

## v4.5 - Mobile compact + imagen contain real
- La vista rápida del catálogo usa marco cuadrado y `object-fit: contain` real, sin zoom ni recorte.
- El panel admin móvil se compactó en todas las secciones para evitar espacios muertos.
- Las tarjetas de productos/clientes/pedidos ahora tienen layout móvil específico para no quebrar texto ni desperdiciar altura.
- El editor de imágenes conserva miniaturas, orden arrastrable y controles, pero se acomoda mejor en móvil.

## v4.6 — Menú móvil y loader de catálogo

- El panel admin en móvil ahora usa un header compacto con botón **Menú**.
- Las opciones del admin se despliegan solo cuando se necesitan, para ahorrar espacio vertical.
- El catálogo público ahora usa un solo loader con logo + barra de carga juntos.
- Se mantiene el loader visible un momento para que el branding se alcance a ver.
- El menú lateral del catálogo en móvil tiene overlay y cierre más natural.
- La vista rápida en móvil baja un poco el tamaño máximo de imagen para que respire mejor dentro del cuadro.
