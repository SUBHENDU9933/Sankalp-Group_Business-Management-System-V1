-- =====================================================================
-- SANKALP GROUP — Schema v14_fix1 (HOTFIX for audit_trigger_fn)
-- Apply to BM App Supabase (Project B) AFTER v14.
--
-- BUG: audit_trigger_fn referenced undefined variable `k` in the
-- jsonb_object_agg diff calculation for UPDATE actions. This caused
-- EVERY update to fail with `column "k" does not exist`, breaking:
--   • soft-delete of leads / customers / projects / vendors / estimates
--   • digital approval customer response submission
--   • any status change (assignments, notes, updates)
--
-- FIX: correct column reference from `k` → `key` (the USING-joined
-- column produced by jsonb_each). Zero data change, drop-and-replace.
-- =====================================================================

create or replace function public.audit_trigger_fn()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor  uuid  := auth.uid();
  v_email  text;
  v_name   text;
  v_role   text;
  v_action text;
  v_id     uuid;
  v_label  text;
  v_changes jsonb;
begin
  -- Actor lookup (best-effort — RPC-invoked functions may run as anon)
  if v_actor is not null then
    select p.email, p.full_name, p.role into v_email, v_name, v_role
    from public.profiles p where p.id = v_actor;
  end if;

  if (TG_OP = 'INSERT') then
    v_action := 'create';
    v_id := (row_to_json(NEW)->>'id')::uuid;
    v_label := coalesce(row_to_json(NEW)->>'name',
                        row_to_json(NEW)->>'project_name',
                        row_to_json(NEW)->>'receipt_no',
                        row_to_json(NEW)->>'estimate_no',
                        row_to_json(NEW)->>'subject');
    v_changes := to_jsonb(NEW);

  elsif (TG_OP = 'UPDATE') then
    v_id := (row_to_json(NEW)->>'id')::uuid;
    v_label := coalesce(row_to_json(NEW)->>'name',
                        row_to_json(NEW)->>'project_name',
                        row_to_json(NEW)->>'receipt_no',
                        row_to_json(NEW)->>'estimate_no',
                        row_to_json(NEW)->>'subject');
    -- Detect soft-delete vs restore vs update
    if (row_to_json(OLD)->>'deleted_at') is null and (row_to_json(NEW)->>'deleted_at') is not null then
      v_action := 'soft_delete';
    elsif (row_to_json(OLD)->>'deleted_at') is not null and (row_to_json(NEW)->>'deleted_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;

    -- Compute changed-field diff.  FIX: use `key` (produced by USING (key)),
    -- not the undefined `k`.
    begin
      v_changes := (
        select coalesce(jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
        from jsonb_each(to_jsonb(NEW)) n
        join jsonb_each(to_jsonb(OLD)) o using (key)
        where n.value is distinct from o.value
          and key not in ('updated_at')
      );
    exception when others then
      -- Any diff failure must NEVER block the underlying update.
      v_changes := jsonb_build_object('diff_error', SQLERRM);
    end;

  elsif (TG_OP = 'DELETE') then
    v_action := 'delete';
    v_id := (row_to_json(OLD)->>'id')::uuid;
    v_label := coalesce(row_to_json(OLD)->>'name',
                        row_to_json(OLD)->>'project_name',
                        row_to_json(OLD)->>'receipt_no',
                        row_to_json(OLD)->>'estimate_no',
                        row_to_json(OLD)->>'subject');
    v_changes := to_jsonb(OLD);
  end if;

  -- Even the insert into audit_log must not block the parent op.
  begin
    insert into public.audit_log (action, entity_type, entity_id, entity_label,
      actor_id, actor_email, actor_name, actor_role, changes)
    values (v_action, TG_TABLE_NAME, v_id, v_label, v_actor, v_email, v_name, v_role, v_changes);
  exception when others then
    -- If audit insert itself fails (e.g. schema mismatch), we still let the parent op succeed.
    null;
  end;

  return coalesce(NEW, OLD);
end;
$$;

notify pgrst, 'reload schema';
