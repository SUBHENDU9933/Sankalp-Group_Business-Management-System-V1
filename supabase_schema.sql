-- =====================================================================
-- SANKALP GROUP & BUSINESS SOLUTIONS — Business Management System v1
-- Supabase Postgres Schema + RLS + Admin Profile Seed
-- =====================================================================
-- HOW TO USE:
-- 1. Open Supabase Dashboard -> SQL Editor -> New Query
-- 2. Paste the entire content of this file and click "Run"
-- 3. Then go to Authentication -> Users and confirm admin user exists
--    (info.subhendu@gmail.com). The trigger below will auto-create profile,
--    but since you already created the user, we explicitly upsert below.
-- =====================================================================

-- ENUMS -------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'rm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum (
    'new', 'contacted', 'site_visit', 'quotation_given',
    'negotiation', 'converted', 'lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum ('cash', 'bank', 'upi', 'cheque', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_category as enum ('labour', 'material', 'vendor', 'transport', 'misc');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- PROFILES ----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role user_role not null default 'rm',
  created_at timestamptz not null default now()
);

-- LEADS -------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  location text,
  project_type text,
  requirement text,
  budget numeric,
  source text,
  status lead_status not null default 'new',
  next_followup_date date,
  reminder_note text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  delete_request boolean not null default false,
  delete_requested_by uuid references public.profiles(id),
  delete_requested_at timestamptz,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_followup on public.leads(next_followup_date);

-- CUSTOMERS ---------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  project_details text,
  linked_lead_id uuid references public.leads(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  delete_request boolean not null default false,
  delete_requested_by uuid references public.profiles(id),
  delete_requested_at timestamptz,
  created_at timestamptz not null default now()
);

-- RECEIPTS (auto receipt_no) ---------------------------------------
create sequence if not exists receipt_no_seq start 1001;
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique default ('SG-' || lpad(nextval('receipt_no_seq')::text, 5, '0')),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_mode payment_mode not null default 'cash',
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- PROJECTS ----------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  project_name text not null,
  location text,
  start_date date,
  status project_status not null default 'planning',
  total_value numeric default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- EXPENSES ----------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category expense_category not null default 'misc',
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- VENDORS -----------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  phone text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- VENDOR PAYMENTS ---------------------------------------------------
create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'rm')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger for leads
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;
alter table public.receipts enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_payments enable row level security;

-- PROFILES POLICIES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

-- Generic policy macro (SELECT/INSERT/UPDATE for all authenticated; DELETE admin-only)
-- LEADS
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (true);
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated with check (true);
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
  using (public.is_admin() or created_by = auth.uid() or assigned_to = auth.uid())
  with check (public.is_admin() or created_by = auth.uid() or assigned_to = auth.uid());
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated using (public.is_admin());

-- CUSTOMERS
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated using (true);
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check (true);
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated using (public.is_admin());

-- RECEIPTS
drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts for select to authenticated using (true);
drop policy if exists receipts_insert on public.receipts;
create policy receipts_insert on public.receipts for insert to authenticated with check (true);
drop policy if exists receipts_update on public.receipts;
create policy receipts_update on public.receipts for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists receipts_delete on public.receipts;
create policy receipts_delete on public.receipts for delete to authenticated using (public.is_admin());

-- PROJECTS
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (true);
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (true);
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

-- EXPENSES
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (true);
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (true);
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_admin());

-- VENDORS
drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors for select to authenticated using (true);
drop policy if exists vendors_insert on public.vendors;
create policy vendors_insert on public.vendors for insert to authenticated with check (true);
drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists vendors_delete on public.vendors;
create policy vendors_delete on public.vendors for delete to authenticated using (public.is_admin());

-- VENDOR PAYMENTS
drop policy if exists vp_select on public.vendor_payments;
create policy vp_select on public.vendor_payments for select to authenticated using (true);
drop policy if exists vp_insert on public.vendor_payments;
create policy vp_insert on public.vendor_payments for insert to authenticated with check (true);
drop policy if exists vp_update on public.vendor_payments;
create policy vp_update on public.vendor_payments for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists vp_delete on public.vendor_payments;
create policy vp_delete on public.vendor_payments for delete to authenticated using (public.is_admin());

-- =====================================================================
-- SEED ADMIN PROFILE for the existing auth user
-- =====================================================================
insert into public.profiles (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Subhendu (Admin)'), 'admin'::user_role
from auth.users
where email = 'info.subhendu@gmail.com'
on conflict (id) do update set role = 'admin', full_name = excluded.full_name;
