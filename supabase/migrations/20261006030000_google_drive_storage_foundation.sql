-- Google Drive storage foundation + Schedule file metadata.
create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  google_user_id text,
  google_email text not null,
  root_folder_id text,
  access_token_encrypted text,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  scope text,
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  last_error text,
  last_synced_at timestamptz,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_google_drive_connections_singleton
  on public.google_drive_connections ((true));

alter table public.google_drive_connections enable row level security;

drop policy if exists google_drive_connections_admin_select on public.google_drive_connections;
create policy google_drive_connections_admin_select
on public.google_drive_connections for select to authenticated
using (is_admin());

drop policy if exists google_drive_connections_admin_insert on public.google_drive_connections;
create policy google_drive_connections_admin_insert
on public.google_drive_connections for insert to authenticated
with check (is_admin());

drop policy if exists google_drive_connections_admin_update on public.google_drive_connections;
create policy google_drive_connections_admin_update
on public.google_drive_connections for update to authenticated
using (is_admin()) with check (is_admin());

drop policy if exists google_drive_connections_admin_delete on public.google_drive_connections;
create policy google_drive_connections_admin_delete
on public.google_drive_connections for delete to authenticated
using (is_admin());

create table if not exists public.google_drive_storage_objects (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  record_id uuid,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  drive_file_id text not null,
  drive_url text,
  drive_parent_id text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_google_drive_objects_module_record
  on public.google_drive_storage_objects(module, record_id);
create index if not exists idx_google_drive_objects_drive_file
  on public.google_drive_storage_objects(drive_file_id);

alter table public.google_drive_storage_objects enable row level security;

alter table public.schedule_files
  add column if not exists drive_url text,
  add column if not exists drive_parent_id text;

update public.schedule_files
set storage_provider='google_drive'
where drive_file_id is not null and coalesce(storage_provider,'supabase') <> 'google_drive';

comment on table public.google_drive_connections is 'Admin-managed Google Drive connection used as the BMS primary file storage.';
comment on table public.google_drive_storage_objects is 'Central metadata index for files stored in Google Drive by BMS modules.';
