-- Figures: one row per user-owned document. The full canvas state is stored
-- in `content` as JSONB (pages array with their elements) — the editor loads
-- it verbatim and auto-saves debounced writes back to the same column.
-- Metadata (title, thumbnail, timestamps) stays relational so a dashboard
-- can list figures without parsing the blob.

create table if not exists public.figures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Figure',
  content jsonb not null default '{"pages":[]}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

-- Dashboard list is "my figures, most recently touched first".
create index if not exists figures_owner_id_updated_at_idx
  on public.figures (owner_id, updated_at desc);

alter table public.figures enable row level security;

-- Owner-only access. Add collaborator policies when sharing ships.
create policy "figures_select_own"
  on public.figures for select
  using (owner_id = auth.uid());

create policy "figures_insert_own"
  on public.figures for insert
  with check (owner_id = auth.uid());

create policy "figures_update_own"
  on public.figures for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "figures_delete_own"
  on public.figures for delete
  using (owner_id = auth.uid());

-- Keep updated_at fresh without relying on the client to send it.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists figures_set_updated_at on public.figures;
create trigger figures_set_updated_at
  before update on public.figures
  for each row execute function public.set_updated_at();
