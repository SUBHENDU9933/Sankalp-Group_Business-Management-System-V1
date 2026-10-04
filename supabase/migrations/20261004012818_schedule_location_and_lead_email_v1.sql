alter table public.leads
  add column if not exists email text;

alter table public.schedules
  add column if not exists location_map_url text,
  add column if not exists location_landmark text;
