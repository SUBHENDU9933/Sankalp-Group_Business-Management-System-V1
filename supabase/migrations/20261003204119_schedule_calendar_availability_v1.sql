-- Schedule calendar availability + meeting rules
-- Applied remotely as migration 20261003204119_schedule_calendar_availability_v1

alter table public.schedule_participants
  add column if not exists is_required boolean not null default true;

create table if not exists public.schedule_calendar_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  calendar_email text not null,
  calendar_id text not null,
  provider text not null default 'google',
  enabled boolean not null default true,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_calendar_mappings_provider_check check (provider in ('google')),
  constraint schedule_calendar_mappings_unique unique (provider, calendar_id, user_id)
);

create table if not exists public.schedule_meeting_rules (
  id uuid primary key default gen_random_uuid(),
  meeting_type text not null,
  mode text not null,
  participant_rule jsonb not null default '{"owner":true,"manager":"none","director":false}'::jsonb,
  default_duration_minutes integer not null default 30,
  travel_buffer_minutes integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_meeting_rules_unique unique (meeting_type, mode),
  constraint schedule_meeting_rules_mode_check check (mode in ('physical','digital'))
);

create index if not exists idx_schedule_calendar_mappings_user_id on public.schedule_calendar_mappings(user_id);
create index if not exists idx_schedule_calendar_mappings_calendar_id on public.schedule_calendar_mappings(calendar_id);
create index if not exists idx_schedule_meeting_rules_type_mode on public.schedule_meeting_rules(meeting_type, mode);

alter table public.schedule_calendar_mappings enable row level security;
alter table public.schedule_meeting_rules enable row level security;

grant select,insert,update,delete on public.schedule_calendar_mappings to authenticated;
grant select on public.schedule_meeting_rules to authenticated;

drop policy if exists schedule_calendar_mappings_select on public.schedule_calendar_mappings;
create policy schedule_calendar_mappings_select on public.schedule_calendar_mappings for select to authenticated using (is_admin() or user_id=auth.uid());

drop policy if exists schedule_calendar_mappings_admin_write on public.schedule_calendar_mappings;
create policy schedule_calendar_mappings_admin_write on public.schedule_calendar_mappings for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists schedule_meeting_rules_select on public.schedule_meeting_rules;
create policy schedule_meeting_rules_select on public.schedule_meeting_rules for select to authenticated using (true);

insert into public.schedule_meeting_rules (meeting_type, mode, participant_rule, default_duration_minutes, travel_buffer_minutes)
values
('site_visit','physical','{"owner":true,"manager":"any","director":false}',60,30),
('customer_home','physical','{"owner":true,"manager":"any","director":false}',60,30),
('office_meeting','physical','{"owner":true,"manager":"any","director":false}',45,0),
('measurement_visit','physical','{"owner":true,"manager":"any","director":false}',90,30),
('project_review','physical','{"owner":true,"manager":"any","director":false}',60,15),
('material_discussion','physical','{"owner":true,"manager":"any","director":false}',45,0),
('video_meeting','digital','{"owner":true,"manager":"any","director":true}',30,0),
('design_presentation','digital','{"owner":true,"manager":"any","director":true}',60,0),
('estimate_discussion','digital','{"owner":true,"manager":"any","director":true}',45,0),
('phone_discussion','digital','{"owner":true,"manager":"none","director":false}',20,0),
('whatsapp_discussion','digital','{"owner":true,"manager":"none","director":false}',15,0),
('follow_up','digital','{"owner":true,"manager":"none","director":false}',30,0),
('other','digital','{"owner":true,"manager":"optional","director":false}',30,0)
on conflict (meeting_type, mode) do update set
participant_rule=excluded.participant_rule,
default_duration_minutes=excluded.default_duration_minutes,
travel_buffer_minutes=excluded.travel_buffer_minutes,
updated_at=now();