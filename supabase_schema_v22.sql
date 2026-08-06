-- ============================================================
-- SANKALP BMS — Schema v22: Automated Daily Reminder Schedule
--
-- Per-person reminders throughout the work day (own pending leads /
-- approvals / agreements only), alternating chime-worthy digests with
-- silent gaps, ending in a full end-of-day report that also carries
-- pending items forward as "tomorrow's list". Admin additionally gets
-- a team-wide rollup at the 10pm report.
--
-- Free — uses pg_cron, which ships enabled on every Supabase plan
-- including Free. No external services, no paid APIs.
--
-- Schedule (IST) -> stored as UTC cron times (IST = UTC+5:30):
--   10:30 AM  -> 05:00 UTC   morning digest
--   11:00 AM  -> 05:30 UTC   nudge
--   (1pm/4pm/6pm/9pm are deliberately silent — no job, badge-only)
--   02:30 PM  -> 09:00 UTC   nudge
--   05:00 PM  -> 11:30 UTC   nudge
--   08:00 PM  -> 14:30 UTC   nudge
--   10:00 PM  -> 16:30 UTC   full daily report + tomorrow's carry-forward
-- ============================================================

create extension if not exists pg_cron with schema extensions;

create or replace function public.run_reminder_slot(p_slot text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  v_pending_leads int;
  v_pending_approvals int;
  v_pending_agreements int;
  v_touched_today int;
  v_total int;
  v_is_report boolean := (p_slot = '10pm_report');
  v_notif_type text := case when v_is_report then 'daily_report' else 'reminder_chime' end;
  -- team-wide (admin rollup) accumulators
  t_pending_leads int;
  t_pending_approvals int;
  t_pending_agreements int;
  t_touched_today int;
  t_new_leads_today int;
  t_converted_today int;
begin
  for u in select id, full_name from public.profiles loop
    select count(*) into v_pending_leads
      from public.leads
      where assigned_to = u.id and deleted_at is null
        and status not in ('converted','lost')
        and next_followup_date is not null and next_followup_date <= current_date;

    select count(*) into v_pending_approvals
      from public.digital_approvals
      where created_by = u.id and deleted_at is null and status = 'pending';

    select count(*) into v_pending_agreements
      from public.agreements
      where created_by = u.id and deleted_at is null and status in ('draft','sent');

    v_total := v_pending_leads + v_pending_approvals + v_pending_agreements;

    if v_is_report then
      select count(*) into v_touched_today
        from public.lead_activities
        where created_by = u.id and created_at >= current_date;

      -- Always send the end-of-day report (even at zero, so people get a
      -- clean "all caught up" close to the day) — but skip if truly nothing
      -- ever happened and nothing pending, to avoid empty noise for inactive accounts.
      if v_total > 0 or v_touched_today > 0 then
        insert into public.notifications (user_id, type, title, body, link)
        values (
          u.id, v_notif_type, 'Today''s Summary',
          format('Today: %s lead update(s) logged. Still pending → %s lead(s), %s approval(s), %s agreement(s). Carried forward to tomorrow.',
                 v_touched_today, v_pending_leads, v_pending_approvals, v_pending_agreements),
          '/leads'
        );
      end if;
    else
      if v_total > 0 then
        insert into public.notifications (user_id, type, title, body, link)
        values (
          u.id, v_notif_type, 'Pending Reminder',
          format('You have %s lead(s), %s approval(s), %s agreement(s) still pending.',
                 v_pending_leads, v_pending_approvals, v_pending_agreements),
          '/leads'
        );
      end if;
    end if;
  end loop;

  -- Admin team-wide rollup, report slot only
  if v_is_report then
    select
      count(*) filter (where status not in ('converted','lost') and next_followup_date is not null and next_followup_date <= current_date)
    into t_pending_leads
    from public.leads where deleted_at is null;

    select count(*) into t_pending_approvals from public.digital_approvals where deleted_at is null and status = 'pending';
    select count(*) into t_pending_agreements from public.agreements where deleted_at is null and status in ('draft','sent');
    select count(*) into t_touched_today from public.lead_activities where created_at >= current_date;
    select count(*) into t_new_leads_today from public.leads where created_at >= current_date and deleted_at is null;
    select count(*) into t_converted_today from public.leads where status = 'converted' and updated_at >= current_date and deleted_at is null;

    insert into public.notifications (user_id, type, title, body, link)
    select id, 'daily_report', 'Team Daily Report',
      format('Team today: %s new lead(s), %s converted, %s activity log(s). Team-wide pending → %s lead(s), %s approval(s), %s agreement(s).',
             t_new_leads_today, t_converted_today, t_touched_today, t_pending_leads, t_pending_approvals, t_pending_agreements),
      '/leads'
    from public.profiles where role = 'admin';
  end if;
end;
$$;

-- Schedule the 6 jobs (idempotent: unschedule first if re-running this file)
select cron.unschedule(jobid) from cron.job where jobname like 'sankalp_reminder_%';

select cron.schedule('sankalp_reminder_1030am', '0 5 * * *',  $$select public.run_reminder_slot('1030am')$$);
select cron.schedule('sankalp_reminder_11am',   '30 5 * * *', $$select public.run_reminder_slot('11am')$$);
select cron.schedule('sankalp_reminder_230pm',  '0 9 * * *',  $$select public.run_reminder_slot('230pm')$$);
select cron.schedule('sankalp_reminder_5pm',    '30 11 * * *',$$select public.run_reminder_slot('5pm')$$);
select cron.schedule('sankalp_reminder_8pm',    '30 14 * * *',$$select public.run_reminder_slot('8pm')$$);
select cron.schedule('sankalp_reminder_10pm',   '30 16 * * *',$$select public.run_reminder_slot('10pm_report')$$);
