-- Allow the authenticated creator to create a schedule while selecting any active employee as arranger.
-- The authenticated actor remains created_by; arranged_by is the business assignee.

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules
for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_admin()
    or arranged_by is not null
    or owner_id = auth.uid()
    or (lead_id is not null and private.can_access_lead(lead_id))
    or (customer_id is not null and private.can_access_customer(customer_id))
    or (project_id is not null and private.can_access_project(project_id))
  )
);