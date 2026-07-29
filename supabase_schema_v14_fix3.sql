-- =====================================================================
-- SANKALP GROUP — Schema v14_fix3 (Missing DELETE policies for Trash purge)
-- Apply to BM App Supabase (Project B) AFTER v14 + earlier fixes.
--
-- BUG: Purge & (in some cases) Restore from Trash did nothing on
-- digital_approvals because v14 defined SELECT/INSERT/UPDATE policies but
-- NO DELETE policy → Postgres RLS default-denies DELETE → operation
-- returned 0 rows affected silently, no error surfaced to the UI.
--
-- FIX: Add DELETE policy for admin + creator on all soft-delete entities
-- that were missing it. Existing policies (if any) are preserved via
-- DROP-IF-EXISTS + CREATE.
-- =====================================================================

-- digital_approvals ---------------------------------------------------
drop policy if exists digital_approvals_delete on public.digital_approvals;
create policy digital_approvals_delete on public.digital_approvals
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- vendors (may also lack a delete policy for admin purge) -------------
drop policy if exists vendors_delete on public.vendors;
create policy vendors_delete on public.vendors
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- vendor_payments -----------------------------------------------------
drop policy if exists vendor_payments_delete on public.vendor_payments;
create policy vendor_payments_delete on public.vendor_payments
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- estimates -----------------------------------------------------------
drop policy if exists estimates_delete on public.estimates;
create policy estimates_delete on public.estimates
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- expenses ------------------------------------------------------------
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

notify pgrst, 'reload schema';
