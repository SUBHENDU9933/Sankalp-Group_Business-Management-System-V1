-- =====================================================================
-- SANKALP GROUP — Schema v3 Additions
-- Apply AFTER /app/supabase_schema.sql AND /app/supabase_schema_v2.sql.
-- Adds: public verify_receipt RPC so QR-scan from phone (anon) works.
-- =====================================================================

create or replace function public.verify_receipt(p_key text)
returns table(
  id uuid,
  receipt_no text,
  si_no text,
  receipt_uid text,
  customer_name text,
  customer_phone text,
  customer_address text,
  project_name text,
  amount numeric,
  payment_mode text,
  payment_purpose text,
  note text,
  created_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select
    r.id,
    r.receipt_no,
    r.si_no,
    r.receipt_uid,
    c.name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    p.project_name,
    r.amount,
    r.payment_mode::text,
    r.payment_purpose,
    r.note,
    r.created_at
  from public.receipts r
  left join public.customers c on c.id = r.customer_id
  left join public.projects p on p.id = r.project_id
  where r.receipt_uid = p_key or r.id::text = p_key
  limit 1
$$;

revoke all on function public.verify_receipt(text) from public;
grant execute on function public.verify_receipt(text) to anon, authenticated;

-- Backfill receipt_uid for any older rows where it's null (legacy v1 receipts)
update public.receipts
set receipt_uid = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
where receipt_uid is null;

-- Backfill si_no for older rows that don't have it
update public.receipts r
set si_no = to_char(r.created_at, 'YYYY') || 'CR/' || to_char(r.created_at, 'MM') || '/' ||
            lpad(r.receipt_no::text, 3, '0') || '/' || coalesce(r.receipt_uid, '00000')
where r.si_no is null;
