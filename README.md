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
