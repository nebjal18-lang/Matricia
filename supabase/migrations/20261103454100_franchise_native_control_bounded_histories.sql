-- Additive after 45400: its applied body remains byte-for-byte unchanged.
create index franchise_control_report_timeline_v1 on public.franchise_control_reports_v1(franchise_id,generated_at desc,id desc);
create index franchise_control_report_period_v1 on public.franchise_control_reports_v1(franchise_id,kind,period_end);
create index franchise_control_plan_event_timeline_v1 on public.franchise_control_plan_events_v1(plan_id,id);
-- Avoid ambiguous PostgREST overload resolution when optional cursor fields arrive.
drop function public.list_franchise_native_control_v1(uuid,timestamptz,integer,uuid);
create or replace function private.franchise_control_plan_page_v1(p_franchise_id uuid,p_report_ids uuid[],p_event_plan_id uuid,p_after_event_id bigint)returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
 'events',coalesce((select jsonb_agg(to_jsonb(e)order by e.id)from(select *from public.franchise_control_plan_events_v1 e where e.plan_id=p.id and(e.id>case when p.id=p_event_plan_id then p_after_event_id else 0 end)order by e.id limit 50)e),'[]'),
 'eventCount',(select count(*)from public.franchise_control_plan_events_v1 e where e.plan_id=p.id),
 'nextEventAfter',(select case when exists(select 1 from public.franchise_control_plan_events_v1 following where following.plan_id=p.id and following.id>last.id)then last.id::text end from public.franchise_control_plan_events_v1 last where last.plan_id=p.id and last.id>case when p.id=p_event_plan_id then p_after_event_id else 0 end order by last.id offset 49 limit 1)
 )order by p.created_at desc,p.id),'[]')from public.franchise_control_plan_proposals_v1 p where p.franchise_id=p_franchise_id and p.report_id=any(p_report_ids)
$$;
revoke all on function private.franchise_control_plan_page_v1(uuid,uuid[],uuid,bigint)from public,anon,authenticated,service_role;

create function public.list_franchise_native_control_v1(p_franchise_id uuid,p_before timestamptz default null,p_limit integer default 20,p_before_id uuid default null,p_event_plan_id uuid default null,p_after_event_id bigint default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.franchise_native_control_read_access_v1(p_franchise_id)then raise exception 'FRANCHISE_CONTROL_READ_DENIED'using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or ((p_before is null)<>(p_before_id is null))or ((p_event_plan_id is null)<>(p_after_event_id is null))or p_after_event_id<0 then raise exception 'FRANCHISE_CONTROL_LIMIT_INVALID'using errcode='22023';end if;
 if p_event_plan_id is not null and not exists(select 1 from public.franchise_control_plan_proposals_v1 where id=p_event_plan_id and franchise_id=p_franchise_id)then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 select jsonb_build_object('franchiseId',p_franchise_id,'reports',coalesce(jsonb_agg(to_jsonb(r)order by r.generated_at desc,r.id),'[]'),'nextCursor',case when count(*)=p_limit then(select jsonb_build_object('before',last.generated_at,'id',last.id)from public.franchise_control_reports_v1 last where last.franchise_id=p_franchise_id and(p_before is null or(last.generated_at,last.id)<(p_before,p_before_id))order by last.generated_at desc,last.id desc offset p_limit-1 limit 1)end)into result from(select *from public.franchise_control_reports_v1 where franchise_id=p_franchise_id and(p_before is null or(generated_at,id)<(p_before,p_before_id))order by generated_at desc,id desc limit p_limit)r;
 return result||jsonb_build_object('capabilities',jsonb_build_object('canWrite',private.has_franchise_role(p_franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'),'canDecide',private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and coalesce(auth.jwt()->>'aal','')='aal2'),'plans',private.franchise_control_plan_page_v1(p_franchise_id,coalesce((select array_agg((j->>'id')::uuid)from jsonb_array_elements(result->'reports')j),'{}'::uuid[]),p_event_plan_id,coalesce(p_after_event_id,0)));
end$$;


revoke all on function public.list_franchise_native_control_v1(uuid,timestamptz,integer,uuid,uuid,bigint)from public,anon,authenticated,service_role;
grant execute on function public.list_franchise_native_control_v1(uuid,timestamptz,integer,uuid,uuid,bigint)to authenticated;
notify pgrst,'reload schema';
