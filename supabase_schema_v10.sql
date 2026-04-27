-- =====================================================================
-- SANKALP GROUP — Schema v10 (Fix: auto-create customer when lead → converted)
-- Apply AFTER v1..v9.1.
--
-- Two-part fix for the bug "I marked a lead as converted but no customer
-- record was created":
--   1. BACKFILL — for every lead.status='converted' without a matching
--      customer row (linked_lead_id), create one now.
--   2. TRIGGER — automatically create a customer row whenever a lead's
--      status flips to 'converted' (only if not already present).
-- =====================================================================

-- 1. BACKFILL ----------------------------------------------------------
insert into public.customers (name, phone, address, project_details, linked_lead_id, created_by)
select
  l.name,
  l.phone,
  l.location,
  trim(both ' — ' from coalesce(l.project_type, '') || ' — ' || coalesce(l.requirement, '')),
  l.id,
  l.created_by
from public.leads l
where l.status = 'converted'
  and not exists (
    select 1 from public.customers c where c.linked_lead_id = l.id
  );

-- 2. TRIGGER -----------------------------------------------------------
create or replace function public.create_customer_on_lead_conversion()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.status = 'converted'
      and (old.status is null or old.status <> 'converted')
      and not exists (select 1 from public.customers c where c.linked_lead_id = new.id))
  then
    insert into public.customers (name, phone, address, project_details, linked_lead_id, created_by)
    values (
      new.name,
      new.phone,
      new.location,
      trim(both ' — ' from coalesce(new.project_type, '') || ' — ' || coalesce(new.requirement, '')),
      new.id,
      coalesce(new.created_by, auth.uid())
    );
    -- Lock the lead so it can't be edited further
    new.is_locked := true;
  end if;
  return new;
end
$$;

drop trigger if exists trg_lead_converted on public.leads;
create trigger trg_lead_converted
  before update of status on public.leads
  for each row execute function public.create_customer_on_lead_conversion();

-- Force PostgREST to reload schema
notify pgrst, 'reload schema';
