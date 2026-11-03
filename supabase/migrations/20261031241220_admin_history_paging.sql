begin;
create function public.get_admin_resource_history_page_v1(p_resource_id text,p_organization_id uuid default null,p_before_id text default null,p_limit integer default 100)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare rows jsonb;oldest bigint;more boolean;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'])then raise exception'ADMIN_HISTORY_DENIED'using errcode='42501';end if;
 if p_limit not between 1 and 100 or length(p_resource_id)not between 1 and 200 or(p_before_id is not null and p_before_id!~'^[0-9]{1,19}$')then raise exception'INVALID_ADMIN_HISTORY_CURSOR'using errcode='22023';end if;
 select coalesce(jsonb_agg(item order by id),'[]'::jsonb),min(id)into rows,oldest from(select e.id,jsonb_build_object('id',e.id::text,'action',e.action,'occurredAt',e.occurred_at,'actorType',e.actor_type,'actorLabel',p.display_name,'reason',left(coalesce(e.metadata->>'reason_code',e.metadata->>'reason',e.metadata->>'decision_reason_code',''),500),'correlationId',e.correlation_id)item from public.audit_events e left join public.user_profiles p on p.id=e.actor_user_id where e.resource_id=p_resource_id and(p_organization_id is null or e.organization_id=p_organization_id)and(p_before_id is null or e.id<p_before_id::bigint)order by e.id desc limit p_limit)page;
 more:=oldest is not null and exists(select 1 from public.audit_events where resource_id=p_resource_id and(p_organization_id is null or organization_id=p_organization_id)and id<oldest);
 return jsonb_build_object('events',rows,'hasMore',more,'nextBefore',case when more then oldest::text end);
end$$;
revoke all on function public.get_admin_resource_history_page_v1(text,uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_resource_history_page_v1(text,uuid,text,integer)to authenticated;
notify pgrst,'reload schema';
commit;
