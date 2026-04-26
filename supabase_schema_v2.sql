-- =====================================================================
-- SANKALP GROUP — Schema v2 Additions
-- Apply AFTER /app/supabase_schema.sql is already in place.
-- Adds: notifications table, RPC for delete-requests (RLS bypass),
--       receipt_uid + project_id on receipts, vendor-payment → expense bridge.
-- =====================================================================

-- 1. NOTIFICATIONS -----------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,           -- 'delete_request' | 'lead_assigned' | 'info'
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications for update to authenticated using (user_id = auth.uid());
drop policy if exists notif_insert_self on public.notifications;
create policy notif_insert_self on public.notifications for insert to authenticated with check (true);

-- 2. RECEIPT additions: stable verifier UID + project link --------------
alter table public.receipts add column if not exists receipt_uid text unique
  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
alter table public.receipts add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.receipts add column if not exists payment_purpose text;       -- 'advance'|'token'|'part'|'others'
alter table public.receipts add column if not exists transaction_ref text;
alter table public.receipts add column if not exists si_no text;                 -- e.g. 2026CR/04/001/AB

-- Generate SI No for new receipts: pattern 2026CR/MM/NNN/UID
create or replace function public.set_receipt_si_no() returns trigger
language plpgsql as $$
declare yr text; mo text; seq int;
begin
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  mo := to_char(coalesce(new.created_at, now()), 'MM');
  select count(*)+1 into seq from public.receipts where to_char(created_at, 'YYYY-MM') = yr || '-' || mo;
  if new.si_no is null then
    new.si_no := yr || 'CR/' || mo || '/' || lpad(seq::text, 3, '0') || '/' || coalesce(new.receipt_uid, '00000');
  end if;
  return new;
end $$;
drop trigger if exists trg_receipt_si_no on public.receipts;
create trigger trg_receipt_si_no before insert on public.receipts
  for each row execute function public.set_receipt_si_no();

-- 3. RPC: request_delete_lead / customer (security definer, bypass RLS) -
create or replace function public.request_delete_lead(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.leads
     set delete_request = true,
         delete_requested_by = auth.uid(),
         delete_requested_at = now()
   where id = p_id;
end $$;
grant execute on function public.request_delete_lead(uuid) to authenticated;

create or replace function public.cancel_delete_lead(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.leads
     set delete_request = false, delete_requested_by = null, delete_requested_at = null
   where id = p_id;
end $$;
grant execute on function public.cancel_delete_lead(uuid) to authenticated;

create or replace function public.request_delete_customer(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.customers
     set delete_request = true,
         delete_requested_by = auth.uid(),
         delete_requested_at = now()
   where id = p_id;
end $$;
grant execute on function public.request_delete_customer(uuid) to authenticated;

create or replace function public.cancel_delete_customer(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.customers
     set delete_request = false, delete_requested_by = null, delete_requested_at = null
   where id = p_id;
end $$;
grant execute on function public.cancel_delete_customer(uuid) to authenticated;

-- 4. NOTIFY ALL ADMINS when a delete is requested -----------------------
create or replace function public.notify_admins_delete_request() returns trigger
language plpgsql security definer set search_path = public
as $$
declare r record; entity text; entity_id uuid; subj text; nlink text;
begin
  if (TG_TABLE_NAME = 'leads') then entity := 'Lead'; entity_id := new.id; nlink := '/approvals'; end if;
  if (TG_TABLE_NAME = 'customers') then entity := 'Customer'; entity_id := new.id; nlink := '/approvals'; end if;

  if (new.delete_request = true and (old.delete_request is distinct from true)) then
    subj := entity || ' delete request: ' || coalesce(new.name, '');
    for r in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, link)
      values (r.id, 'delete_request', subj, 'Awaiting your approval in /approvals', nlink);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_lead_delete on public.leads;
create trigger trg_notify_lead_delete after update on public.leads
  for each row execute function public.notify_admins_delete_request();

drop trigger if exists trg_notify_customer_delete on public.customers;
create trigger trg_notify_customer_delete after update on public.customers
  for each row execute function public.notify_admins_delete_request();

-- 5. VENDOR PAYMENT → mirror as project EXPENSE (so P/L is correct) -----
create or replace function public.mirror_vendor_payment_expense() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    if new.project_id is not null then
      insert into public.expenses (project_id, category, amount, note, created_by)
      values (new.project_id, 'vendor', new.amount,
              'Vendor payment: ' || coalesce((select name from public.vendors where id = new.vendor_id), '') ||
              case when new.note is not null and new.note <> '' then ' — ' || new.note else '' end,
              new.created_by);
    end if;
  elsif (TG_OP = 'UPDATE') then
    -- best-effort mirror: do nothing on update (keep simple); user can edit expense directly if needed
    null;
  elsif (TG_OP = 'DELETE') then
    null;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_mirror_vp on public.vendor_payments;
create trigger trg_mirror_vp after insert on public.vendor_payments
  for each row execute function public.mirror_vendor_payment_expense();
