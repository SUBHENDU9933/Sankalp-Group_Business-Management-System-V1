-- Schedule calendar consistency: BMS lifecycle changes become calendar-sync work.
create or replace function public.mark_schedule_calendar_dirty()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.google_calendar_event_id is null and new.google_calendar_event_id is not null then
    return new;
  end if;
  if new.google_calendar_event_id is null then
    return new;
  end if;
  new.google_calendar_status := 'pending';
  return new;
end;
$$;

drop trigger if exists trg_schedule_calendar_dirty on public.schedules;
create trigger trg_schedule_calendar_dirty
before update of title, description, meeting_type, mode, start_at, end_at, timezone,
  location_address, location_map_url, location_landmark, meeting_link,
  owner_id, arranged_by, status, deleted_at
on public.schedules
for each row
when (
  old.title is distinct from new.title
  or old.description is distinct from new.description
  or old.meeting_type is distinct from new.meeting_type
  or old.mode is distinct from new.mode
  or old.start_at is distinct from new.start_at
  or old.end_at is distinct from new.end_at
  or old.timezone is distinct from new.timezone
  or old.location_address is distinct from new.location_address
  or old.location_map_url is distinct from new.location_map_url
  or old.location_landmark is distinct from new.location_landmark
  or old.meeting_link is distinct from new.meeting_link
  or old.owner_id is distinct from new.owner_id
  or old.arranged_by is distinct from new.arranged_by
  or old.status is distinct from new.status
  or old.deleted_at is distinct from new.deleted_at
)
execute function public.mark_schedule_calendar_dirty();

create or replace function public.mark_schedule_participants_calendar_dirty()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_schedule_id uuid;
begin
  if tg_op = 'DELETE' then
    v_schedule_id := old.schedule_id;
  else
    v_schedule_id := new.schedule_id;
  end if;

  update public.schedules
     set google_calendar_status = 'pending',
         updated_at = now()
   where id = v_schedule_id
     and google_calendar_event_id is not null
     and deleted_at is null;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_participants_calendar_dirty on public.schedule_participants;
create trigger trg_schedule_participants_calendar_dirty
after insert or update or delete on public.schedule_participants
for each row
execute function public.mark_schedule_participants_calendar_dirty();

create index if not exists idx_schedules_calendar_pending
on public.schedules (google_calendar_status, updated_at)
where google_calendar_status = 'pending';

alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.schedule_participants;
