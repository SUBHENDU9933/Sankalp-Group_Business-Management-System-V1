-- Schedule Phase A: meeting arranger + co-members
-- Keeps created_by as the authenticated audit actor.
-- arranged_by is the selected business user who arranged/generated the meeting.
-- owner_id remains nullable for backward compatibility; new schedules use arranged_by
-- plus explicit schedule_participants instead of treating the arranger as a participant.

alter table public.schedules
  add column if not exists arranged_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_schedules_arranged_by on public.schedules(arranged_by);

drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules for select to authenticated using (
  is_admin() or created_by=auth.uid() or arranged_by=auth.uid() or owner_id=auth.uid() or next_action_owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
  or exists(select 1 from public.schedule_participants sp where sp.schedule_id=schedules.id and sp.user_id=auth.uid())
);

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules for update to authenticated
using (
  is_admin() or created_by=auth.uid() or arranged_by=auth.uid() or owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
  or exists(select 1 from public.schedule_participants sp where sp.schedule_id=schedules.id and sp.user_id=auth.uid())
)
with check (
  is_admin() or created_by=auth.uid() or arranged_by=auth.uid() or owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
);
