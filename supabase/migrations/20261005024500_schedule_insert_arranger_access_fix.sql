-- Schedule Phase A follow-up: allow arranger/customer/project based creation.
-- New schedules intentionally keep owner_id null and use arranged_by + explicit participants.

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules
for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_admin()
    or arranged_by = auth.uid()
    or owner_id = auth.uid()
    or (lead_id is not null and private.can_access_lead(lead_id))
    or (customer_id is not null and private.can_access_customer(customer_id))
    or (project_id is not null and private.can_access_project(project_id))
  )
);