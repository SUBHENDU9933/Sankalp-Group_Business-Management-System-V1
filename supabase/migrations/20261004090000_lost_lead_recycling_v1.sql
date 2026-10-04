-- Lost Lead Recycling Pool v1
begin;

alter table public.leads
  add column if not exists lost_by uuid references public.profiles(id),
  add column if not exists lost_at timestamptz,
  add column if not exists lost_previous_assigned_to uuid references public.profiles(id);

alter table public.lead_assignees add column if not exists removed_at timestamptz;

create index if not exists idx_leads_lost_pool on public.leads(status, assigned_to) where status='lost';
create index if not exists idx_lead_assignees_active on public.lead_assignees(lead_id,user_id) where removed_at is null;

create or replace function private.can_view_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and coalesce(is_active,true))
    or exists(select 1 from public.leads l where l.id=p_lead_id and (l.created_by=(select auth.uid()) or l.assigned_to=(select auth.uid())))
    or exists(select 1 from public.lead_assignees la where la.lead_id=p_lead_id and la.user_id=(select auth.uid()) and la.removed_at is null)
    or exists(select 1 from public.leads l join public.profiles me on me.id=(select auth.uid()) where l.id=p_lead_id and lower(coalesce(me.role::text,'')) in ('rm','manager') and l.assigned_to is not null and private.can_manage_re(l.assigned_to))
    or exists(select 1 from public.lead_assignees la join public.profiles me on me.id=(select auth.uid()) where la.lead_id=p_lead_id and la.removed_at is null and lower(coalesce(me.role::text,'')) in ('rm','manager') and private.can_manage_re(la.user_id))
    or exists(select 1 from public.leads l join public.profiles me on me.id=(select auth.uid()) where l.id=p_lead_id and lower(coalesce(me.role::text,'')) in ('rm','manager') and l.assigned_to is null and l.created_by is null)
    or exists(select 1 from public.leads l join public.profiles me on me.id=(select auth.uid()) where l.id=p_lead_id and l.status='lost' and l.assigned_to is null and coalesce(me.is_active,true))
  );
$$;

create or replace function private.can_access_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
    or exists(select 1 from public.leads l where l.id=p_lead_id and (l.created_by=(select auth.uid()) or l.assigned_to=(select auth.uid())))
    or exists(select 1 from public.lead_assignees la where la.lead_id=p_lead_id and la.user_id=(select auth.uid()) and la.removed_at is null)
    or exists(select 1 from public.leads l join public.profiles me on me.id=(select auth.uid()) where l.id=p_lead_id and lower(coalesce(me.role::text,'')) in ('rm','manager') and l.assigned_to is not null and private.can_manage_re(l.assigned_to))
    or exists(select 1 from public.lead_assignees la join public.profiles me on me.id=(select auth.uid()) where la.lead_id=p_lead_id and la.removed_at is null and lower(coalesce(me.role::text,'')) in ('rm','manager') and private.can_manage_re(la.user_id))
    or exists(select 1 from public.leads l join public.profiles me on me.id=(select auth.uid()) where l.id=p_lead_id and lower(coalesce(me.role::text,'')) in ('rm','manager') and l.assigned_to is null and l.created_by is null)
  );
$$;

create or replace function public.capture_lost_lead_owner()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='lost' and coalesce(old.status::text,'')<>'lost' then
    new.lost_by := (select auth.uid());
    new.lost_at := now();
    new.lost_previous_assigned_to := old.assigned_to;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_lost_lead_owner on public.leads;
create trigger trg_capture_lost_lead_owner before update of status on public.leads for each row execute function public.capture_lost_lead_owner();

create or replace function public.claim_lost_lead(p_lead_id uuid)
returns public.leads language plpgsql security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_lead public.leads;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=v_user and coalesce(is_active,true)) then raise exception 'Active employee account required'; end if;
  select * into v_lead from public.leads where id=p_lead_id and status='lost' and assigned_to is null for update;
  if not found then raise exception 'This lost lead is no longer available in the Lost Pool'; end if;
  update public.leads set assigned_to=v_user, updated_at=now() where id=p_lead_id;
  insert into public.lead_assignees(lead_id,user_id,assigned_by,added_at,removed_at)
  values(p_lead_id,v_user,v_user,now(),null)
  on conflict(lead_id,user_id) do update set removed_at=null,assigned_by=excluded.assigned_by,added_at=excluded.added_at;
  insert into public.lead_activities(lead_id,type,content,meta,created_by)
  values(p_lead_id,'lead_assigned','Lost lead claimed from Company Lost Pool',jsonb_build_object('action','claim_lost_lead','user_id',v_user),v_user);
  select * into v_lead from public.leads where id=p_lead_id;
  return v_lead;
end;
$$;

revoke all on function public.claim_lost_lead(uuid) from public, anon;
grant execute on function public.claim_lost_lead(uuid) to authenticated;

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using((select private.can_view_lead(id)));

drop policy if exists lead_activities_select on public.lead_activities;
create policy lead_activities_select on public.lead_activities for select to authenticated using((select private.can_view_lead(lead_id)));

drop policy if exists lead_assignees_select on public.lead_assignees;
create policy lead_assignees_select on public.lead_assignees for select to authenticated using(is_admin() or user_id=(select auth.uid()) or private.can_access_lead(lead_id));

with latest_lost as (
  select distinct on(a.lead_id) a.lead_id,a.created_by,a.created_at
  from public.lead_activities a join public.leads l on l.id=a.lead_id
  where l.status='lost' and a.type='status_change'
    and (a.meta->>'new_status'='lost' or lower(a.content) like '%status changed%lost%')
  order by a.lead_id,a.created_at desc
)
update public.leads l set lost_by=coalesce(l.lost_by,x.created_by),lost_at=coalesce(l.lost_at,x.created_at),lost_previous_assigned_to=coalesce(l.lost_previous_assigned_to,l.assigned_to)
from latest_lost x where l.id=x.lead_id and l.status='lost';

update public.lead_assignees la set removed_at=coalesce(la.removed_at,l.lost_at,now())
from public.leads l where l.id=la.lead_id and l.status='lost';

update public.leads set lost_previous_assigned_to=coalesce(lost_previous_assigned_to,assigned_to),assigned_to=null where status='lost';

commit;