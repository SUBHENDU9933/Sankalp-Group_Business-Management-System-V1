-- =====================================================================
-- SANKALP GROUP — Schema v8.1 PATCH (Fix infinite recursion in RLS)
-- Apply AFTER v8. Fixes: "infinite recursion detected in policy for relation 'project_members'"
--
-- Root cause: project_members_select referenced project_members itself,
-- and projects_select referenced project_members which in turn re-evaluated
-- project_members_select → infinite loop.
--
-- Fix: use SECURITY DEFINER helper functions that bypass RLS for the cross-checks.
-- =====================================================================

-- Helper: is current user a member of the given project? (bypasses RLS)
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_project_member(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;

-- Helper: is current user the creator of the given project? (bypasses RLS)
create or replace function public.is_project_creator(p_project_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and created_by = auth.uid()
  );
$$;

revoke all on function public.is_project_creator(uuid) from public;
grant execute on function public.is_project_creator(uuid) to authenticated;

-- ---- Replace project_members policies (no self-reference) ----
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or public.is_project_creator(project_id)
  );

-- ---- Replace projects policies to use the helper functions ----
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_project_member(id)
    or exists (
      select 1 from public.customers c
      where c.id = projects.customer_id and c.created_by = auth.uid()
    )
  );

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_project_member(id)
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_project_member(id)
  );

-- ---- Replace expenses policies to use the helper ----
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    public.is_admin()
    or public.is_project_creator(project_id)
    or public.is_project_member(project_id)
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    public.is_admin()
    or public.is_project_creator(project_id)
    or public.is_project_member(project_id)
  );
