-- Digital Approvals: allow linking an approval to a LEAD (instead of a customer),
-- with manually entered project details. Additive + reversible. Existing rows untouched.

-- 1) New columns
alter table public.digital_approvals
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists project_location text;

create index if not exists digital_approvals_lead_id_idx on public.digital_approvals(lead_id);

-- 2) Visibility: lead-linked approvals are visible to anyone who can access that lead
--    (plus admin and the creator, as before).
create or replace function private.can_access_digital_approval(p_approval_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  or exists (
    select 1 from public.digital_approvals d
    where d.id = p_approval_id and d.deleted_at is null and (
         (d.project_id is not null and private.can_access_project(d.project_id))
      or (d.project_id is null and d.customer_id is not null and private.can_access_customer(d.customer_id))
      or (d.project_id is null and d.customer_id is null and d.lead_id is not null and private.can_access_lead(d.lead_id))
      or (d.project_id is null and d.customer_id is null and d.created_by = auth.uid())
    )
  );
$$;

-- 3) Insert / update: you may only link a lead you are allowed to access.
drop policy if exists digital_approvals_insert on public.digital_approvals;
create policy digital_approvals_insert on public.digital_approvals for insert to authenticated
with check (
  created_by = auth.uid() and (
       (project_id is null and customer_id is null and (lead_id is null or private.can_access_lead(lead_id)))
    or (project_id is not null and private.can_access_project(project_id))
    or (project_id is null and customer_id is not null and private.can_access_customer(customer_id))
  )
);

drop policy if exists digital_approvals_update on public.digital_approvals;
create policy digital_approvals_update on public.digital_approvals for update to authenticated
using (private.can_access_digital_approval(id))
with check (
  private.can_access_digital_approval(id) and (
       (project_id is null and customer_id is null and (lead_id is null or private.can_access_lead(lead_id)))
    or (project_id is not null and private.can_access_project(project_id))
    or (project_id is null and customer_id is not null and private.can_access_customer(customer_id))
  )
);

-- 4) Lead conversion: when a lead becomes 'converted', move its approvals to the customer.
--    Works for both the app's convert button (customer created first) and the status dropdown
--    (customer created by this trigger). lead_id is kept for history.
create or replace function public.create_customer_on_lead_conversion()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_customer uuid;
begin
  if (new.status = 'converted' and (old.status is null or old.status <> 'converted')) then
    if not exists (select 1 from public.customers c where c.linked_lead_id = new.id) then
      insert into public.customers (name, phone, address, project_details, linked_lead_id, created_by)
      values (new.name, new.phone, new.location,
              trim(both ' — ' from coalesce(new.project_type, '') || ' — ' || coalesce(new.requirement, '')),
              new.id, coalesce(new.created_by, auth.uid()));
      new.is_locked := true;
    end if;
    select c.id into v_customer from public.customers c where c.linked_lead_id = new.id order by c.created_at limit 1;
    if v_customer is not null then
      update public.digital_approvals set customer_id = v_customer
       where lead_id = new.id and customer_id is null and project_id is null;
    end if;
  end if;
  return new;
end $function$;

-- ROLLBACK (manual):
--   restore previous definitions of private.can_access_digital_approval, the two policies and
--   public.create_customer_on_lead_conversion from supabase_schema_v22.sql / prior dump, then:
--   alter table public.digital_approvals drop column lead_id, drop column project_location;
