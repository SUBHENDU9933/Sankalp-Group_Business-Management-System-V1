-- =====================================================================
-- SANKALP GROUP — Schema v9 (Vendor Profile + Documents + Project Ledger)
-- Apply AFTER v1..v8.1.
--   1. Extends vendors with profile, KYC, and payment fields
--   2. Creates a public Supabase Storage bucket 'vendor-docs' for ID card,
--      photo, visiting card uploads
--   3. updated_at trigger on vendors + vendor_payments
-- =====================================================================

-- 1. EXTEND VENDORS ---------------------------------------------------
alter table public.vendors add column if not exists email text;
alter table public.vendors add column if not exists address text;
alter table public.vendors add column if not exists gst_no text;
alter table public.vendors add column if not exists pan_no text;
alter table public.vendors add column if not exists aadhar_no text;
alter table public.vendors add column if not exists upi_id text;
alter table public.vendors add column if not exists account_holder text;
alter table public.vendors add column if not exists account_no text;
alter table public.vendors add column if not exists ifsc text;
alter table public.vendors add column if not exists bank_name text;
alter table public.vendors add column if not exists photo_url text;
alter table public.vendors add column if not exists id_card_url text;
alter table public.vendors add column if not exists visiting_card_url text;
alter table public.vendors add column if not exists notes text;
alter table public.vendors add column if not exists is_active boolean not null default true;
alter table public.vendors add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_vendors_active on public.vendors(is_active);

drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at
  before update on public.vendors
  for each row execute procedure public.set_updated_at();

-- 2. STORAGE BUCKET 'vendor-docs' -------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-docs', 'vendor-docs', true)
on conflict (id) do update set public = true;

-- File path convention: {vendor_id}/{kind}.{ext}
-- Read: public (so direct img/src works).
-- Write: any authenticated user (creators/RMs need to upload). DELETE: same.

drop policy if exists "Public read vendor-docs" on storage.objects;
create policy "Public read vendor-docs"
on storage.objects for select to public
using (bucket_id = 'vendor-docs');

drop policy if exists "Auth users can upload vendor-docs" on storage.objects;
create policy "Auth users can upload vendor-docs"
on storage.objects for insert to authenticated
with check (bucket_id = 'vendor-docs');

drop policy if exists "Auth users can update vendor-docs" on storage.objects;
create policy "Auth users can update vendor-docs"
on storage.objects for update to authenticated
using (bucket_id = 'vendor-docs');

drop policy if exists "Auth users can delete vendor-docs" on storage.objects;
create policy "Auth users can delete vendor-docs"
on storage.objects for delete to authenticated
using (bucket_id = 'vendor-docs');
