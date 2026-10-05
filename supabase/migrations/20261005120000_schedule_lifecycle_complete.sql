-- Complete Schedule lifecycle: reasons, history, safe state transitions and lead-stage handoff.
alter table public.schedules
  add column if not exists reschedule_reason_code text,
  add column if not exists reschedule_reason text,
  add column if not exists cancellation_reason_code text,
  add column if not exists cancellation_reason text,
  add column if not exists no_show_reason_code text,
  add column if not exists no_show_reason text,
  add column if not exists outcome_type text,
  add column if not exists lead_stage_after text,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create table if not exists public.schedule_history (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  action text not null,
  old_status text,
  new_status text,
  old_start_at timestamptz,
  old_end_at timestamptz,
  new_start_at timestamptz,
  new_end_at timestamptz,
  reason_code text,
  reason_text text,
  outcome_type text,
  lead_stage_after text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_schedule_history_schedule_created
  on public.schedule_history(schedule_id, created_at desc);

alter table public.schedule_history enable row level security;
drop policy if exists schedule_history_select on public.schedule_history;
create policy schedule_history_select on public.schedule_history
for select to authenticated
using (private.can_access_schedule(schedule_id));

create or replace function public.schedule_lifecycle_action(
  p_schedule_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns public.schedules
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_s public.schedules%rowtype;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_old_status text;
  v_old_start_at timestamptz;
  v_old_end_at timestamptz;
  v_new_status text;
  v_reason_code text := nullif(p_payload->>'reason_code','');
  v_reason_text text := nullif(p_payload->>'reason_text','');
  v_outcome text := nullif(p_payload->>'outcome_type','');
  v_stage text := nullif(p_payload->>'lead_stage_after','');
  v_notes text := nullif(p_payload->>'notes','');
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Login session expired'; end if;

  select * into v_s from public.schedules where id=p_schedule_id and deleted_at is null for update;
  if not found then raise exception 'Schedule not found'; end if;
  if not private.can_access_schedule(p_schedule_id) then raise exception 'You do not have access to this schedule'; end if;

  v_old_status := v_s.status;
  -- Keep the original slot before any lifecycle update for accurate audit history.
  v_old_start_at := v_s.start_at;
  v_old_end_at := v_s.end_at;

  if p_action = 'reschedule' then
    v_new_start := nullif(p_payload->>'start_at','')::timestamptz;
    v_new_end := nullif(p_payload->>'end_at','')::timestamptz;
    if v_new_start is null or v_new_end is null or v_new_end <= v_new_start then raise exception 'Valid new start and end time are required'; end if;
    if v_new_start <= now() then raise exception 'New schedule time must be in the future'; end if;

    perform pg_advisory_xact_lock(hashtextextended(p_schedule_id::text,0));
    if exists (
      select 1 from public.schedules x
      where x.id <> p_schedule_id and x.deleted_at is null
        and x.status in ('scheduled','confirmed','in_progress','pending_confirmation')
        and x.start_at < v_new_end and x.end_at > v_new_start
        and (
          x.arranged_by = v_s.arranged_by
          or x.owner_id = v_s.owner_id
          or exists (
            select 1 from public.schedule_participants sp1
            where sp1.schedule_id=p_schedule_id and sp1.is_required=true
              and exists (
                select 1 from public.schedule_participants sp2
                where sp2.schedule_id=x.id and sp2.is_required=true and sp2.user_id=sp1.user_id
              )
          )
        )
    ) then raise exception 'Selected employee already has another meeting in this time slot'; end if;

    update public.schedules
      set start_at=v_new_start,end_at=v_new_end,status='scheduled',
          reschedule_reason_code=v_reason_code,reschedule_reason=v_reason_text,
          updated_by=v_user,updated_at=now()
      where id=p_schedule_id
      returning * into v_s;

    insert into public.schedule_history(schedule_id,action,old_status,new_status,old_start_at,old_end_at,new_start_at,new_end_at,reason_code,reason_text,notes,created_by)
    values(p_schedule_id,'rescheduled',v_old_status,'scheduled',v_old_start_at,v_old_end_at,v_new_start,v_new_end,v_reason_code,v_reason_text,v_notes,v_user);

  elsif p_action = 'cancel' then
    v_new_status := case when lower(coalesce(v_reason_code,'')) like '%customer%' then 'customer_cancelled' else 'team_cancelled' end;
    update public.schedules set status=v_new_status,cancellation_reason_code=v_reason_code,cancellation_reason=v_reason_text,cancelled_at=now(),updated_by=v_user,updated_at=now() where id=p_schedule_id returning * into v_s;
    insert into public.schedule_history(schedule_id,action,old_status,new_status,reason_code,reason_text,notes,created_by)
    values(p_schedule_id,'cancelled',v_old_status,v_new_status,v_reason_code,v_reason_text,v_notes,v_user);

  elsif p_action = 'no_show' then
    update public.schedules set status='customer_no_show',no_show_reason_code=v_reason_code,no_show_reason=v_reason_text,updated_by=v_user,updated_at=now() where id=p_schedule_id returning * into v_s;
    insert into public.schedule_history(schedule_id,action,old_status,new_status,reason_code,reason_text,notes,created_by)
    values(p_schedule_id,'no_show',v_old_status,'customer_no_show',v_reason_code,v_reason_text,v_notes,v_user);

  elsif p_action = 'complete' then
    if v_outcome is null then raise exception 'Outcome is required before completing a meeting'; end if;
    if v_stage is null then raise exception 'Lead stage is required before completing a meeting'; end if;
    update public.schedules set status='completed',completed_at=now(),outcome_type=v_outcome,lead_stage_after=v_stage,feedback=coalesce(nullif(p_payload->>'feedback',''),feedback),remarks=coalesce(nullif(p_payload->>'remarks',''),remarks),next_action=coalesce(nullif(p_payload->>'next_action',''),next_action),next_action_date=coalesce(nullif(p_payload->>'next_action_date','')::date,next_action_date),next_action_owner_id=coalesce(nullif(p_payload->>'next_action_owner_id','')::uuid,next_action_owner_id),updated_by=v_user,updated_at=now() where id=p_schedule_id returning * into v_s;
    if v_s.lead_id is not null then
      update public.leads set status=v_stage where id=v_s.lead_id;
    end if;
    insert into public.schedule_history(schedule_id,action,old_status,new_status,outcome_type,lead_stage_after,notes,created_by)
    values(p_schedule_id,'completed',v_old_status,'completed',v_outcome,v_stage,v_notes,v_user);

  elsif p_action = 'delete' then
    if not public.is_admin() then raise exception 'Only an administrator can delete a meeting'; end if;
    update public.schedules set deleted_at=now(),deleted_by=v_user,updated_by=v_user,updated_at=now() where id=p_schedule_id returning * into v_s;
    insert into public.schedule_history(schedule_id,action,old_status,new_status,notes,created_by)
    values(p_schedule_id,'deleted',v_old_status,v_old_status,v_notes,v_user);

  else
    raise exception 'Unsupported lifecycle action: %', p_action;
  end if;

  return v_s;
end;
$$;

revoke all on function public.schedule_lifecycle_action(uuid,text,jsonb) from public;
grant execute on function public.schedule_lifecycle_action(uuid,text,jsonb) to authenticated;
