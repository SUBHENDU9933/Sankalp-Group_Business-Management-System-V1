-- =====================================================================
-- SANKALP GROUP — Schema v5 (Estimate System)
-- Apply AFTER v1..v4.
--   1. estimates table (full state stored as JSON in `data`)
--   2. RLS — admin sees all; RM sees only their own
--   3. RPC next_estimate_no() — atomic auto-increment per yr/mm
-- =====================================================================

-- Sequence for estimate_no (global incremental counter)
create sequence if not exists public.estimate_seq start 1 increment 1;

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_no text unique not null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_name text,
  phone text,
  data jsonb not null default '{}'::jsonb,
  final_amount numeric not null default 0,
  status text not null default 'draft',     -- draft | sent | approved | rejected
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_estimates_created_by on public.estimates(created_by);
create index if not exists idx_estimates_lead on public.estimates(lead_id);
create index if not exists idx_estimates_status on public.estimates(status);

drop trigger if exists set_estimates_updated_at on public.estimates;
create trigger set_estimates_updated_at
  before update on public.estimates
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.estimates enable row level security;

drop policy if exists estimates_select on public.estimates;
create policy estimates_select on public.estimates for select to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists estimates_insert on public.estimates;
create policy estimates_insert on public.estimates for insert to authenticated
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists estimates_update on public.estimates;
create policy estimates_update on public.estimates for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists estimates_delete on public.estimates;
create policy estimates_delete on public.estimates for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- RPC: generate next estimate number (e.g. 2026-INT-EST-04-SL00027)
create or replace function public.next_estimate_no()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_seq bigint;
  v_yr  text := to_char(now(), 'YYYY');
  v_mo  text := to_char(now(), 'MM');
begin
  v_seq := nextval('public.estimate_seq');
  return v_yr || '-INT-EST-' || v_mo || '-SL' || lpad(v_seq::text, 5, '0');
end
$$;

revoke all on function public.next_estimate_no() from public;
grant execute on function public.next_estimate_no() to authenticated;
