-- Centralize Lead lifecycle events in the Lead Timeline.
create or replace function public.log_lead_timeline_event()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_user_id uuid; v_type text; v_content text; v_meta jsonb;
begin
 v_user_id:=coalesce(auth.uid(),new.created_by);
 if tg_op='INSERT' then
  insert into public.lead_activities(lead_id,type,content,created_by,meta) values(new.id,'lead_created',format('Lead created: %s',new.name),coalesce(new.created_by,v_user_id),jsonb_build_object('lead_id',new.id,'source',new.source,'project_type',new.project_type)); return new;
 end if;
 if old.status is distinct from new.status then v_type:='status_change'; v_content:=format('Status changed: %s → %s',replace(coalesce(old.status::text,'new'),'_',' '),replace(coalesce(new.status::text,'new'),'_',' ')); v_meta:=jsonb_build_object('old_status',old.status,'new_status',new.status);
 elsif old.assigned_to is distinct from new.assigned_to then v_type:='lead_assigned'; v_content:=case when new.assigned_to is null then 'Primary assignee removed' when old.assigned_to is null then 'Lead assigned to a team member' else 'Lead reassigned to a different team member' end; v_meta:=jsonb_build_object('old_assigned_to',old.assigned_to,'new_assigned_to',new.assigned_to);
 elsif old.next_followup_date is distinct from new.next_followup_date or old.reminder_note is distinct from new.reminder_note then v_type:='followup'; v_content:=case when new.next_followup_date is null then 'Follow-up removed' else format('Follow-up updated for %s',new.next_followup_date) end; v_meta:=jsonb_build_object('next_followup_date',new.next_followup_date,'reminder_note',new.reminder_note);
 elsif old.name is distinct from new.name or old.phone is distinct from new.phone or old.phone_secondary is distinct from new.phone_secondary or old.location is distinct from new.location or old.area is distinct from new.area or old.pincode is distinct from new.pincode or old.project_type is distinct from new.project_type or old.property_type is distinct from new.property_type or old.area_sqft is distinct from new.area_sqft or old.budget is distinct from new.budget or old.requirement is distinct from new.requirement or old.source is distinct from new.source or old.priority is distinct from new.priority or old.tag is distinct from new.tag then v_type:='lead_updated'; v_content:='Lead details updated'; v_meta:=jsonb_build_object('lead_id',new.id);
 else return new; end if;
 insert into public.lead_activities(lead_id,type,content,created_by,meta) values(new.id,v_type,v_content,v_user_id,v_meta); return new;
end; $function$;
drop trigger if exists trg_leads_timeline on public.leads;
create trigger trg_leads_timeline after insert or update on public.leads for each row execute function public.log_lead_timeline_event();

create or replace function public.log_lead_assignee_timeline_event()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
 if tg_op='INSERT' then insert into public.lead_activities(lead_id,type,content,created_by,meta) values(new.lead_id,'lead_assigned','Co-assignee added',coalesce(new.assigned_by,auth.uid()),jsonb_build_object('user_id',new.user_id,'assigned_by',new.assigned_by,'assignment_type','co_assignee')); return new;
 elsif tg_op='DELETE' then insert into public.lead_activities(lead_id,type,content,created_by,meta) values(old.lead_id,'lead_assigned','Co-assignee removed',auth.uid(),jsonb_build_object('user_id',old.user_id,'assignment_type','co_assignee','action','removed')); return old; end if;
 return new;
end; $function$;
drop trigger if exists trg_lead_assignees_timeline on public.lead_assignees;
create trigger trg_lead_assignees_timeline after insert or delete on public.lead_assignees for each row execute function public.log_lead_assignee_timeline_event();
