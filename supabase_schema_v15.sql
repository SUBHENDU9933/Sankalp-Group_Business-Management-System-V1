-- =====================================================================
-- SANKALP GROUP — Schema v15 (Shorter Approval Tokens + OG helper RPC)
-- Apply to BM App Supabase (Project B) AFTER v14 & fixes.
--
-- 1. New tokens default to 12-char short hex (URL becomes 5x shorter).
--    Existing rows keep their long 64-char token → those links still work.
--
-- 2. `get_approval_meta_by_token(text)` returns minimal fields for the
--    WhatsApp / OG preview (subject, customer_name, project_name, status).
--    Runs SECURITY DEFINER so the crawler (anon) can fetch it.
-- =====================================================================

alter table public.digital_approvals
  alter column token set default lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));

create or replace function public.get_approval_meta_by_token(p_token text)
returns table (
  subject text,
  customer_name text,
  project_name text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  has_photos boolean
)
language sql
security definer
set search_path = public
as $$
  select subject, customer_name, project_name, status, created_at, expires_at,
         coalesce(jsonb_array_length(photo_urls), 0) > 0 as has_photos
  from public.digital_approvals
  where token = p_token
  limit 1;
$$;
grant execute on function public.get_approval_meta_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
