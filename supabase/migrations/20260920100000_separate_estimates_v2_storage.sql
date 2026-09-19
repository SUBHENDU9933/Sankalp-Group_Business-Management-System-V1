-- Separate storage for Estimate V2.
-- V2 catalog tables are already isolated in estimate_v2_items / estimate_v2_presets.
-- This migration isolates saved V2 estimates as well.

create table if not exists public.estimates_v2 (
  id uuid primary key default gen_random_uuid(),
  estimate_no text not null,
  lead_id uuid null references public.leads(id),
  customer_name text,
  phone text,
  data jsonb not null default '{}'::jsonb,
  final_amount numeric not null default 0,
  status text not null default 'draft',
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid null references public.profiles(id)
);

create index if not exists idx_estimates_v2_created_at on public.estimates_v2(created_at desc);
create index if not exists idx_estimates_v2_lead_id on public.estimates_v2(lead_id);
create index if not exists idx_estimates_v2_created_by on public.estimates_v2(created_by);
create index if not exists idx_estimates_v2_status on public.estimates_v2(status);
create index if not exists idx_estimates_v2_deleted_at on public.estimates_v2(deleted_at);

alter table public.estimates_v2 enable row level security;

drop policy if exists "estimates_v2_select" on public.estimates_v2;
create policy "estimates_v2_select"
on public.estimates_v2 for select to authenticated
using (
  is_admin()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (lead_id is null and created_by = (select auth.uid()))
);

drop policy if exists "estimates_v2_insert" on public.estimates_v2;
create policy "estimates_v2_insert"
on public.estimates_v2 for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_create_estimate_for_lead(lead_id)
);

drop policy if exists "estimates_v2_update" on public.estimates_v2;
create policy "estimates_v2_update"
on public.estimates_v2 for update to authenticated
using (
  is_admin()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (lead_id is null and created_by = (select auth.uid()))
)
with check (
  (is_admin()
   or (lead_id is not null and private.can_access_lead(lead_id))
   or (lead_id is null and created_by = (select auth.uid())))
  and private.can_create_estimate_for_lead(lead_id)
);

drop policy if exists "estimates_v2_delete" on public.estimates_v2;
create policy "estimates_v2_delete"
on public.estimates_v2 for delete to authenticated
using (
  is_admin()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (lead_id is null and created_by = (select auth.uid()))
);

-- One-time migration of any V2 records that were temporarily stored in public.estimates.
insert into public.estimates_v2
  (id, estimate_no, lead_id, customer_name, phone, data, final_amount, status, created_by, created_at, updated_at, deleted_at, deleted_by)
select
  id, estimate_no, lead_id, customer_name, phone, data, final_amount, status, created_by, created_at, updated_at, deleted_at, deleted_by
from public.estimates
where estimator_version = 2
on conflict (id) do nothing;

delete from public.estimates where estimator_version = 2;
