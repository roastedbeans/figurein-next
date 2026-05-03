-- Custom icons: per-user library of uploaded SVG / PNG / JPG icons that sit
-- alongside the built-in IBM pictogram set. Files live in the
-- `custom-icons` storage bucket at `{owner_id}/{icon_id}.{ext}`; this table
-- owns the metadata and is what the client lists.

create table if not exists public.custom_icons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- "svg" | "png" | "jpg". Raster icons keep their pixels and are rendered
  -- as <image>; SVG icons render through the same CSS mask path as built-ins
  -- so the element color still applies.
  format text not null,
  storage_path text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists custom_icons_owner_id_created_at_idx
  on public.custom_icons (owner_id, created_at desc);

alter table public.custom_icons enable row level security;

drop policy if exists "custom_icons_select_own" on public.custom_icons;
create policy "custom_icons_select_own"
  on public.custom_icons for select
  using (owner_id = auth.uid());

drop policy if exists "custom_icons_insert_own" on public.custom_icons;
create policy "custom_icons_insert_own"
  on public.custom_icons for insert
  with check (owner_id = auth.uid());

drop policy if exists "custom_icons_delete_own" on public.custom_icons;
create policy "custom_icons_delete_own"
  on public.custom_icons for delete
  using (owner_id = auth.uid());

-- Storage bucket for the raw files. Public so the CDN can serve them
-- directly from <img>/<image> tags without signed URLs (metadata protection
-- comes from the RLS on this table — knowing a UUID doesn't let you list
-- someone else's icons). Upload/delete are still gated by storage policies
-- below so a user can only write under their own folder.
insert into storage.buckets (id, name, public)
values ('custom-icons', 'custom-icons', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "custom_icons_storage_select" on storage.objects;
create policy "custom_icons_storage_select"
  on storage.objects for select
  using (bucket_id = 'custom-icons');

drop policy if exists "custom_icons_storage_insert" on storage.objects;
create policy "custom_icons_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'custom-icons'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "custom_icons_storage_delete" on storage.objects;
create policy "custom_icons_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'custom-icons'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
