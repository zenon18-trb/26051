-- Saved shelter designs belong to the authenticated Supabase user who created them.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  schema_version integer not null default 1,
  configuration jsonb not null,
  simulation_result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists projects_user_updated_at_idx
  on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
