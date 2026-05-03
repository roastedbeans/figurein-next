-- Recreate storage bucket + policies if they were skipped (e.g. only Drizzle schema
-- was pushed) — fixes StorageError "Bucket not found".

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
