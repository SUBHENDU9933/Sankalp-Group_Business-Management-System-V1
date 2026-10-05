-- Fix Schedule RLS recursion between schedules and schedule_participants.
-- Both policies previously queried each other, causing PostgreSQL infinite recursion.
-- Use a SECURITY DEFINER access helper so the policies do not call each other through RLS.

create or replace function private.can_access_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.schedules s
    where s.id = p_schedule_id
      and (
        public.is_admin()
        or s.created_by = auth.uid()
        or s.arranged_by = auth.uid()
        or s.owner_id = auth.uid()
        or s.next_action_owner_id = auth.uid()
        or (s.lead_id is not null and private.can_access_lead(s.lead_id))
        or (s.customer_id is not null and private.can_access_customer(s.customer_id))
        or (s.project_id is not null and private.can_access_project(s.project_id))
        or exists (
          select 1
          from public.schedule_participants sp
          where sp.schedule_id = s.id
            and sp.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function private.can_access_schedule(uuid) from public;
grant execute on function private.can_access_schedule(uuid) to authenticated;

drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
for select to authenticated
using (private.can_access_schedule(id));

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules
for update to authenticated
using (private.can_access_schedule(id))
with check (
  public.is_admin()
  or created_by = auth.uid()
  or arranged_by = auth.uid()
  or owner_id = auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
);

drop policy if exists schedule_participants_select on public.schedule_participants;
create policy schedule_participants_select on public.schedule_participants
for select to authenticated
using (private.can_access_schedule(schedule_id));

drop policy if exists schedule_participants_insert on public.schedule_participants;
create policy schedule_participants_insert on public.schedule_participants
for insert to authenticated
with check (
  added_by = auth.uid()
  and private.can_access_schedule(schedule_id)
);

drop policy if exists schedule_participants_update on public.schedule_participants;
create policy schedule_participants_update on public.schedule_participants
for update to authenticated
using (private.can_access_schedule(schedule_id))
with check (private.can_access_schedule(schedule_id));

drop policy if exists schedule_participants_delete on public.schedule_participants;
create policy schedule_participants_delete on public.schedule_participants
for delete to authenticated
using (
  public.is_admin()
  or added_by = auth.uid()
  or private.can_access_schedule(schedule_id)
);
