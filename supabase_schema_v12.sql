-- =====================================================================
-- SANKALP GROUP — Schema v12 (Multi-RM Assignment for Leads)
-- Apply to BM App Supabase (Project B) AFTER v1..v11.
--
-- Adds the ability to assign MULTIPLE relationship managers to a single
-- lead. All assignees are EQUAL — any current assignee or admin can
-- add/remove other assignees. Lead `assigned_to` column is preserved for
-- backwards-compat (display column / sort key) — the new junction is the
-- source of truth for visibility & permissions.
--
-- Visibility (RM users): see leads where you are creator OR assigned_to OR
-- listed in lead_assignees.
--
-- ZERO breaking changes: existing rows remain visible/editable to their
-- current `assigned_to` and creator.
-- =====================================================================

-- 1. Junction table -----------------------------------------------------
create table if not exists public.lead_assignees (
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  added_at    timestamptz not null default now(),
  primary key (lead_id, user_id)
);
create index if not exists idx_lead_assignees_user on public.lead_assignees(user_id);
create index if not exists idx_lead_assignees_lead on public.lead_assignees(lead_id);

alter table public.lead_assignees enable row level security;

-- Helper: am I (or the supplied user) an assignee on this lead?
create or replace function public.is_lead_assignee(p_lead_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.lead_assignees
    where lead_id = p_lead_id and user_id = p_user_id
  );
$$;

grant execute on function public.is_lead_assignee(uuid, uuid) to authenticated;

-- 2. Backfill: every lead's existing `assigned_to` becomes an assignee --
insert into public.lead_assignees (lead_id, user_id, assigned_by, added_at)
select id, assigned_to, assigned_to, coalesce(updated_at, created_at, now())
from public.leads
where assigned_to is not null
on conflict (lead_id, user_id) do nothing;

-- 3. Trigger: keep junction in sync when leads.assigned_to is changed ---
create or replace function public.sync_lead_primary_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null then
    insert into public.lead_assignees (lead_id, user_id, assigned_by, added_at)
    values (new.id, new.assigned_to, coalesce(auth.uid(), new.assigned_to), now())
    on conflict (lead_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_lead_primary_assignee on public.leads;
create trigger trg_sync_lead_primary_assignee
  after insert or update of assigned_to on public.leads
  for each row execute function public.sync_lead_primary_assignee();

-- 4. RLS — junction policies -------------------------------------------
-- SELECT: any authenticated who already has visibility on the parent lead.
drop policy if exists lead_assignees_select on public.lead_assignees;
create policy lead_assignees_select on public.lead_assignees for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.leads l
      where l.id = lead_assignees.lead_id
        and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
    )
  );

-- INSERT: admin OR creator OR existing assignee can add new RMs.
drop policy if exists lead_assignees_insert on public.lead_assignees;
create policy lead_assignees_insert on public.lead_assignees for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_assignees.lead_id
        and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
    )
    or public.is_lead_assignee(lead_assignees.lead_id, auth.uid())
  );

-- DELETE: same rule as insert.
drop policy if exists lead_assignees_delete on public.lead_assignees;
create policy lead_assignees_delete on public.lead_assignees for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_assignees.lead_id
        and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
    )
    or public.is_lead_assignee(lead_assignees.lead_id, auth.uid())
  );

-- 5. Widen leads SELECT/UPDATE so co-assignees are first-class ----------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_lead_assignee(id, auth.uid())
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_lead_assignee(id, auth.uid())
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_lead_assignee(id, auth.uid())
  );

-- 6. Lead activities — let co-assignees read/write timeline -------------
drop policy if exists lead_activities_select on public.lead_activities;
create policy lead_activities_select on public.lead_activities for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_activities.lead_id
        and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
    )
    or public.is_lead_assignee(lead_id, auth.uid())
  );

drop policy if exists lead_activities_insert on public.lead_activities;
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (
    public.is_admin()
    or (
      created_by = auth.uid() and (
        exists (
          select 1 from public.leads l
          where l.id = lead_activities.lead_id
            and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
        )
        or public.is_lead_assignee(lead_id, auth.uid())
      )
    )
  );

notify pgrst, 'reload schema';
