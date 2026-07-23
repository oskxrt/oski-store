-- OSKI STORE V4 COMPLETO — Multi-tienda + tienda operativa + membresía mensual
-- Proyecto limpio o proyecto existente OSKI Store.
-- No borra productos, clientes, pedidos, tiendas ni imágenes.
-- Master inicial: oskxrt@gmail.com
-- Usuario demo asignado: prueba@oski.store

create extension if not exists pgcrypto;

-- =========================
-- TABLAS BASE
-- =========================

create table if not exists public.platform_admins (
  email text primary key,
  created_at timestamptz default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_email text,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  plan text not null default 'Mensual',
  monthly_fee numeric(10,2) not null default 299,
  billing_status text not null default 'active',
  next_payment_due date,
  last_payment_at timestamptz,
  membership_notes text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner','admin','staff')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz default now(),
  unique(store_id, email)
);

create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  brand_name text,
  logo_url text,
  whatsapp text,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  theme text not null default 'minimal',
  primary_color text not null default '#0b0b0d',
  bg_color text not null default '#f8f7f3',
  text_color text not null default '#111827',
  sidebar_color text not null default '#fbfaf7',
  sidebar_text_color text not null default '#111827',
  loading_bg_color text not null default '#f8f7f3',
  show_new_arrivals boolean not null default false,
  new_arrivals_title text not null default 'Novedades',
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  supplier text,
  description text,
  cost numeric(12,2) default 0,
  price numeric(12,2) default 0,
  status text not null default 'Disponible',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, sku)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  stock int default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text,
  instagram text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  folio text,
  customer_name text,
  customer_phone text,
  total numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  paid numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  status text default 'Pendiente',
  delivery_address text,
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  variant text,
  qty int default 1,
  unit_price numeric(12,2) default 0,
  line_total numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  method text,
  note text,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.catalog_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text,
  customer_phone text,
  total_reference numeric(12,2) default 0,
  message text,
  status text default 'Nuevo',
  created_at timestamptz default now()
);

create table if not exists public.catalog_order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  sku text,
  variant text,
  qty int default 1,
  unit_price numeric(12,2) default 0,
  line_total numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  period_start date,
  period_end date,
  paid_at timestamptz not null default now(),
  method text not null default 'Manual',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- =========================
-- COLUMNAS/DEFAULTS PARA BASES EXISTENTES
-- =========================

alter table public.stores add column if not exists monthly_fee numeric(10,2) not null default 299;
alter table public.stores add column if not exists billing_status text not null default 'active';
alter table public.stores add column if not exists next_payment_due date;
alter table public.stores add column if not exists last_payment_at timestamptz;
alter table public.stores add column if not exists membership_notes text not null default '';
alter table public.stores alter column plan set default 'Mensual';
alter table public.stores alter column monthly_fee set default 299;
alter table public.stores alter column billing_status set default 'active';
alter table public.stores alter column membership_notes set default '';

alter table public.store_settings add column if not exists sidebar_color text not null default '#fbfaf7';
alter table public.store_settings add column if not exists sidebar_text_color text not null default '#111827';
alter table public.store_settings add column if not exists loading_bg_color text not null default '#f8f7f3';

alter table public.orders add column if not exists discount numeric(12,2) default 0;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists due_date date;

update public.stores
set plan = 'Mensual'
where plan is null or plan <> 'Mensual';

update public.stores
set monthly_fee = coalesce(nullif(monthly_fee, 0), 299),
    billing_status = case when status = 'suspended' then 'suspended' else coalesce(nullif(billing_status, ''), 'active') end,
    next_payment_due = coalesce(next_payment_due, (current_date + interval '30 days')::date),
    membership_notes = coalesce(membership_notes, '')
where true;

update public.store_settings
set sidebar_color = coalesce(nullif(sidebar_color, ''), '#fbfaf7'),
    sidebar_text_color = coalesce(nullif(sidebar_text_color, ''), text_color, '#111827'),
    loading_bg_color = coalesce(nullif(loading_bg_color, ''), coalesce(bg_color, '#f8f7f3'))
where true;

update public.orders
set balance = greatest(0, coalesce(total,0) - coalesce(paid,0))
where balance is null;

-- =========================
-- ÍNDICES
-- =========================

