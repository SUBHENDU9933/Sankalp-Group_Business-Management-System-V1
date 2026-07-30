-- ============================================================
-- SANKALP BMS — Schema v17: Agreement / MoU Module
-- Dynamic templates + generated agreements + physical/digital signing
-- Apply this whole file once in the Supabase SQL editor.
-- ============================================================

-- ============================================================
-- 1. AGREEMENT TEMPLATES
-- ============================================================
create table if not exists public.agreement_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  is_default       boolean not null default false,
  -- clauses: [{ id, title, body, is_optional, enabled_default, sort_order }]
  clauses          jsonb not null default '[]'::jsonb,
  -- payment_schedule: [{ stage, percent }]
  payment_schedule jsonb not null default '[]'::jsonb,
  -- category_specs: { standard: [line,...], premium: [...], ultra: [...] }
  category_specs   jsonb not null default '{}'::jsonb,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles(id)
);
create index if not exists idx_agreement_templates_deleted on public.agreement_templates(deleted_at) where deleted_at is not null;

drop trigger if exists set_agreement_templates_updated_at on public.agreement_templates;
create trigger set_agreement_templates_updated_at
  before update on public.agreement_templates
  for each row execute function public.set_updated_at();

alter table public.agreement_templates enable row level security;

drop policy if exists agreement_templates_select on public.agreement_templates;
create policy agreement_templates_select on public.agreement_templates for select to authenticated using (true);

drop policy if exists agreement_templates_insert on public.agreement_templates;
create policy agreement_templates_insert on public.agreement_templates for insert to authenticated
  with check (public.is_admin());

drop policy if exists agreement_templates_update on public.agreement_templates;
create policy agreement_templates_update on public.agreement_templates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 2. AGREEMENTS (generated documents)
-- ============================================================
create table if not exists public.agreements (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid references public.agreement_templates(id),
  template_name    text,                 -- snapshot

  customer_id      uuid references public.customers(id) on delete set null,
  customer_name    text,
  lead_id          uuid references public.leads(id) on delete set null,
  project_id       uuid references public.projects(id) on delete set null,
  project_name     text,
  estimate_id      uuid references public.estimates(id) on delete set null,
  estimate_no      text,

  title            text not null default 'Interior Work Agreement',

  -- All merge-field values (client name/address/mobile, project type/location,
  -- estimate no/date, category, contract value, timeline, etc.)
  merge_data       jsonb not null default '{}'::jsonb,
  -- which optional clause ids (from the template) are switched ON for this doc
  enabled_clause_ids jsonb not null default '[]'::jsonb,
  -- per-agreement payment schedule override: [{ stage, percent }]
  payment_schedule jsonb not null default '[]'::jsonb,
  -- full frozen clause text at time of finalising/signing (immutable even if template changes later)
  signed_snapshot  jsonb,

  status           text not null default 'draft'
                     check (status in ('draft','sent','signed_physical','signed_digital','void')),
  signing_mode     text check (signing_mode in ('physical','digital')),

  -- Digital signing (magic-link) fields — same pattern as digital_approvals
  token            text unique,
  expires_at       timestamptz,
  signer_name      text,
  signature_url    text,          -- uploaded signature image / selfie
  signed_at        timestamptz,
  response_lat     double precision,
  response_lng     double precision,
  response_ip      text,
  response_user_agent text,

  -- Physical signing: scanned/photographed signed copy uploaded back
  signed_file_url  text,

  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles(id)
);

create index if not exists idx_agreements_created_at on public.agreements(created_at desc);
create index if not exists idx_agreements_status     on public.agreements(status);
create index if not exists idx_agreements_customer   on public.agreements(customer_id);
create index if not exists idx_agreements_project    on public.agreements(project_id);
create index if not exists idx_agreements_estimate   on public.agreements(estimate_id);
create index if not exists idx_agreements_token      on public.agreements(token);
create index if not exists idx_agreements_deleted    on public.agreements(deleted_at) where deleted_at is not null;

drop trigger if exists set_agreements_updated_at on public.agreements;
create trigger set_agreements_updated_at
  before update on public.agreements
  for each row execute function public.set_updated_at();

alter table public.agreements enable row level security;

drop policy if exists agreements_select on public.agreements;
create policy agreements_select on public.agreements for select to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists agreements_insert on public.agreements;
create policy agreements_insert on public.agreements for insert to authenticated
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists agreements_update on public.agreements;
create policy agreements_update on public.agreements for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

-- ============================================================
-- 3. PUBLIC MAGIC-LINK RPCs (digital signing — no auth required)
-- ============================================================
create or replace function public.get_agreement_by_token(p_token text)
returns setof public.agreements
language sql
security definer
set search_path = public
as $$
  select * from public.agreements where token = p_token and deleted_at is null limit 1;
$$;
grant execute on function public.get_agreement_by_token(text) to anon, authenticated;

