-- OSKI STORE V3.2 - Logo por archivo + storage público para assets de tienda
-- Ejecutar después del SQL base y v3 operativa. No borra datos.

-- Crea bucket público para logos/assets de tiendas.
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

-- Políticas para leer y subir logos/assets.
drop policy if exists "store assets public read" on storage.objects;
create policy "store assets public read"
on storage.objects
for select
using (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated upload" on storage.objects;
create policy "store assets authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated update" on storage.objects;
create policy "store assets authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'store-assets')
with check (bucket_id = 'store-assets');

drop policy if exists "store assets authenticated delete" on storage.objects;
create policy "store assets authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'store-assets');
