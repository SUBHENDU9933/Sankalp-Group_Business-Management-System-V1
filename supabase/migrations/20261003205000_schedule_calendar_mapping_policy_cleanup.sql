-- Clean up schedule calendar mapping RLS policies
-- Applied remotely as schedule_calendar_mapping_policy_cleanup

drop policy if exists schedule_calendar_mappings_admin_write on public.schedule_calendar_mappings;
create policy schedule_calendar_mappings_admin_insert on public.schedule_calendar_mappings for insert to authenticated with check (is_admin());
create policy schedule_calendar_mappings_admin_update on public.schedule_calendar_mappings for update to authenticated using (is_admin()) with check (is_admin());
create policy schedule_calendar_mappings_admin_delete on public.schedule_calendar_mappings for delete to authenticated using (is_admin());