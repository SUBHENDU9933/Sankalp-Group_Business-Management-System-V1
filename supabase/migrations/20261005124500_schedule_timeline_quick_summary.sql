-- Make schedule lifecycle timeline entries concise and outcome/reason driven.
create or replace function public.log_schedule_to_lead_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_type text;
  v_content text;
  v_meta jsonb;
  v_reason text;
  v_outcome text;
begin
  v_user_id := coalesce(new.updated_by, auth.uid(), new.created_by);

  if tg_op = 'INSERT' then
    if new.lead_id is not null then
      insert into public.lead_activities(lead_id, type, content, created_by, meta)
      values (new.lead_id, 'schedule_created', format('Schedule created: %s', new.title), v_user_id,
              jsonb_build_object('schedule_id', new.id, 'meeting_type', new.meeting_type, 'mode', new.mode, 'start_at', new.start_at, 'status', new.status));
    end if;
    return new;
  end if;

  if new.lead_id is null then return new; end if;

  if old.lead_id is distinct from new.lead_id then
    if old.lead_id is not null then
      insert into public.lead_activities(lead_id, type, content, created_by, meta)
      values (old.lead_id, 'schedule_updated', format('Schedule moved to another lead: %s', new.title), v_user_id,
              jsonb_build_object('schedule_id', new.id, 'old_lead_id', old.lead_id, 'new_lead_id', new.lead_id));
    end if;
    insert into public.lead_activities(lead_id, type, content, created_by, meta)
    values (new.lead_id, 'schedule_created', format('Schedule linked: %s', new.title), v_user_id,
            jsonb_build_object('schedule_id', new.id, 'meeting_type', new.meeting_type, 'mode', new.mode));
    return new;
  end if;

  if old.start_at is distinct from new.start_at or old.end_at is distinct from new.end_at then
    v_type := 'schedule_rescheduled';
    v_reason := coalesce(nullif(new.reschedule_reason_code,''), nullif(new.reschedule_reason,''));
    v_content := format('Meeting Rescheduled%s', case when v_reason is not null then format(' · %s', replace(v_reason, '_', ' ')) else '' end);
  elsif old.status is distinct from new.status and new.status = 'completed' then
    v_type := 'schedule_status_changed';
    v_outcome := coalesce(nullif(new.outcome_type,''), nullif(new.outcome,''));
    v_content := format('Meeting Completed%s', case when v_outcome is not null then format(' · %s', replace(v_outcome, '_', ' ')) else '' end);
  elsif old.status is distinct from new.status and new.status in ('customer_cancelled','team_cancelled') then
    v_type := 'schedule_status_changed';
    v_reason := coalesce(nullif(new.cancellation_reason_code,''), nullif(new.cancellation_reason,''));
    v_content := format('Meeting Cancelled%s', case when v_reason is not null then format(' · %s', replace(v_reason, '_', ' ')) else '' end);
  elsif old.status is distinct from new.status and new.status = 'customer_no_show' then
    v_type := 'schedule_status_changed';
    v_reason := coalesce(nullif(new.no_show_reason_code,''), nullif(new.no_show_reason,''));
    v_content := format('Customer No-Show%s', case when v_reason is not null then format(' · %s', replace(v_reason, '_', ' ')) else '' end);
  elsif old.status is distinct from new.status then
    v_type := 'schedule_status_changed';
    v_content := format('Meeting status changed to %s: %s', replace(new.status, '_', ' '), new.title);
  elsif old.feedback_tags is distinct from new.feedback_tags
     or old.feedback is distinct from new.feedback
     or old.remarks is distinct from new.remarks
     or old.outcome is distinct from new.outcome then
    v_type := 'schedule_feedback_updated';
    v_content := format('Meeting feedback/outcome updated: %s', new.title);
  elsif old.next_action is distinct from new.next_action
     or old.next_action_date is distinct from new.next_action_date
     or old.next_action_owner_id is distinct from new.next_action_owner_id then
    v_type := 'schedule_followup_updated';
    v_content := format('Meeting next action updated: %s', new.title);
  elsif old.title is distinct from new.title
     or old.meeting_type is distinct from new.meeting_type
     or old.mode is distinct from new.mode
     or old.owner_id is distinct from new.owner_id
     or old.priority is distinct from new.priority
     or old.location_address is distinct from new.location_address
     or old.meeting_link is distinct from new.meeting_link
     or old.description is distinct from new.description then
    v_type := 'schedule_updated';
    v_content := format('Meeting updated: %s', new.title);
  else
    return new;
  end if;

  v_meta := jsonb_build_object(
    'schedule_id', new.id, 'meeting_type', new.meeting_type, 'mode', new.mode,
    'status', new.status, 'start_at', new.start_at, 'end_at', new.end_at,
    'feedback_tags', coalesce(new.feedback_tags, '{}'::text[]),
    'next_action', new.next_action, 'next_action_date', new.next_action_date,
    'outcome', new.outcome, 'outcome_type', new.outcome_type,
    'lead_stage_after', new.lead_stage_after,
    'reschedule_reason_code', new.reschedule_reason_code,
    'cancellation_reason_code', new.cancellation_reason_code,
    'no_show_reason_code', new.no_show_reason_code
  );

  insert into public.lead_activities(lead_id, type, content, created_by, meta)
  values (new.lead_id, v_type, v_content, v_user_id, v_meta);

  return new;
end;
$function$;
