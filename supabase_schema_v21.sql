-- ============================================================
-- SANKALP BMS — Schema v21 (Agreements: missing DELETE policy)
--
-- BUG: The original v17 migration added SELECT/INSERT/UPDATE RLS
-- policies for `agreements` but no DELETE policy — so "Purge" (hard
-- delete) from the Trash/Recycle Bin would silently return 0 rows,
-- same class of bug already fixed once for other entities in
-- supabase_schema_v14_fix3.sql. This adds the missing policy.
-- ============================================================

drop policy if exists agreements_delete on public.agreements;
create policy agreements_delete on public.agreements
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());
