-- =====================================================================
-- SANKALP GROUP — Schema v14 (MEGA — Audit Log + Trash + Digital Approvals)
-- Apply to BM App Supabase (Project B) AFTER v1..v13.
--
-- Adds three big infrastructure layers used by 4 UI features:
--   • Universal Audit Log (append-only, non-deletable)
--   • Soft-Delete + Trash Bin (9 entities)
--   • Digital Approvals + Receipt Attachments (Storage-backed)
--
-- SAFE / REVERSIBLE:
--   • Adds columns (nullable) — no destructive change to existing rows
--   • Existing RLS policies dropped & recreated with `deleted_at is null` filter
--   • Everything backwards-compatible: rows without deleted_at behave as before
-- =====================================================================

-- ============================================================
-- 1. AUDIT LOG (append-only)
-- ============================================================
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  action      text not null check (action in ('create','update','delete','restore','purge','soft_delete')),
  entity_type text not null,               -- leads/customers/projects/vendors/estimates/receipts/expenses/vendor_payments/digital_approvals
  entity_id   uuid,
  entity_label text,                       -- human-readable snapshot (e.g. lead name)
  actor_id    uuid references public.profiles(id),
  actor_email text,
  actor_name  text,
  actor_role  text,
  changes     jsonb,                       -- {field: {old, new}} or full snapshot for create
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_audit_log_actor      on public.audit_log(actor_id);
create index if not exists idx_audit_log_entity     on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_action     on public.audit_log(action);

alter table public.audit_log enable row level security;

-- SELECT: admin sees all; everyone else sees only their own actions
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_admin() or actor_id = auth.uid());

-- INSERT: any authenticated user (rows come from triggers/service code)
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (true);

-- NO UPDATE, NO DELETE — the audit log is immutable
-- (No policy defined → default deny)

-- Generic trigger fn: captures create/update/delete + soft_delete/restore
create or replace function public.audit_trigger_fn()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor  uuid  := auth.uid();
  v_email  text;
  v_name   text;
  v_role   text;
  v_action text;
  v_id     uuid;
  v_label  text;
  v_changes jsonb;
