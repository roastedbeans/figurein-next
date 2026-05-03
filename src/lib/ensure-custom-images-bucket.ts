import postgres from "postgres";

const BUCKET = "custom-images";

/** Same as `0007_ensure_custom_images_bucket.sql` — idempotent. */
const ENSURE_BUCKET_SQL = `
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
`;

declare global {
  var __figurinCustomImagesBucketEnsured:
    | Promise<boolean | void>
    | undefined;
}

/** Creates `custom-images` + storage policies via direct Postgres when the bucket row is missing. */
export async function ensureCustomImagesBucketFromDb(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  if (!globalThis.__figurinCustomImagesBucketEnsured) {
    globalThis.__figurinCustomImagesBucketEnsured = (async () => {
      const c = postgres(process.env.DATABASE_URL!, {
        max: 1,
        prepare: false,
      });
      try {
        const rows =
          await c`select id from storage.buckets where id = ${BUCKET} limit 1`;
        if (rows.length > 0) return;
        await c.unsafe(ENSURE_BUCKET_SQL);
      } catch (err) {
        console.warn(
          "[FigurIn] Could not provision storage bucket (missing DATABASE_URL role or migration conflict):",
          err
        );
      } finally {
        await c.end({ timeout: 5 });
      }
    })();
  }

  await globalThis.__figurinCustomImagesBucketEnsured;
}