create or replace function public.mark_agreement_expired_if_due(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.agreements
  set status = 'sent'  -- stays "sent"; expiry just blocks signing client-side once past expires_at
  where id = p_id and status = 'sent' and expires_at < now();
end;
$$;
grant execute on function public.mark_agreement_expired_if_due(uuid) to authenticated, anon;

create or replace function public.submit_agreement_signature(
  p_token         text,
  p_signer_name   text,
  p_signature_url text,
  p_lat           double precision,
  p_lng           double precision,
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
      response_ip = p_ip,
      response_user_agent = p_user_agent
  where id = r.id
  returning * into r;

  return r;
end;
$$;
grant execute on function public.submit_agreement_signature(text, text, text, double precision, double precision, text, text) to anon, authenticated;

-- ============================================================
-- 4. AUDIT LOG — attach to the two new tables
-- ============================================================
do $$
begin
  execute 'drop trigger if exists trg_audit_agreement_templates on public.agreement_templates';
  execute 'create trigger trg_audit_agreement_templates after insert or update or delete on public.agreement_templates
           for each row execute function public.audit_trigger_fn()';
  execute 'drop trigger if exists trg_audit_agreements on public.agreements';
  execute 'create trigger trg_audit_agreements after insert or update or delete on public.agreements
           for each row execute function public.audit_trigger_fn()';
end $$;

-- ============================================================
-- 5. SEED — default template built from the uploaded master draft
-- ============================================================
insert into public.agreement_templates (name, description, is_default, clauses, payment_schedule, category_specs)
select
  'Interior Work Agreement — Master Draft',
  'Default company template covering project reference, contract value, payment terms, timeline, scope, materials, warranty and dispute resolution.',
  true,
  '[
    {"id":"project_reference","title":"1. Project Reference & Contract Basis","is_optional":false,"enabled_default":true,"sort_order":1,
     "body":"This Agreement is executed with reference to the approved estimate issued by Sankalp Interior Solution for the Client''s {{project_type}} at {{project_location}}, under Estimate No. {{estimate_no}} dated {{estimate_date}} (valid for {{estimate_validity}}). The approved estimate, drawings, material specifications, design approvals, communications, technical notes, inclusions, exclusions, scope descriptions, and mutually accepted commercial terms shall collectively form an inseparable and legally binding part of this Agreement."},
    {"id":"contract_value","title":"2. Agreed Contract Value","is_optional":false,"enabled_default":true,"sort_order":2,
     "body":"Final Selected Category: {{category}}. Final Agreed Contract Value: ₹{{contract_value}} ({{contract_value_words}}). The above value is an estimated project value based on preliminary measurements, approved scope, tentative design assumptions, material specifications and prevailing market conditions at the time of quotation. The final billing amount shall be determined based on final approved site measurements, actual executed quantities, final material selections, approved design modifications and approved additions/deletions/variation work."},
    {"id":"billing_change_control","title":"3. Final Billing, Approval & Change Control","is_optional":false,"enabled_default":true,"sort_order":3,
     "body":"All furniture, modular units, wardrobes, kitchens, paneling and other interior execution items shall be billed based on final approved site measurements and actual executed quantities. Electrical accessories, decorative lighting and similar items are estimated on a provisional basis unless specifically quantified. After agreement execution, the approved scope shall generally not be reduced; items may be redesigned, resized or replaced subject to mutual written approval. Once final designs/materials are approved, the same shall be treated as final execution authorisation — any modification requested thereafter may attract additional cost and timeline revision."},
    {"id":"payment_terms","title":"4. Payment Terms","is_optional":false,"enabled_default":true,"sort_order":4,
     "body":"Payments shall be released as per the agreed payment schedule below, linked to the agreed contract value. Work execution, production scheduling, procurement, manufacturing, dispatch and installation shall remain strictly linked to timely payment clearance. {{payment_schedule_table}}"},
    {"id":"timeline","title":"5. Project Timeline","is_optional":false,"enabled_default":true,"sort_order":5,
     "body":"The estimated project execution timeline shall be approximately {{timeline_days}} working days from the date of Final Design Approval, Advance Payment Clearance and Site Readiness Confirmation, plus a reasonable buffer of up to {{buffer_days}} working days for procurement, customisation, transportation and other circumstances beyond the Contractor''s reasonable operational control."},
    {"id":"scope_of_work","title":"6. Approved Scope of Work","is_optional":false,"enabled_default":true,"sort_order":6,
     "body":"The Contractor shall execute only those works specifically included in Estimate No. {{estimate_no}}. Approved scope: {{scope_items}}. Any work item not expressly mentioned shall be considered excluded unless separately approved in writing."},
    {"id":"material_spec","title":"7. Material Specification & Execution Category","is_optional":false,"enabled_default":true,"sort_order":7,
     "body":"The Client acknowledges that category-wise material specifications, finish standards, hardware references, inclusions and exclusions have been explained and accepted for the {{category}} category. {{category_specs_table}} Where market availability necessitates substitution, equivalent quality materials within the approved category may be used without materially affecting execution standards."},
    {"id":"design_support","title":"8. Complimentary Design Support","is_optional":false,"enabled_default":true,"sort_order":8,
     "body":"As a value-added service, Sankalp Interior Solution may provide layout guidance, furniture elevation concepts, material suggestions, selective 3D previews and project design coordination for the approved scope. Advanced premium design services (full-home cinematic walkthroughs, unlimited revisions, consultancy-level deliverables) are not included unless separately engaged. Final design approval shall be required prior to production."},
    {"id":"site_conditions","title":"9. Execution Conditions & Site Responsibility","is_optional":false,"enabled_default":true,"sort_order":9,
     "body":"The Client agrees to provide uninterrupted site access, working electricity, water supply and safe execution conditions reasonably required for execution. If hidden defects (seepage, dampness, structural mismatch, concealed electrical/plumbing issues) are discovered during execution, rectification shall be treated as additional work unless already included."},
    {"id":"warranty","title":"10. Warranty","is_optional":false,"enabled_default":true,"sort_order":10,
     "body":"Sankalp Interior Solution shall provide 12 Months Workmanship Warranty on manufacturing and installation work directly executed under this Agreement, with extended service support of up to 5 years (Standard), up to 10 years (Premium) or up to 10–15 years (Ultra). This extended support is a service-assistance commitment, not an unconditional replacement warranty, and shall not apply to water damage, seepage, termite attack, fire, flood, electrical faults, misuse, negligence or normal wear and tear."},
    {"id":"force_majeure","title":"11. Delay / Suspension / Force Majeure","is_optional":false,"enabled_default":true,"sort_order":11,
     "body":"The Contractor reserves the right to reasonably pause, reschedule or extend execution timelines in the event of payment delays, approval delays, unsafe working conditions, material/labour shortages, transportation disruptions, weather conditions, government restrictions or circumstances beyond the Contractor''s reasonable operational control. Such circumstances shall not constitute contractor default."},
    {"id":"outstation","title":"12. Outstation Project Conditions","is_optional":true,"enabled_default":false,"sort_order":12,
     "body":"Since this project is located at {{project_location}}, transportation, logistics movement, freight dependency and labour movement shall be subject to practical outstation execution realities. External delays caused by transporter availability, route restrictions, weather disruption or other uncontrollable external logistics conditions shall not constitute contractor default."},
    {"id":"cancellation","title":"13. Cancellation Policy","is_optional":false,"enabled_default":true,"sort_order":13,
     "body":"If the Client cancels the project after material procurement, production planning, manufacturing commencement or work initiation, all costs incurred up to the cancellation date — including material cost, labour commitments, transportation and administrative expenses — shall remain payable by the Client. Any utilised advance payment shall be non-refundable."},
    {"id":"promotional_offer","title":"14. Complimentary Promotional Offer","is_optional":true,"enabled_default":false,"sort_order":14,
     "body":"Upon complete payment clearance, including final snag closure payment, the Client shall be eligible to receive {{promotional_gift}}. Selection of model, brand, specification and availability shall remain entirely at Contractor promotional discretion. This offer is non-cash, non-transferable, non-adjustable and automatically void in case of payment default, cancellation or contractual breach."},
    {"id":"dispute","title":"15. Dispute Resolution","is_optional":false,"enabled_default":true,"sort_order":15,
     "body":"Any dispute arising between the parties shall first be attempted to be resolved amicably through mutual discussion. Failing such resolution, the matter shall be subject to the exclusive jurisdiction of the competent courts of Kolkata, West Bengal."},
    {"id":"acceptance","title":"16. Acceptance & Contract Documents","is_optional":false,"enabled_default":true,"sort_order":16,
     "body":"This Agreement, together with the approved estimate, approved design/execution drawings, material selection confirmations, approved change/variation records, work orders and mutually acknowledged written communications, shall collectively constitute the complete contractual understanding between both parties. By signing below, both parties acknowledge that they have read, understood and voluntarily accepted all terms and conditions contained herein."}
  ]'::jsonb,
  '[
    {"stage":"Advance / Booking","percent":30},
    {"stage":"On Material Dispatch","percent":40},
    {"stage":"On Site Installation Start","percent":20},
    {"stage":"On Final Handover","percent":10}
  ]'::jsonb,
  '{
    "standard": ["ISI Standard MR/BWR Grade Ply","0.8mm Standard Laminate Finish","Standard Hardware, Hinges & Channels","Standard Workmanship & Finishing"],
    "premium": ["BWR/BWP / RedCore Equivalent Ply","Premium Laminate Finish","Branded Hardware (Ebco / Hettich / Godrej Equivalent)","Soft Close Hinges","Enhanced Craftsmanship & Finishing"],
    "ultra": ["Century Sainik 710 Grade Ply","Premium Laminate Finish (Merino / Keya Lam / Black Cobra or Equivalent)","Branded Hardware (Ebco / Hettich / Godrej Equivalent)","Soft Close Drawers & Hinges","Superior Craftsmanship & Finishing"]
  }'::jsonb
where not exists (select 1 from public.agreement_templates where name = 'Interior Work Agreement — Master Draft');

-- ============================================================
-- Done. After applying: reload PostgREST schema cache
-- (Supabase does this automatically within a few seconds).
-- ============================================================
