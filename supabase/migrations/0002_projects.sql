-- Projects: user-owned folders that group related figures. A figure must
-- belong to exactly one project (nullable only to let the migration land on
-- databases that already have figures from 0001 — the app UI won't create
-- figures without a project going forward).

-- Defensive: 0001 creates this, but keep 0002 runnable standalone.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Project',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_updated_at_idx
  on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (owner_id = auth.uid());

create policy "projects_insert_own"
  on public.projects for insert
  with check (owner_id = auth.uid());

create policy "projects_update_own"
  on public.projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "projects_delete_own"
  on public.projects for delete
  using (owner_id = auth.uid());

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Wire figures under projects. Deleting a project cascades its figures.
alter table public.figures
  add column if not exists project_id uuid
  references public.projects(id) on delete cascade;

create index if not exists figures_project_id_updated_at_idx
  on public.figures (project_id, updated_at desc);

-- Tighten figures RLS so a user can't park a figure under someone else's
-- project. The 0001 policies only checked owner_id on figures; replace the
-- write-path ones to also verify the referenced project is owned by the
-- same user (null project_id stays allowed for unfiled figures).
drop policy if exists "figures_insert_own" on public.figures;
create policy "figures_insert_own"
  on public.figures for insert
  with check (
    owner_id = auth.uid()
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "figures_update_own" on public.figures;
create policy "figures_update_own"
  on public.figures for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.owner_id = auth.uid()
      )
    )
  );
