-- Meeting file uploads appear in the linked Lead Timeline. Applied to production 2026-10-04.
create or replace function public.log_schedule_file_to_lead_timeline()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
 if new.lead_id is not null then insert into public.lead_activities(lead_id,type,content,created_by,meta) values(new.lead_id,'schedule_file_added',format('Meeting file added: %s',new.file_name),new.uploaded_by,jsonb_build_object('schedule_id',new.schedule_id,'schedule_file_id',new.id,'file_name',new.file_name,'source',new.source,'category',new.category)); end if; return new;
end; $function$;
drop trigger if exists trg_schedule_files_lead_timeline on public.schedule_files;
create trigger trg_schedule_files_lead_timeline after insert on public.schedule_files for each row execute function public.log_schedule_file_to_lead_timeline();