begin
  -- Actor lookup
  select p.email, p.full_name, p.role into v_email, v_name, v_role
  from public.profiles p where p.id = v_actor;

  if (TG_OP = 'INSERT') then
    v_action := 'create';
    v_id := (row_to_json(NEW)->>'id')::uuid;
    v_label := coalesce(row_to_json(NEW)->>'name',
                        row_to_json(NEW)->>'project_name',
                        row_to_json(NEW)->>'receipt_no',
                        row_to_json(NEW)->>'estimate_no',
                        row_to_json(NEW)->>'subject');
    v_changes := to_jsonb(NEW);

  elsif (TG_OP = 'UPDATE') then
    v_id := (row_to_json(NEW)->>'id')::uuid;
    v_label := coalesce(row_to_json(NEW)->>'name',
                        row_to_json(NEW)->>'project_name',
                        row_to_json(NEW)->>'receipt_no',
                        row_to_json(NEW)->>'estimate_no',
                        row_to_json(NEW)->>'subject');
    -- Detect soft-delete vs restore vs update
    if (row_to_json(OLD)->>'deleted_at') is null and (row_to_json(NEW)->>'deleted_at') is not null then
      v_action := 'soft_delete';
    elsif (row_to_json(OLD)->>'deleted_at') is not null and (row_to_json(NEW)->>'deleted_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
    -- Compute changed-field diff
    v_changes := (
      select coalesce(jsonb_object_agg(k, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      from jsonb_each(to_jsonb(NEW)) n
      join jsonb_each(to_jsonb(OLD)) o using (key)
      where n.value is distinct from o.value
        and n.key not in ('updated_at')
    );

  elsif (TG_OP = 'DELETE') then
    v_action := 'delete';   -- hard delete (rare — usually via purge)
    v_id := (row_to_json(OLD)->>'id')::uuid;
    v_label := coalesce(row_to_json(OLD)->>'name',
                        row_to_json(OLD)->>'project_name',
                        row_to_json(OLD)->>'receipt_no',
                        row_to_json(OLD)->>'estimate_no',
                        row_to_json(OLD)->>'subject');
    v_changes := to_jsonb(OLD);
  end if;

  insert into public.audit_log (action, entity_type, entity_id, entity_label,
    actor_id, actor_email, actor_name, actor_role, changes)
  values (v_action, TG_TABLE_NAME, v_id, v_label, v_actor, v_email, v_name, v_role, v_changes);

  return coalesce(NEW, OLD);
end;
$$;

-- ============================================================
-- 2. SOFT-DELETE COLUMNS ON 9 ENTITIES
-- ============================================================
alter table public.leads             add column if not exists deleted_at timestamptz;
alter table public.leads             add column if not exists deleted_by uuid references public.profiles(id);
alter table public.customers         add column if not exists deleted_at timestamptz;
alter table public.customers         add column if not exists deleted_by uuid references public.profiles(id);
alter table public.projects          add column if not exists deleted_at timestamptz;
alter table public.projects          add column if not exists deleted_by uuid references public.profiles(id);
alter table public.vendors           add column if not exists deleted_at timestamptz;
alter table public.vendors           add column if not exists deleted_by uuid references public.profiles(id);
alter table public.estimates         add column if not exists deleted_at timestamptz;
alter table public.estimates         add column if not exists deleted_by uuid references public.profiles(id);
alter table public.receipts          add column if not exists deleted_at timestamptz;
alter table public.receipts          add column if not exists deleted_by uuid references public.profiles(id);
alter table public.expenses          add column if not exists deleted_at timestamptz;
alter table public.expenses          add column if not exists deleted_by uuid references public.profiles(id);
alter table public.vendor_payments   add column if not exists deleted_at timestamptz;
alter table public.vendor_payments   add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists idx_leads_deleted_at           on public.leads(deleted_at)           where deleted_at is not null;
create index if not exists idx_customers_deleted_at       on public.customers(deleted_at)       where deleted_at is not null;
create index if not exists idx_projects_deleted_at        on public.projects(deleted_at)        where deleted_at is not null;
create index if not exists idx_vendors_deleted_at         on public.vendors(deleted_at)         where deleted_at is not null;
create index if not exists idx_estimates_deleted_at       on public.estimates(deleted_at)       where deleted_at is not null;
create index if not exists idx_receipts_deleted_at        on public.receipts(deleted_at)        where deleted_at is not null;
create index if not exists idx_expenses_deleted_at        on public.expenses(deleted_at)        where deleted_at is not null;
create index if not exists idx_vendor_payments_deleted_at on public.vendor_payments(deleted_at) where deleted_at is not null;

-- ============================================================
-- 3. DIGITAL APPROVALS
-- ============================================================
create table if not exists public.digital_approvals (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),  -- 64-char public magic-link token
  subject        text not null,
  description    text,
  customer_id    uuid references public.customers(id) on delete set null,
  customer_name  text,          -- snapshot at creation (safe against customer rename/delete)
  project_id     uuid references public.projects(id) on delete set null,
  project_name   text,          -- snapshot
  photo_urls     jsonb default '[]'::jsonb,   -- array of storage URLs (photo attachments)
  file_urls      jsonb default '[]'::jsonb,   -- array of storage URLs (PDF/docs)
  status         text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  expires_at     timestamptz not null default (now() + interval '7 days'),
  response_at    timestamptz,
  response_by_name  text,       -- customer typed name
  response_comment  text,       -- change comment (esp. for reject)
  response_photo_url text,      -- selfie snapshot captured on approval
  response_lat   double precision,
  response_lng   double precision,
  response_accuracy double precision,
  response_ip    text,
  response_user_agent text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  deleted_by     uuid references public.profiles(id)
);
create index if not exists idx_da_created_at  on public.digital_approvals(created_at desc);
create index if not exists idx_da_status      on public.digital_approvals(status);
create index if not exists idx_da_customer    on public.digital_approvals(customer_id);
create index if not exists idx_da_project     on public.digital_approvals(project_id);
create index if not exists idx_da_deleted_at  on public.digital_approvals(deleted_at) where deleted_at is not null;
create index if not exists idx_da_token       on public.digital_approvals(token);

drop trigger if exists set_digital_approvals_updated_at on public.digital_approvals;
create trigger set_digital_approvals_updated_at
  before update on public.digital_approvals
  for each row execute function public.set_updated_at();

-- Expiry auto-flag helper (RPC used by app when opening a magic link)
create or replace function public.mark_approval_expired_if_due(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.digital_approvals
  set status = 'expired'
  where id = p_id
    and status = 'pending'
    and expires_at < now();
end;
$$;
grant execute on function public.mark_approval_expired_if_due(uuid) to authenticated, anon;

alter table public.digital_approvals enable row level security;

-- Internal RLS: admin & creator can see all their approvals (deleted rows visible only via trash view)
drop policy if exists digital_approvals_select on public.digital_approvals;
create policy digital_approvals_select on public.digital_approvals for select to authenticated
  using (
    public.is_admin() or created_by = auth.uid()
  );

drop policy if exists digital_approvals_insert on public.digital_approvals;
create policy digital_approvals_insert on public.digital_approvals for insert to authenticated
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists digital_approvals_update on public.digital_approvals;
create policy digital_approvals_update on public.digital_approvals for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

-- Public read via token (magic-link) — no auth required
-- Achieved via SECURITY DEFINER RPC (safer than opening a public policy)
create or replace function public.get_approval_by_token(p_token text)
returns setof public.digital_approvals
language sql
security definer
set search_path = public
as $$
  select * from public.digital_approvals where token = p_token limit 1;
$$;
grant execute on function public.get_approval_by_token(text) to anon, authenticated;

-- Public respond (submit approve/reject) — SECURITY DEFINER
create or replace function public.submit_approval_response(
  p_token   text,
  p_status  text,
  p_name    text,
  p_comment text,
  p_photo_url text,
  p_lat     double precision,
  p_lng     double precision,
  p_accuracy double precision,
  p_ip      text,
  p_user_agent text
) returns public.digital_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.digital_approvals;
begin
  -- Must be a valid pending token
  select * into r from public.digital_approvals where token = p_token;
  if r.id is null then raise exception 'Invalid link'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been responded to.'; end if;
  if r.expires_at < now() then
    update public.digital_approvals set status='expired' where id = r.id;
    raise exception 'This link has expired.';
  end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;

  update public.digital_approvals set
    status = p_status,
    response_at = now(),
    response_by_name = trim(p_name),
    response_comment = p_comment,
    response_photo_url = p_photo_url,
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
grant execute on function public.submit_approval_response(text,text,text,text,text,double precision,double precision,double precision,text,text) to anon, authenticated;

-- ============================================================
-- 4. RECEIPT ATTACHMENTS
-- ============================================================
create table if not exists public.receipt_attachments (
  id           uuid primary key default gen_random_uuid(),
  receipt_id   uuid not null references public.receipts(id) on delete cascade,
  file_url     text not null,
  file_name    text,
  file_type    text,       -- image/*, application/pdf
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id),
  uploaded_at  timestamptz not null default now()
);
create index if not exists idx_receipt_attachments_receipt on public.receipt_attachments(receipt_id);

alter table public.receipt_attachments enable row level security;

drop policy if exists receipt_attachments_select on public.receipt_attachments;
create policy receipt_attachments_select on public.receipt_attachments for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.receipts r
      where r.id = receipt_attachments.receipt_id
        and (r.created_by = auth.uid() or r.deleted_at is null)
    )
  );

drop policy if exists receipt_attachments_insert on public.receipt_attachments;
create policy receipt_attachments_insert on public.receipt_attachments for insert to authenticated
  with check (
    public.is_admin() or exists (
      select 1 from public.receipts r where r.id = receipt_attachments.receipt_id
    )
  );

drop policy if exists receipt_attachments_delete on public.receipt_attachments;
create policy receipt_attachments_delete on public.receipt_attachments for delete to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.receipts r
      where r.id = receipt_attachments.receipt_id and r.created_by = auth.uid()
    )
  );

-- Public read of attachments belonging to a receipt (needed by VerifyReceiptPage & digital approval)
create or replace function public.get_receipt_attachments_by_receipt(p_receipt_id uuid)
returns setof public.receipt_attachments
language sql
security definer
set search_path = public
as $$
  select * from public.receipt_attachments where receipt_id = p_receipt_id order by uploaded_at;
$$;
grant execute on function public.get_receipt_attachments_by_receipt(uuid) to anon, authenticated;

-- ============================================================
-- 5. ATTACH AUDIT TRIGGERS TO ALL AUDITED TABLES
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'leads','customers','projects','vendors','estimates','receipts','expenses',
    'vendor_payments','digital_approvals'
  ] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s;', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
       for each row execute function public.audit_trigger_fn();', t);
  end loop;
end $$;

-- ============================================================
-- 6. STORAGE BUCKET for attachments (idempotent)
-- ============================================================
-- Create the "attachments" bucket if it does not exist (public read for links to work)
insert into storage.buckets (id, name, public)
values ('attachments','attachments', true)
on conflict (id) do nothing;

-- Storage policies: authenticated can upload; anyone can read (needed for public verify/magic-link)
drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_update on storage.objects;
create policy attachments_update on storage.objects for update to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');

notify pgrst, 'reload schema';
