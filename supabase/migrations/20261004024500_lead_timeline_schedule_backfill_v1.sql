-- Safe historical backfill for Schedule -> Lead Timeline events.
insert into public.lead_activities(lead_id,type,content,created_by,meta)
select s.lead_id,'schedule_created',format('Schedule created: %s',s.title),s.created_by,jsonb_build_object('schedule_id',s.id,'meeting_type',s.meeting_type,'mode',s.mode,'start_at',s.start_at,'status',s.status,'backfill',true)
from public.schedules s where s.deleted_at is null and s.lead_id is not null and not exists(select 1 from public.lead_activities a where a.lead_id=s.lead_id and a.type='schedule_created' and a.meta->>'schedule_id'=s.id::text);

insert into public.lead_activities(lead_id,type,content,created_by,meta)
select f.lead_id,'schedule_file_added',format('Meeting file added: %s',f.file_name),f.uploaded_by,jsonb_build_object('schedule_id',f.schedule_id,'schedule_file_id',f.id,'file_name',f.file_name,'source',f.source,'category',f.category,'backfill',true)
from public.schedule_files f where f.deleted_at is null and f.lead_id is not null and not exists(select 1 from public.lead_activities a where a.lead_id=f.lead_id and a.type='schedule_file_added' and a.meta->>'schedule_file_id'=f.id::text);
