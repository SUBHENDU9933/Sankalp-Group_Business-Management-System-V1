-- =====================================================================
-- SANKALP GROUP — Schema v4 Additions (Lead Management Upgrade)
-- Apply AFTER v1, v2, v3.
--   1. Adds new lead columns (phone_secondary, area, pincode, property_type,
--      area_sqft, priority, last_contact_date)
--   2. Tightens RLS so RM users only see leads they created or are assigned to.
--      Admins continue to see everything (via public.is_admin()).
--   3. Adds lead_activities table for the Lead Details timeline tab.
-- =====================================================================

-- 1. NEW LEAD COLUMNS ----------------------------------------------------
alter table public.leads add column if not exists phone_secondary text;
alter table public.leads add column if not exists area text;
alter table public.leads add column if not exists pincode text;
alter table public.leads add column if not exists property_type text;
alter table public.leads add column if not exists area_sqft numeric;
alter table public.leads add column if not exists priority text;          -- 'hot' | 'warm' | 'cold'
alter table public.leads add column if not exists last_contact_date date;

create index if not exists idx_leads_priority on public.leads(priority);
create index if not exists idx_leads_pincode on public.leads(pincode);

-- 2. TIGHTEN RLS — role-based visibility ---------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  );

-- INSERT: any authenticated user can create; created_by must be self (or admin).
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated
  with check (
    public.is_admin() or created_by = auth.uid()
  );

-- UPDATE / DELETE policies remain (admin or assignee/creator).

-- Customers: RM only sees customers they created.
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
  );

-- Projects: RM only sees projects on customers they created.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.customers c
      where c.id = projects.customer_id and c.created_by = auth.uid()
    )
  );

-- 3. LEAD ACTIVITIES (timeline) -----------------------------------------
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,                   -- 'note' | 'call' | 'status_change' | 'followup'
  content text,
  meta jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_activities_lead on public.lead_activities(lead_id, created_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists lead_activities_select on public.lead_activities;
create policy lead_activities_select on public.lead_activities for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_activities.lead_id
        and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
    )
  );

drop policy if exists lead_activities_insert on public.lead_activities;
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.leads l
        where l.id = lead_activities.lead_id
          and (l.created_by = auth.uid() or l.assigned_to = auth.uid())
      )
    )
  );

drop policy if exists lead_activities_delete on public.lead_activities;
create policy lead_activities_delete on public.lead_activities for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());
