-- =====================================================================
-- SANKALP GROUP — Schema v8 (Project Multi-User Assignment + Edit/Delete RBAC)
-- Apply AFTER v1..v7.
--   1. project_members junction table (multi-user per project)
--   2. RLS — admin sees all; RMs see projects they created OR are members of
--   3. Same scoping applied to expenses
--   4. updated_at trigger on projects
-- =====================================================================

-- 1. PROJECT MEMBERS ----------------------------------------------------
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',     -- 'lead' | 'member' (informational)
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  unique(project_id, user_id)
);
create index if not exists idx_project_members_user on public.project_members(user_id);

alter table public.project_members enable row level security;

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.project_members m2
      where m2.project_id = project_members.project_id and m2.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.created_by = auth.uid()
    )
  );

-- Only admin can add/remove members
drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2. PROJECTS RLS — replace v4 policy to also allow member access -------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.customers c
      where c.id = projects.customer_id and c.created_by = auth.uid()
    )
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id and m.user_id = auth.uid()
    )
  );

-- UPDATE — admin OR creator OR project member
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id and m.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.project_members m
      where m.project_id = projects.id and m.user_id = auth.uid()
    )
  );

-- DELETE — admin only
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_admin());

-- 3. EXPENSES RLS — admin OR project creator OR project member ---------
alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = expenses.project_id
        and (
          p.created_by = auth.uid()
          or exists (select 1 from public.project_members m where m.project_id = p.id and m.user_id = auth.uid())
        )
    )
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = expenses.project_id
        and (
          p.created_by = auth.uid()
          or exists (select 1 from public.project_members m where m.project_id = p.id and m.user_id = auth.uid())
        )
    )
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- 4. updated_at trigger on projects (if not already there) ------------
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

alter table public.projects add column if not exists updated_at timestamptz not null default now();
