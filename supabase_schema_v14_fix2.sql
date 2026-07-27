-- =====================================================================
-- SANKALP GROUP — Schema v14_fix2 (Anon can upload selfie for approvals)
-- Apply to BM App Supabase (Project B) AFTER v14 & v14_fix1.
--
-- BUG: Customer clicking approve via magic-link → selfie upload → Supabase
-- Storage returns HTTP 400 because the INSERT policy on storage.objects
-- only allows 'authenticated' role, and the magic-link flow runs as 'anon'.
--
-- FIX: Add a narrow anon INSERT policy for the safe sub-path
-- `approvals/responses/` inside the attachments bucket only. All other
-- paths still require authentication.
-- =====================================================================

-- Widen the anon insert to the response-photo folder only
drop policy if exists attachments_insert_anon_response on storage.objects;
create policy attachments_insert_anon_response on storage.objects for insert to anon
  with check (
    bucket_id = 'attachments'
    and (name like 'approvals/responses/%')
  );

-- The existing 'authenticated' insert policy remains for all other uploads.

notify pgrst, 'reload schema';
