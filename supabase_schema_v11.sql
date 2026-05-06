-- =====================================================================
-- SANKALP GROUP — Schema v11 (Website Lead Sync)
-- Apply to BM App Supabase (Project B) AFTER v1..v10.
--
-- Adds ONLY a nullable `tag` column to `leads` to support:
--   • "Website Direct Enquiry" (fresh lead from your website)
--   • "Website · Repeat" (second/third enquiry from same phone)
--
-- ZERO changes to existing rows, tables, triggers, or RLS.
-- Fully reversible — drop column if you ever want to remove it.
-- =====================================================================

alter table public.leads add column if not exists tag text;
create index if not exists idx_leads_tag on public.leads(tag) where tag is not null;

notify pgrst, 'reload schema';
