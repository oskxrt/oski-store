-- OSKI STORE V1 - SQL limpio para proyecto nuevo Supabase
-- Master inicial: oskxrt@gmail.com
-- Usuario de prueba inicial: prueba@oski.store

create extension if not exists pgcrypto;

create table if not exists platform_admins (
  email text primary key,
  created_at timestamptz default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_email text,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  plan text not null default 'Básico',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner','admin','staff')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz default now(),
  unique(store_id, email)
);

create table if not exists store_settings (
  store_id uuid primary key references stores(id) on delete cascade,
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
  show_new_arrivals boolean not null default false,
  new_arrivals_title text not null default 'Novedades',
  updated_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
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

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  size text,
  color text,
  stock int default 0,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  instagram text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  folio text,
  customer_name text,
  customer_phone text,
  total numeric(12,2) default 0,
  paid numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  status text default 'Pendiente',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text,
  variant text,
  qty int default 1,
  unit_price numeric(12,2) default 0,
  line_total numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  method text,
  note text,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists catalog_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_name text,
  customer_phone text,
  total_reference numeric(12,2) default 0,
  message text,
  status text default 'Nuevo',
  created_at timestamptz default now()
);

create table if not exists catalog_order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references catalog_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text,
  sku text,
  variant text,
  qty int default 1,
  unit_price numeric(12,2) default 0,
  line_total numeric(12,2) default 0,
  created_at timestamptz default now()
);

create or replace function current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_admins
    where lower(email) = current_user_email()
  );
$$;

create or replace function is_store_member(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from store_members
    where store_id = target_store
      and lower(email) = current_user_email()
      and status = 'active'
  );
$$;

create or replace function store_is_active(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from stores
    where id = target_store and status = 'active'
  );
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stores_touch_updated_at') THEN
    CREATE TRIGGER stores_touch_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_touch_updated_at') THEN
    CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customers_touch_updated_at') THEN
    CREATE TRIGGER customers_touch_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_touch_updated_at') THEN
    CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Activar RLS
alter table platform_admins enable row level security;
alter table stores enable row level security;
alter table store_members enable row level security;
alter table store_settings enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table product_variants enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table catalog_orders enable row level security;
alter table catalog_order_items enable row level security;

-- Crear policies solo si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_admins' AND policyname='platform admins readable by own email') THEN
    CREATE POLICY "platform admins readable by own email" ON platform_admins FOR SELECT USING (lower(email) = current_user_email());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stores' AND policyname='stores public active or member') THEN
    CREATE POLICY "stores public active or member" ON stores FOR SELECT USING (status = 'active' OR is_store_member(id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stores' AND policyname='stores editable by platform admins') THEN
    CREATE POLICY "stores editable by platform admins" ON stores FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_members' AND policyname='members readable by member or admin') THEN
    CREATE POLICY "members readable by member or admin" ON store_members FOR SELECT USING (is_platform_admin() OR is_store_member(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_members' AND policyname='members editable by platform admins') THEN
    CREATE POLICY "members editable by platform admins" ON store_members FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='settings public active or member') THEN
    CREATE POLICY "settings public active or member" ON store_settings FOR SELECT USING (store_is_active(store_id) OR is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='settings editable by member') THEN
    CREATE POLICY "settings editable by member" ON store_settings FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='products public active or member') THEN
    CREATE POLICY "products public active or member" ON products FOR SELECT USING (store_is_active(store_id) OR is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='products editable by member') THEN
    CREATE POLICY "products editable by member" ON products FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_images' AND policyname='images public active or member') THEN
    CREATE POLICY "images public active or member" ON product_images FOR SELECT USING (store_is_active(store_id) OR is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_images' AND policyname='images editable by member') THEN
    CREATE POLICY "images editable by member" ON product_images FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_variants' AND policyname='variants public active or member') THEN
    CREATE POLICY "variants public active or member" ON product_variants FOR SELECT USING (store_is_active(store_id) OR is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_variants' AND policyname='variants editable by member') THEN
    CREATE POLICY "variants editable by member" ON product_variants FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='customers member only') THEN
    CREATE POLICY "customers member only" ON customers FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders member only') THEN
    CREATE POLICY "orders member only" ON orders FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='order items member only') THEN
    CREATE POLICY "order items member only" ON order_items FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='payments member only') THEN
    CREATE POLICY "payments member only" ON payments FOR ALL USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_orders' AND policyname='catalog orders insert public active') THEN
    CREATE POLICY "catalog orders insert public active" ON catalog_orders FOR INSERT WITH CHECK (store_is_active(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_orders' AND policyname='catalog orders member read') THEN
    CREATE POLICY "catalog orders member read" ON catalog_orders FOR SELECT USING (is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_orders' AND policyname='catalog orders member update') THEN
    CREATE POLICY "catalog orders member update" ON catalog_orders FOR UPDATE USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_order_items' AND policyname='catalog order items insert public active') THEN
    CREATE POLICY "catalog order items insert public active" ON catalog_order_items FOR INSERT WITH CHECK (store_is_active(store_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_order_items' AND policyname='catalog order items member read') THEN
    CREATE POLICY "catalog order items member read" ON catalog_order_items FOR SELECT USING (is_store_member(store_id) OR is_platform_admin());
  END IF;
END $$;

-- Seed master y tienda prueba
insert into platform_admins(email)
values ('oskxrt@gmail.com')
on conflict (email) do nothing;

insert into stores(slug, name, owner_email, status, plan)
values ('tienda-prueba', 'Tienda Prueba', 'prueba@oski.store', 'active', 'Pro')
on conflict (slug) do update set name = excluded.name;

insert into store_members(store_id, email, role, status)
select id, 'prueba@oski.store', 'owner', 'active'
from stores where slug = 'tienda-prueba'
on conflict (store_id, email) do nothing;

insert into store_settings(store_id, brand_name, whatsapp, instagram_url, tiktok_url, facebook_url, theme, primary_color, bg_color, text_color, show_new_arrivals, new_arrivals_title)
select id, 'Tienda Prueba', '523112648451', 'https://instagram.com/tu_tienda', 'https://tiktok.com/@tu_tienda', 'https://facebook.com/tu_tienda', 'minimal', '#0b0b0d', '#f8f7f3', '#111827', true, 'Novedades'
from stores where slug = 'tienda-prueba'
on conflict (store_id) do nothing;

insert into products(store_id, name, sku, category, cost, price, status, description)
select id, 'Producto Demo', 'DEMO-001', 'Tee', 250, 600, 'Disponible', 'Producto de prueba para validar el catálogo.'
from stores where slug = 'tienda-prueba'
on conflict (store_id, sku) do nothing;

insert into product_images(store_id, product_id, url, sort_order)
select p.store_id, p.id, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop', 0
from products p
join stores s on s.id = p.store_id
where s.slug = 'tienda-prueba' and p.sku = 'DEMO-001'
  and not exists (select 1 from product_images pi where pi.product_id = p.id);

insert into product_variants(store_id, product_id, size, color, stock, sort_order)
select p.store_id, p.id, 'M', 'Negro', 1, 0
from products p
join stores s on s.id = p.store_id
where s.slug = 'tienda-prueba' and p.sku = 'DEMO-001'
  and not exists (select 1 from product_variants pv where pv.product_id = p.id);
