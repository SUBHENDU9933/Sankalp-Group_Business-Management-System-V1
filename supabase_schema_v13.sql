-- =====================================================================
-- SANKALP GROUP — Schema v13 (Estimate Presets Auto-Backup)
-- Apply to BM App Supabase (Project B) AFTER v1..v12.
--
-- Adds a snapshot table so every Save in Estimate Settings auto-creates
-- a full backup of the previous state. One-click restore from UI.
--
-- ZERO impact on existing rows. Reversible (drop table).
-- =====================================================================

create table if not exists public.estimate_presets_backups (
  id           uuid primary key default gen_random_uuid(),
  snapshot     jsonb not null,
  rooms_count  int  not null default 0,
  items_count  int  not null default 0,
  terms_count  int  not null default 0,
  notes_count  int  not null default 0,
  guides_count int  not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  reason       text   -- e.g. "auto-before-save", "manual"
);

create index if not exists idx_presets_backups_created_at
  on public.estimate_presets_backups(created_at desc);

alter table public.estimate_presets_backups enable row level security;

-- Admin-only read & write (matches existing presets RLS pattern)
drop policy if exists presets_backups_select on public.estimate_presets_backups;
create policy presets_backups_select on public.estimate_presets_backups
  for select to authenticated using (public.is_admin());

drop policy if exists presets_backups_insert on public.estimate_presets_backups;
create policy presets_backups_insert on public.estimate_presets_backups
  for insert to authenticated with check (public.is_admin());

drop policy if exists presets_backups_delete on public.estimate_presets_backups;
create policy presets_backups_delete on public.estimate_presets_backups
  for delete to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
