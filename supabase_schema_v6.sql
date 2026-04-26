-- =====================================================================
-- SANKALP GROUP — Schema v6 (Profile Upgrade for Estimate Auto-Population)
-- Apply AFTER v1..v5.
--   1. Adds `designation` and `signature_url` to profiles
--   2. Creates a public 'signatures' storage bucket with RLS
--      (each user can upload/update only their own signature file)
-- =====================================================================

-- 1. PROFILE COLUMNS ----------------------------------------------------
alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists signature_url text;

-- 2. STORAGE BUCKET FOR SIGNATURES -------------------------------------
-- Create a public bucket called 'signatures' (image URLs can be embedded directly)
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do update set public = true;

-- File naming convention used by frontend: {user_id}/sign.{ext}
-- This lets RLS check folder name against auth.uid()

-- Drop existing policies (idempotent)
drop policy if exists "Public read signatures" on storage.objects;
drop policy if exists "Users can upload own signature" on storage.objects;
drop policy if exists "Users can update own signature" on storage.objects;
drop policy if exists "Users can delete own signature" on storage.objects;

-- Public read (so <img src="..."> works without auth headers)
create policy "Public read signatures"
on storage.objects for select
to public
using (bucket_id = 'signatures');

-- Authenticated users can upload only into their own folder ({user_id}/...)
create policy "Users can upload own signature"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update only their own files
create policy "Users can update own signature"
on storage.objects for update
to authenticated
using (
  bucket_id = 'signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete only their own files
create policy "Users can delete own signature"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
