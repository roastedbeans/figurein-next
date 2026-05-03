-- One-time wipe: clear user image library rows and remove storage_bucket column.
--
-- Rows are deleted only from Postgres — remove leftover objects from the
-- `custom-images` (and any old `custom-icons`) storage buckets in the
-- Supabase dashboard if you need disk reclaimed.

delete from public.custom_images;

alter table public.custom_images
  drop column if exists storage_bucket;
