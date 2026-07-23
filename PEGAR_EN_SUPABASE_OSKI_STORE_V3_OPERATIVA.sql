-- OSKI STORE V3 OPERATIVA
-- Ejecutar después del SQL base v1/v2. No borra datos.
-- Agrega soporte completo para pedidos con productos, abonos, recibos y campos de entrega.

create extension if not exists pgcrypto;

alter table orders add column if not exists discount numeric(12,2) default 0;
alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists due_date date;

create index if not exists idx_products_store_id on products(store_id);
create index if not exists idx_customers_store_id on customers(store_id);
create index if not exists idx_orders_store_id on orders(store_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_payments_order_id on payments(order_id);
create index if not exists idx_catalog_orders_store_id on catalog_orders(store_id);

-- Permitir que miembros/super admin puedan administrar pedidos web si hace falta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_orders' AND policyname='catalog orders member delete') THEN
    CREATE POLICY "catalog orders member delete" ON catalog_orders FOR DELETE USING (is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_order_items' AND policyname='catalog order items member update') THEN
    CREATE POLICY "catalog order items member update" ON catalog_order_items FOR UPDATE USING (is_store_member(store_id) OR is_platform_admin()) WITH CHECK (is_store_member(store_id) OR is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_order_items' AND policyname='catalog order items member delete') THEN
    CREATE POLICY "catalog order items member delete" ON catalog_order_items FOR DELETE USING (is_store_member(store_id) OR is_platform_admin());
  END IF;
END $$;

-- Actualiza pedidos antiguos para asegurar balance correcto donde falte.
update orders
set balance = greatest(0, coalesce(total,0) - coalesce(paid,0))
where balance is null;
