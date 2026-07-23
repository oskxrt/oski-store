-- OSKI Store v3.5 - color de texto para barra lateral del catálogo
-- Ejecuta esto en Supabase SQL Editor. No borra datos.

alter table public.store_settings
  add column if not exists sidebar_text_color text not null default '#111827';

update public.store_settings
set sidebar_text_color = case
  when lower(coalesce(sidebar_color, '')) in ('#000000', '#0b0b0d', '#111827', '#101827') then '#ffffff'
  else coalesce(nullif(sidebar_text_color, ''), text_color, '#111827')
end;

comment on column public.store_settings.sidebar_text_color is 'Color de texto/iconos dentro de la barra lateral del catálogo público.';
