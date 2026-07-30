-- =====================================================================
-- SANKALP BMS — Schema v20 (Anon can upload selfie + signature pad
-- for agreement digital signing)
--
-- BUG: Customer signing an agreement via the public magic-link
-- (/sign/:token) hit "new row violates row-level security policy" when
-- submitting — the selfie/signature-pad upload to Supabase Storage failed
-- because the INSERT policy on storage.objects only allowed the
-- 'authenticated' role, but the public signing flow runs as 'anon'.
-- Exact same class of bug already fixed once for Digital Approvals
-- (see supabase_schema_v14_fix2.sql) — this widens the same policy.
--
-- FIX: Add the agreement signing sub-paths to the existing narrow anon
-- INSERT policy. All other paths in the bucket still require auth.
-- =====================================================================

drop policy if exists attachments_insert_anon_response on storage.objects;
create policy attachments_insert_anon_response on storage.objects for insert to anon
  with check (
    bucket_id = 'attachments'
    and (
      name like 'approvals/responses/%'
      or name like 'agreements/signatures/%'
      or name like 'agreements/signature-pads/%'
    )
  );

notify pgrst, 'reload schema';
