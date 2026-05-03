-- User-uploaded images (full fidelity; no resize/recompression on upload).
-- Files live in `custom-images` at `{owner_id}/{image_id}.{ext}`.

create table if not exists public.custom_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- "png" | "jpg" | "gif" | "webp"
  format text not null,
  storage_path text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists custom_images_owner_id_created_at_idx
  on public.custom_images (owner_id, created_at desc);

alter table public.custom_images enable row level security;

drop policy if exists "custom_images_select_own" on public.custom_images;
create policy "custom_images_select_own"
  on public.custom_images for select
  using (owner_id = auth.uid());

drop policy if exists "custom_images_insert_own" on public.custom_images;
create policy "custom_images_insert_own"
  on public.custom_images for insert
  with check (owner_id = auth.uid());

drop policy if exists "custom_images_delete_own" on public.custom_images;
create policy "custom_images_delete_own"
  on public.custom_images for delete
  using (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('custom-images', 'custom-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "custom_images_storage_select" on storage.objects;
create policy "custom_images_storage_select"
  on storage.objects for select
  using (bucket_id = 'custom-images');

drop policy if exists "custom_images_storage_insert" on storage.objects;
create policy "custom_images_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'custom-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "custom_images_storage_delete" on storage.objects;
create policy "custom_images_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'custom-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