create index if not exists idx_products_store_id on public.products(store_id);
create index if not exists idx_customers_store_id on public.customers(store_id);
create index if not exists idx_orders_store_id on public.orders(store_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_catalog_orders_store_id on public.catalog_orders(store_id);
create index if not exists membership_payments_store_id_idx on public.membership_payments(store_id);
create index if not exists membership_payments_paid_at_idx on public.membership_payments(paid_at desc);

-- =========================
-- FUNCIONES
-- =========================

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where lower(email) = public.current_user_email()
  );
$$;

create or replace function public.is_store_member(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members
    where store_id = target_store
      and lower(email) = public.current_user_email()
      and status = 'active'
  );
$$;

create or replace function public.store_is_active(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores
    where id = target_store and status = 'active' and billing_status = 'active'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- TRIGGERS
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stores_touch_updated_at') THEN
    CREATE TRIGGER stores_touch_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_touch_updated_at') THEN
    CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customers_touch_updated_at') THEN
    CREATE TRIGGER customers_touch_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_touch_updated_at') THEN
    CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- =========================
-- RLS
-- =========================

alter table public.platform_admins enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.catalog_orders enable row level security;
alter table public.catalog_order_items enable row level security;
alter table public.membership_payments enable row level security;

-- Reemplaza policies conocidas para evitar conflictos/recursión.
drop policy if exists "platform admins readable by own email" on public.platform_admins;
drop policy if exists "stores public active or member" on public.stores;
drop policy if exists "stores editable by platform admins" on public.stores;
drop policy if exists "members readable by member or admin" on public.store_members;
drop policy if exists "members editable by platform admins" on public.store_members;
drop policy if exists "settings public active or member" on public.store_settings;
drop policy if exists "settings editable by member" on public.store_settings;
drop policy if exists "products public active or member" on public.products;
drop policy if exists "products editable by member" on public.products;
drop policy if exists "images public active or member" on public.product_images;
drop policy if exists "images editable by member" on public.product_images;
drop policy if exists "variants public active or member" on public.product_variants;
drop policy if exists "variants editable by member" on public.product_variants;
drop policy if exists "customers member only" on public.customers;
drop policy if exists "orders member only" on public.orders;
drop policy if exists "order items member only" on public.order_items;
drop policy if exists "payments member only" on public.payments;
drop policy if exists "catalog orders insert public active" on public.catalog_orders;
drop policy if exists "catalog orders member read" on public.catalog_orders;
drop policy if exists "catalog orders member update" on public.catalog_orders;
drop policy if exists "catalog orders member delete" on public.catalog_orders;
drop policy if exists "catalog order items insert public active" on public.catalog_order_items;
drop policy if exists "catalog order items member read" on public.catalog_order_items;
drop policy if exists "catalog order items member update" on public.catalog_order_items;
drop policy if exists "catalog order items member delete" on public.catalog_order_items;
drop policy if exists "membership payments platform admin all" on public.membership_payments;

create policy "platform admins readable by own email"
on public.platform_admins for select
using (lower(email) = public.current_user_email());

create policy "stores public active or member"
on public.stores for select
using (status = 'active' or public.is_store_member(id) or public.is_platform_admin());

create policy "stores editable by platform admins"
on public.stores for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "members readable by member or admin"
on public.store_members for select
using (public.is_platform_admin() or public.is_store_member(store_id));

create policy "members editable by platform admins"
on public.store_members for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "settings public active or member"
on public.store_settings for select
using (public.store_is_active(store_id) or public.is_store_member(store_id) or public.is_platform_admin());

create policy "settings editable by member"
on public.store_settings for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "products public active or member"
on public.products for select
using (public.store_is_active(store_id) or public.is_store_member(store_id) or public.is_platform_admin());

create policy "products editable by member"
on public.products for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "images public active or member"
on public.product_images for select
using (public.store_is_active(store_id) or public.is_store_member(store_id) or public.is_platform_admin());

create policy "images editable by member"
on public.product_images for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "variants public active or member"
on public.product_variants for select
using (public.store_is_active(store_id) or public.is_store_member(store_id) or public.is_platform_admin());

create policy "variants editable by member"
on public.product_variants for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "customers member only"
on public.customers for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "orders member only"
on public.orders for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "order items member only"
on public.order_items for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "payments member only"
on public.payments for all
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog orders insert public active"
on public.catalog_orders for insert
with check (public.store_is_active(store_id));

create policy "catalog orders member read"
on public.catalog_orders for select
using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog orders member update"
on public.catalog_orders for update
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog orders member delete"
on public.catalog_orders for delete
using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog order items insert public active"
on public.catalog_order_items for insert
with check (public.store_is_active(store_id));

create policy "catalog order items member read"
on public.catalog_order_items for select
using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog order items member update"
on public.catalog_order_items for update
using (public.is_store_member(store_id) or public.is_platform_admin())
with check (public.is_store_member(store_id) or public.is_platform_admin());

create policy "catalog order items member delete"
on public.catalog_order_items for delete
using (public.is_store_member(store_id) or public.is_platform_admin());

create policy "membership payments platform admin all"
on public.membership_payments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- =========================
-- STORAGE PARA LOGOS / ASSETS
-- =========================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store assets public read" on storage.objects;
create policy "store assets public read"
on storage.objects for select
using (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated upload" on storage.objects;
create policy "store assets authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated update" on storage.objects;
create policy "store assets authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'store-assets')
with check (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated delete" on storage.objects;
create policy "store assets authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'store-assets');

-- =========================
-- DATOS INICIALES / DEMO
-- =========================

insert into public.platform_admins(email)
values ('oskxrt@gmail.com')
on conflict (email) do nothing;

insert into public.stores(slug, name, owner_email, status, plan, monthly_fee, billing_status, next_payment_due)
values ('tienda-prueba', 'Tienda Prueba', 'prueba@oski.store', 'active', 'Mensual', 299, 'active', (current_date + interval '30 days')::date)
on conflict (slug) do update set
  name = excluded.name,
  plan = 'Mensual',
  monthly_fee = coalesce(public.stores.monthly_fee, excluded.monthly_fee),
  billing_status = coalesce(public.stores.billing_status, excluded.billing_status),
  next_payment_due = coalesce(public.stores.next_payment_due, excluded.next_payment_due);

insert into public.store_members(store_id, email, role, status)
select id, 'prueba@oski.store', 'owner', 'active'
from public.stores where slug = 'tienda-prueba'
on conflict (store_id, email) do nothing;

insert into public.store_settings(
  store_id, brand_name, whatsapp, instagram_url, tiktok_url, facebook_url,
  theme, primary_color, bg_color, text_color, sidebar_color, sidebar_text_color,
  loading_bg_color, show_new_arrivals, new_arrivals_title
)
select id, 'Tienda Prueba', '523112648451', 'https://instagram.com/tu_tienda', 'https://tiktok.com/@tu_tienda', 'https://facebook.com/tu_tienda',
       'minimal', '#0b0b0d', '#f8f7f3', '#111827', '#fbfaf7', '#111827', '#f8f7f3', true, 'Novedades'
from public.stores where slug = 'tienda-prueba'
on conflict (store_id) do nothing;

insert into public.products(store_id, name, sku, category, cost, price, status, description)
select id, 'Producto Demo', 'DEMO-001', 'Tee', 250, 600, 'Disponible', 'Producto de prueba para validar el catálogo.'
from public.stores where slug = 'tienda-prueba'
on conflict (store_id, sku) do nothing;

insert into public.product_images(store_id, product_id, url, sort_order)
select p.store_id, p.id, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop', 0
from public.products p
join public.stores s on s.id = p.store_id
where s.slug = 'tienda-prueba' and p.sku = 'DEMO-001'
  and not exists (select 1 from public.product_images pi where pi.product_id = p.id);

insert into public.product_variants(store_id, product_id, size, color, stock, sort_order)
select p.store_id, p.id, 'M', 'Negro', 1, 0
from public.products p
join public.stores s on s.id = p.store_id
where s.slug = 'tienda-prueba' and p.sku = 'DEMO-001'
  and not exists (select 1 from public.product_variants pv where pv.product_id = p.id);

comment on column public.store_settings.sidebar_color is 'Color de barra lateral y encabezado móvil del catálogo público.';
comment on column public.store_settings.sidebar_text_color is 'Color de texto/iconos dentro de la barra lateral del catálogo público.';
comment on column public.store_settings.loading_bg_color is 'Color de fondo de la pantalla de carga pública.';
