-- Single library table for all user uploads. Legacy `custom_icons` rows are
-- copied here with storage_bucket='custom-icons' so URLs keep working without
-- moving objects. New uploads always use bucket `custom-images`.

alter table public.custom_images
  add column if not exists storage_bucket text not null default 'custom-images';

comment on column public.custom_images.storage_bucket is
  'Supabase storage bucket id (custom-images | custom-icons for migrated rows).';

comment on column public.custom_images.format is
  'File kind: png | jpg | gif | webp | svg';

insert into public.custom_images (
  id,
  owner_id,
  name,
  format,
  storage_path,
  size_bytes,
  width,
  height,
  created_at,
  storage_bucket
)
select
  id,
  owner_id,
  name,
  format,
  storage_path,
  size_bytes,
  width,
  height,
  created_at,
  'custom-icons'::text
from public.custom_icons
on conflict (id) do nothing;

drop policy if exists "custom_icons_select_own" on public.custom_icons;
drop policy if exists "custom_icons_insert_own" on public.custom_icons;
drop policy if exists "custom_icons_delete_own" on public.custom_icons;

drop table if exists public.custom_icons;
