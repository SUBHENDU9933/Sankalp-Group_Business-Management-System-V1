-- Sankalp BMS Schedule Module V1
-- Applied to live Supabase on 2026-10-04. Keep this file as the source-controlled
-- schema record; the live database remains the runtime source of truth.

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  estimate_id uuid,
  estimate_source text,
  title text not null,
  meeting_type text not null default 'follow_up',
  mode text not null default 'digital',
  status text not null default 'scheduled',
  priority text not null default 'normal',
  start_at timestamptz not null,
  end_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  location_address text,
  location_lat numeric,
  location_lng numeric,
  meeting_link text,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  customer_email text,
  customer_notification_status text not null default 'not_required',
  customer_notification_sent_at timestamptz,
  feedback_tags text[] not null default '{}',
  feedback text,
  remarks text,
  outcome text,
  next_action text,
  next_action_date date,
  next_action_owner_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  google_calendar_event_id text,
  google_calendar_status text not null default 'not_synced',
  google_calendar_url text,
  drive_folder_id text,
  drive_folder_url text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint schedules_mode_check check (mode in ('physical','digital')),
  constraint schedules_status_check check (status in ('scheduled','confirmed','in_progress','completed','pending_confirmation','rescheduled','customer_cancelled','customer_no_show','team_cancelled')),
  constraint schedules_priority_check check (priority in ('low','normal','high','urgent')),
  constraint schedules_meeting_type_check check (meeting_type in ('site_visit','customer_home','office_meeting','measurement_visit','project_review','material_discussion','video_meeting','design_presentation','estimate_discussion','phone_discussion','whatsapp_discussion','follow_up','other')),
  constraint schedules_notification_status_check check (customer_notification_status in ('not_required','pending','sent','failed')),
  constraint schedules_google_status_check check (google_calendar_status in ('not_synced','pending','synced','failed','cancelled')),
  constraint schedules_estimate_source_check check (estimate_source is null or estimate_source in ('estimates','estimates_v2')),
  constraint schedules_time_check check (end_at is null or end_at > start_at),
  constraint schedules_location_check check (mode <> 'physical' or location_address is not null or (location_lat is not null and location_lng is not null))
);

create table if not exists public.schedule_participants (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null default 'participant',
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  constraint schedule_participants_role_check check (participant_role in ('owner','participant','support')),
  constraint schedule_participants_unique unique (schedule_id,user_id)
);

create table if not exists public.schedule_files (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size bigint,
  source text not null default 'employee',
  category text not null default 'other',
  storage_provider text not null default 'supabase',
  storage_path text,
  file_url text,
  drive_file_id text,
  drive_url text,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint schedule_files_source_check check (source in ('field_visit','customer','employee','office','other')),
  constraint schedule_files_category_check check (category in ('site_photo','floor_plan','measurement','requirement','document','design_reference','estimate_reference','site_video','other')),
  constraint schedule_files_storage_check check (storage_provider in ('supabase','google_drive'))
);

create index if not exists idx_schedules_start_at on public.schedules(start_at);
create index if not exists idx_schedules_lead_id on public.schedules(lead_id);
create index if not exists idx_schedules_owner_id on public.schedules(owner_id);
create index if not exists idx_schedules_status on public.schedules(status);
create index if not exists idx_schedules_next_action_date on public.schedules(next_action_date);
create index if not exists idx_schedule_participants_schedule_id on public.schedule_participants(schedule_id);
create index if not exists idx_schedule_participants_user_id on public.schedule_participants(user_id);
create index if not exists idx_schedule_files_schedule_id on public.schedule_files(schedule_id);
create index if not exists idx_schedule_files_lead_id on public.schedule_files(lead_id);

alter table public.schedules enable row level security;
alter table public.schedule_participants enable row level security;
alter table public.schedule_files enable row level security;

grant select,insert,update,delete on public.schedules to authenticated;
grant select,insert,update,delete on public.schedule_participants to authenticated;
grant select,insert,update,delete on public.schedule_files to authenticated;

drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules for select to authenticated using (
  is_admin() or created_by=auth.uid() or owner_id=auth.uid() or next_action_owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
  or exists(select 1 from public.schedule_participants sp where sp.schedule_id=schedules.id and sp.user_id=auth.uid())
);

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules for insert to authenticated with check (
  created_by=auth.uid() and (
    is_admin() or owner_id=auth.uid()
    or (lead_id is not null and private.can_access_lead(lead_id))
    or (customer_id is not null and private.can_access_customer(customer_id))
    or (project_id is not null and private.can_access_project(project_id))
  )
);

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules for update to authenticated
using (
  is_admin() or created_by=auth.uid() or owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
  or exists(select 1 from public.schedule_participants sp where sp.schedule_id=schedules.id and sp.user_id=auth.uid())
)
with check (
  is_admin() or created_by=auth.uid() or owner_id=auth.uid()
  or (lead_id is not null and private.can_access_lead(lead_id))
  or (customer_id is not null and private.can_access_customer(customer_id))
  or (project_id is not null and private.can_access_project(project_id))
);

drop policy if exists schedules_delete on public.schedules;
create policy schedules_delete on public.schedules for delete to authenticated using (is_admin() or created_by=auth.uid());

drop policy if exists schedule_participants_select on public.schedule_participants;
create policy schedule_participants_select on public.schedule_participants for select to authenticated using (exists(select 1 from public.schedules s where s.id=schedule_participants.schedule_id));
drop policy if exists schedule_participants_insert on public.schedule_participants;
create policy schedule_participants_insert on public.schedule_participants for insert to authenticated with check (added_by=auth.uid() and exists(select 1 from public.schedules s where s.id=schedule_participants.schedule_id));
drop policy if exists schedule_participants_update on public.schedule_participants;
create policy schedule_participants_update on public.schedule_participants for update to authenticated using (exists(select 1 from public.schedules s where s.id=schedule_participants.schedule_id)) with check (exists(select 1 from public.schedules s where s.id=schedule_participants.schedule_id));
drop policy if exists schedule_participants_delete on public.schedule_participants;
create policy schedule_participants_delete on public.schedule_participants for delete to authenticated using (is_admin() or added_by=auth.uid() or exists(select 1 from public.schedules s where s.id=schedule_participants.schedule_id and (s.owner_id=auth.uid() or s.created_by=auth.uid())));

drop policy if exists schedule_files_select on public.schedule_files;
create policy schedule_files_select on public.schedule_files for select to authenticated using (exists(select 1 from public.schedules s where s.id=schedule_files.schedule_id));
drop policy if exists schedule_files_insert on public.schedule_files;
create policy schedule_files_insert on public.schedule_files for insert to authenticated with check (uploaded_by=auth.uid() and exists(select 1 from public.schedules s where s.id=schedule_files.schedule_id));
drop policy if exists schedule_files_update on public.schedule_files;
create policy schedule_files_update on public.schedule_files for update to authenticated using (is_admin() or uploaded_by=auth.uid()) with check (is_admin() or uploaded_by=auth.uid());
drop policy if exists schedule_files_delete on public.schedule_files;
create policy schedule_files_delete on public.schedule_files for delete to authenticated using (is_admin() or uploaded_by=auth.uid());

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at before update on public.schedules for each row execute function public.set_updated_at();
