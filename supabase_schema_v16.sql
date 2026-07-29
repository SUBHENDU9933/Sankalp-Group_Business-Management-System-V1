-- =====================================================================
-- SANKALP GROUP — Schema v16 Additions
-- Apply AFTER /app/supabase_schema_v15.sql.
-- Goal: bring "Edit + Delete Request → Admin Approval → Trash → Permanent
--       Delete" workflow to the Receipts module (same pattern used by
--       leads & customers in v2).
--
-- What this does:
--   1. Adds delete_request columns to public.receipts
--   2. Adds request_delete_receipt / cancel_delete_receipt RPCs (SECURITY
--      DEFINER, so RM without update-row privilege can still raise a
--      request)
--   3. Notifies all admins via public.notifications when a receipt delete
--      is requested (extends notify_admins_delete_request trigger).
--   4. Adds an audit_log trigger entry (piggybacks on existing v14 trigger
--      via receipt_no / amount)
-- =====================================================================

-- 1) Columns -----------------------------------------------------------
alter table public.receipts add column if not exists delete_request boolean not null default false;
alter table public.receipts add column if not exists delete_requested_by uuid references public.profiles(id);
alter table public.receipts add column if not exists delete_requested_at timestamptz;
create index if not exists idx_receipts_delete_request on public.receipts(delete_request) where delete_request = true;

-- 2) RPCs (bypass RLS, so RM can raise a request even if their update policy
--    limits which columns they can write) -----------------------------
create or replace function public.request_delete_receipt(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.receipts
     set delete_request = true,
         delete_requested_by = auth.uid(),
         delete_requested_at = now()
   where id = p_id
     and deleted_at is null;
end $$;
grant execute on function public.request_delete_receipt(uuid) to authenticated;

create or replace function public.cancel_delete_receipt(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.receipts
     set delete_request = false,
         delete_requested_by = null,
         delete_requested_at = null
   where id = p_id;
end $$;
grant execute on function public.cancel_delete_receipt(uuid) to authenticated;

-- 3) Extend notify_admins_delete_request to also work for receipts ----
-- (v2 defined this same-named function for leads & customers; we override
--  it here to add the receipts branch. Existing lead/customer triggers
--  will continue to work unchanged because we still handle both cases.)
create or replace function public.notify_admins_delete_request() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  entity text;
  label text;
  nlink text := '/approvals';
begin
  if (TG_TABLE_NAME = 'leads') then
    entity := 'Lead';
    label  := coalesce(new.name, '');
  elsif (TG_TABLE_NAME = 'customers') then
    entity := 'Customer';
    label  := coalesce(new.name, '');
  elsif (TG_TABLE_NAME = 'receipts') then
    entity := 'Receipt';
    label  := coalesce(new.receipt_no, '') || ' — ₹' || coalesce(new.amount::text, '0');
  else
    entity := TG_TABLE_NAME;
    label  := '';
  end if;

  if (new.delete_request = true and (old.delete_request is distinct from true)) then
    for r in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, link)
      values (
        r.id,
        'delete_request',
        entity || ' delete request: ' || label,
        'Awaiting your approval in /approvals',
        nlink
      );
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_receipt_delete on public.receipts;
create trigger trg_notify_receipt_delete after update on public.receipts
  for each row execute function public.notify_admins_delete_request();

-- 4) Ensure RLS still allows admin soft-delete (writing deleted_at). If
--    your existing receipts_update policy blocks it, uncomment below:
-- drop policy if exists receipts_admin_delete on public.receipts;
-- create policy receipts_admin_delete on public.receipts for update to authenticated
--   using (
--     exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
--     or created_by = auth.uid()
--   );

-- 5) Verify (run manually):
-- select column_name from information_schema.columns where table_name = 'receipts' and column_name like 'delete_%';
-- select routine_name from information_schema.routines where routine_name in ('request_delete_receipt','cancel_delete_receipt');
