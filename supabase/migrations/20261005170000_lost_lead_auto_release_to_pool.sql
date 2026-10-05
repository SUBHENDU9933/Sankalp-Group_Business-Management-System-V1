-- Lost Lead Recycling: release current ownership when a lead enters Lost.
-- This preserves lost_by/lost_at/lost_previous_assigned_to for attribution/history.

create or replace function public.capture_lost_lead_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'lost' and coalesce(old.status::text,'') <> 'lost' then
    new.lost_by := (select auth.uid());
    new.lost_at := now();
    new.lost_previous_assigned_to := old.assigned_to;
    new.assigned_to := null;

    update public.lead_assignees
    set removed_at = now()
    where lead_id = new.id
      and removed_at is null;
  end if;

  return new;
end;
$function$;

-- Normalize any existing Lost leads that still have a current owner.
update public.lead_assignees la
set removed_at = now()
from public.leads l
where la.lead_id = l.id
  and l.status = 'lost'
  and la.removed_at is null
  and l.assigned_to is not null;

update public.leads
set assigned_to = null
where status = 'lost'
  and assigned_to is not null;
