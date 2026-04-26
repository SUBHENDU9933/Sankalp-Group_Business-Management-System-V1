-- =====================================================================
-- SANKALP GROUP — Schema v9.1 PATCH (Projects missing columns)
-- Apply to fix:
--   • "Could not find the 'end_date' column of 'projects' in the schema cache"
--   • "Could not find the 'location' column of 'projects' in the schema cache"
-- =====================================================================

alter table public.projects add column if not exists location text;
alter table public.projects add column if not exists end_date date;
alter table public.projects add column if not exists start_date date;

-- Reload PostgREST cache (Supabase needs this so the API sees new columns)
notify pgrst, 'reload schema';
