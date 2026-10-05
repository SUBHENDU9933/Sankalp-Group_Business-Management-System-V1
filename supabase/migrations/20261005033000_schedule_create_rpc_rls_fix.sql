-- Fix schedule creation RLS by performing the audited insert with the
-- authenticated user taken directly from auth.uid(). This keeps arranger
-- selection independent from the creator's profile mapping and inserts
-- participants atomically with the schedule.

create or replace function public.create_schedule_with_participants(
  p_payload jsonb,
  p_participant_ids uuid[] default '{}',
  p_required_participant_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
  v_created_by uuid := auth.uid();
  v_arranged_by uuid;
begin
  if v_created_by is null then
    raise exception 'Login session expired';
  end if;

  v_arranged_by := nullif(p_payload->>'arranged_by', '')::uuid;

  if v_arranged_by is not null
     and not exists (
       select 1
       from public.profiles p
       where p.id = v_arranged_by
         and p.is_active = true
     ) then
    raise exception 'Meeting arranger must be an active employee';
  end if;

  insert into public.schedules (
    lead_id, customer_id, project_id, estimate_id, estimate_source,
    title, meeting_type, mode, status, priority,
    start_at, end_at, timezone,
    location_address, location_lat, location_lng, location_map_url, location_landmark,
    meeting_link, description,
    owner_id, assigned_by, customer_email,
    arranged_by, created_by
  )
  values (
    nullif(p_payload->>'lead_id', '')::uuid,
    nullif(p_payload->>'customer_id', '')::uuid,
    nullif(p_payload->>'project_id', '')::uuid,
    nullif(p_payload->>'estimate_id', '')::uuid,
    nullif(p_payload->>'estimate_source', ''),
    p_payload->>'title',
    coalesce(nullif(p_payload->>'meeting_type', ''), 'follow_up'),
    coalesce(nullif(p_payload->>'mode', ''), 'digital'),
    coalesce(nullif(p_payload->>'status', ''), 'scheduled'),
    coalesce(nullif(p_payload->>'priority', ''), 'normal'),
    (p_payload->>'start_at')::timestamptz,
    nullif(p_payload->>'end_at', '')::timestamptz,
    coalesce(nullif(p_payload->>'timezone', ''), 'Asia/Kolkata'),
    nullif(p_payload->>'location_address', ''),
    nullif(p_payload->>'location_lat', '')::numeric,
    nullif(p_payload->>'location_lng', '')::numeric,
    nullif(p_payload->>'location_map_url', ''),
    nullif(p_payload->>'location_landmark', ''),
    nullif(p_payload->>'meeting_link', ''),
    nullif(p_payload->>'description', ''),
    null,
    v_created_by,
    nullif(p_payload->>'customer_email', ''),
    v_arranged_by,
    v_created_by
  )
  returning id into v_id;

  insert into public.schedule_participants (
    schedule_id, user_id, participant_role, is_required, added_by
  )
  select
    v_id,
    x.user_id,
    'participant',
    x.user_id = any(coalesce(p_required_participant_ids, '{}'::uuid[])),
    v_created_by
  from (
    select distinct unnest(coalesce(p_participant_ids, '{}'::uuid[])) as user_id
  ) x
  join public.profiles p on p.id = x.user_id
  where p.is_active = true;

  return v_id;
end;
$$;

revoke all on function public.create_schedule_with_participants(jsonb, uuid[], uuid[]) from public;
grant execute on function public.create_schedule_with_participants(jsonb, uuid[], uuid[]) to authenticated;
