-- Supabase SQL: IELTS Reading Tool WebApp MVP
-- 使用方法：Supabase Dashboard -> SQL Editor -> New query -> 粘贴执行。

create table if not exists public.reading_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名阅读项目',
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reading_projects enable row level security;

drop policy if exists "Users can view own reading projects" on public.reading_projects;
drop policy if exists "Users can insert own reading projects" on public.reading_projects;
drop policy if exists "Users can update own reading projects" on public.reading_projects;
drop policy if exists "Users can delete own reading projects" on public.reading_projects;

create policy "Users can view own reading projects"
on public.reading_projects
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own reading projects"
on public.reading_projects
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own reading projects"
on public.reading_projects
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own reading projects"
on public.reading_projects
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reading_projects_updated_at on public.reading_projects;
create trigger set_reading_projects_updated_at
before update on public.reading_projects
for each row
execute function public.set_updated_at();
