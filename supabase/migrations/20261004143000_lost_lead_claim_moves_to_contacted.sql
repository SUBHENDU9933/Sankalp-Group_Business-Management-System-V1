-- Lost Lead Recycling v1 follow-up:
-- Claiming a Lost Pool lead makes it an owned Contacted lead.
-- The Lost Pool only contains unassigned leads with status = lost.
create or replace function public.claim_lost_lead(p_lead_id uuid)
returns public.leads
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_lead public.leads;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user and coalesce(is_active, true)
  ) then
    raise exception 'Active employee account required';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
    and status = 'lost'
    and assigned_to is null
  for update;

  if not found then
    raise exception 'This lost lead is no longer available in the Lost Pool';
  end if;

  update public.leads
  set assigned_to = v_user,
      status = 'contacted',
      updated_at = now()
  where id = p_lead_id;

  insert into public.lead_assignees(
    lead_id, user_id, assigned_by, added_at, removed_at
  )
  values (p_lead_id, v_user, v_user, now(), null)
  on conflict (lead_id, user_id)
  do update set
    removed_at = null,
    assigned_by = excluded.assigned_by,
    added_at = excluded.added_at;

  insert into public.lead_activities(
    lead_id, type, content, meta, created_by
  )
  values (
    p_lead_id,
    'lead_assigned',
    'Lost lead claimed from Company Lost Pool and moved to Contacted',
    jsonb_build_object(
      'action', 'claim_lost_lead',
      'user_id', v_user,
      'from_status', 'lost',
      'to_status', 'contacted'
    ),
    v_user
  );

  select * into v_lead from public.leads where id = p_lead_id;
  return v_lead;
end;
$function$;