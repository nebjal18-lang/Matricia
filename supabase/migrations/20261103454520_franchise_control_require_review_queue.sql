-- Missing central routing is an explicit scheduling failure, never a queued success.
begin;
create function private.require_franchise_control_admin_queue_v1(p_key text)returns uuid language plpgsql security definer set search_path=pg_catalog as $$declare q uuid;begin
 select id into q from public.admin_queue_versions where queue_key=p_key and status='ACTIVE'for share;
 if q is null then raise exception 'FRANCHISE_CONTROL_ADMIN_QUEUE_NOT_CONFIGURED'using errcode='55000';end if;return q;
end$$;
revoke all on function private.require_franchise_control_admin_queue_v1(text)from public,anon,authenticated,service_role;
create or replace function private.queue_franchise_control_plan_v1(p_plan_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare p public.franchise_control_plan_proposals_v1%rowtype;f public.franchises%rowtype;queue_id uuid;
begin
 queue_id:=private.require_franchise_control_admin_queue_v1('CENTRAL_APPROVALS');
 select *into strict p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;
 select *into strict f from public.franchises where id=p.franchise_id;
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
 select id,f.operator_organization_id,'MANUAL_REVIEW','franchise_control_plan_owner',p.id::text,'Examiner et suivre le plan correctif','مراجعة وتتبع الخطة التصحيحية','MEDIUM',p.due_on::timestamp at time zone 'Africa/Casablanca',
 jsonb_build_object('plan_id',p.id,'franchise_id',p.franchise_id,'actor_origin','SYSTEM','configuration_author_reference',f.created_by,'no_sanction_applied',true),f.created_by
 from public.admin_queue_versions where id=queue_id
 on conflict(queue_version_id,source_kind,resource_type,resource_id)do nothing;
end$$;

do $$declare p record;begin for p in select id from public.franchise_control_plan_proposals_v1 where not exists(select 1 from public.franchise_control_plan_events_v1 e where e.plan_id=franchise_control_plan_proposals_v1.id and e.kind in('REJECTED','COMPLETED'))loop perform private.queue_franchise_control_plan_v1(p.id);end loop;end$$;
commit;
