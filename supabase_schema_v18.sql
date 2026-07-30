-- ============================================================
-- SANKALP BMS — Schema v18: Agreement Signing Evidence Upgrade
-- Adds geo-accuracy capture and customer ID-proof document storage,
-- bringing agreement digital signing up to the same evidence
-- standard as Digital Approvals (watermarked selfie, IP, geo, audit trail).
-- Apply once in the Supabase SQL editor, after v17.
-- ============================================================

alter table public.agreements
  add column if not exists response_accuracy double precision,
  add column if not exists id_proof_urls jsonb not null default '[]'::jsonb;  -- [{url, name, type}]

-- Replace the signature RPC to also accept accuracy
create or replace function public.submit_agreement_signature(
  p_token         text,
  p_signer_name   text,
  p_signature_url text,
  p_lat           double precision,
  p_lng           double precision,
  p_accuracy      double precision,
  p_ip            text,
  p_user_agent    text
) returns public.agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.agreements;
begin
  select * into r from public.agreements where token = p_token and deleted_at is null;
  if r.id is null then
    raise exception 'Invalid or expired link';
  end if;
  if r.status = 'signed_digital' then
    return r; -- idempotent — already signed
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    raise exception 'This agreement link has expired';
  end if;

  update public.agreements
  set status = 'signed_digital',
      signer_name = p_signer_name,
      signature_url = p_signature_url,
      signed_at = now(),
      response_lat = p_lat,
      response_lng = p_lng,
      response_accuracy = p_accuracy,
      response_ip = p_ip,
      response_user_agent = p_user_agent
  where id = r.id
  returning * into r;

  return r;
end;
$$;
grant execute on function public.submit_agreement_signature(text, text, text, double precision, double precision, double precision, text, text) to anon, authenticated;

-- Old 7-arg signature (pre-v18) — drop so PostgREST doesn't get confused by
-- overloaded functions with the same name and similar arg count.
drop function if exists public.submit_agreement_signature(text, text, text, double precision, double precision, text, text);
