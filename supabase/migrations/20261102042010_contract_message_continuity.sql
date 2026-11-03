begin;
-- Continue the same private object thread after selection; never reopen an RFQ.
-- A contract must bind the exact selected quote, client and provider. A
-- Technician participates only through the authoritative mission assignment.
create function private.contract_message_technician_scope_v1(p_rfq_id uuid,p_provider_organization_id uuid,p_actor uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_actor is null or not private.has_org_role(p_provider_organization_id,array['PROVIDER_TECHNICIAN'],p_actor) or to_regprocedure('private.provider_mission_access_v1(uuid,uuid)') is null then return false;end if;
 return exists(select 1 from public.quotes q join public.contract_versions cv on cv.selected_quote_version_id=q.selected_version_id
 join public.contracts c on c.id=cv.contract_id and c.current_version=cv.version join public.missions m on m.contract_id=c.id
 join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id
 where q.rfq_id=p_rfq_id and q.provider_organization_id=p_provider_organization_id and q.status='SELECTED'
 and c.provider_organization_id=p_provider_organization_id and c.client_organization_id=sr.client_organization_id
 and c.status in('PENDING_SIGNATURE','ACTIVE','AMENDED','COMPLETED','TERMINATED') and private.provider_mission_access_v1(m.id,p_actor));
end$$;
create function private.contract_message_open_scope_v1(p_rfq_id uuid,p_provider_organization_id uuid,p_actor uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and exists(select 1 from public.quotes q join public.contract_versions cv on cv.selected_quote_version_id=q.selected_version_id
 join public.contracts c on c.id=cv.contract_id and c.current_version=cv.version join public.rfqs r on r.id=q.rfq_id join public.service_requests sr on sr.id=r.request_id
 where q.rfq_id=p_rfq_id and q.provider_organization_id=p_provider_organization_id and q.status='SELECTED'
 and c.provider_organization_id=p_provider_organization_id and c.client_organization_id=sr.client_organization_id
 and c.status in('PENDING_SIGNATURE','ACTIVE','AMENDED','COMPLETED','TERMINATED')
 and(private.can_manage_client_request(c.client_organization_id,p_actor)or private.is_provider_actor(p_provider_organization_id,p_actor)or private.contract_message_technician_scope_v1(p_rfq_id,p_provider_organization_id,p_actor)))
$$;
create function private.provider_message_participant_scope_v1(p_thread_id uuid,p_provider_organization_id uuid,p_actor uuid)returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare target public.internal_message_threads%rowtype;
begin
 -- Existing non-Technician participant permissions remain unchanged. A technical
 -- role alone must not inherit every consultation and mission of its employer.
 if not private.has_org_role(p_provider_organization_id,array['PROVIDER_TECHNICIAN'],p_actor) or private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],p_actor)then return true;end if;
 select * into target from public.internal_message_threads where id=p_thread_id;
 return found and target.object_type='RFQ' and target.provider_organization_id=p_provider_organization_id
 and private.contract_message_technician_scope_v1(target.object_id,p_provider_organization_id,p_actor);
end$$;
create or replace function private.is_internal_message_participant(p_thread_id uuid,p_organization_id uuid,p_actor uuid default auth.uid())returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.internal_message_participants p join public.internal_message_threads t on t.id=p.thread_id
 where p.thread_id=p_thread_id and p.organization_id=p_organization_id and private.is_active_org_member(p.organization_id,p_actor)
 and(p.participant_kind<>'PROVIDER'or private.provider_message_participant_scope_v1(p_thread_id,p.organization_id,p_actor))
 and(p.participant_kind<>'FRANCHISE'or exists(select 1 from public.franchises f where f.id=t.franchise_id and f.operator_organization_id=p.organization_id and private.active_franchise_messaging_scope(f.id,p_actor))))
$$;
-- Patch only the three lifecycle/actor predicates in the canonical command.
-- Its immutable hash, privacy, command key, audit and outbox bodies stay intact.
do $$declare definition text;old text;replacement text;begin
 select pg_get_functiondef('public.open_rfq_message_thread(uuid,uuid,text,text,uuid)'::regprocedure)into definition;
 old:='if v_rfq.status <> ''OPEN'' or v_request.status not in (''RFQ_OPEN'',''QUOTES_RECEIVED'',''CLIENT_REVIEW'') then';
 replacement:='if (v_rfq.status <> ''OPEN'' or v_request.status not in (''RFQ_OPEN'',''QUOTES_RECEIVED'',''CLIENT_REVIEW'')) and not private.contract_message_open_scope_v1(p_rfq_id,p_provider_organization_id,v_actor) then';
 if strpos(definition,old)=0 then raise exception'CONTRACT_MESSAGE_LIFECYCLE_PATCH_TARGET_MISSING';end if;definition:=replace(definition,old,replacement);
 old:='rp.status not in (''WITHDRAWN'',''SUSPENDED'')) then';
 replacement:='rp.status not in (''WITHDRAWN'',''SUSPENDED'')) and not private.contract_message_open_scope_v1(p_rfq_id,p_provider_organization_id,v_actor) then';
 if strpos(definition,old)=0 then raise exception'CONTRACT_MESSAGE_INVITATION_PATCH_TARGET_MISSING';end if;definition:=replace(definition,old,replacement);
 old:='private.is_provider_actor(p_provider_organization_id,v_actor)) then';
 replacement:='private.is_provider_actor(p_provider_organization_id,v_actor) or private.contract_message_technician_scope_v1(p_rfq_id,p_provider_organization_id,v_actor)) then';
 if strpos(definition,old)=0 then raise exception'CONTRACT_MESSAGE_ACTOR_PATCH_TARGET_MISSING';end if;definition:=replace(definition,old,replacement);
 execute definition;
end$$;
create function public.list_internal_message_open_options_v1(p_organization_id uuid,p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or p_organization_id is null or not private.is_active_org_member(p_organization_id,actor)then raise exception'MESSAGE_OPTIONS_SCOPE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_MESSAGE_PAGE'using errcode='22023';end if;
 with available as(
 select r.id rfq_id,rp.provider_organization_id,p_organization_id sender_organization_id,
 case when r.status='OPEN'and sr.status in('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW')then'RFQ'else'CONTRACT'end context
 from public.rfqs r join public.service_requests sr on sr.id=r.request_id join public.rfq_providers rp on rp.rfq_id=r.id
 where ((p_organization_id=sr.client_organization_id and private.can_manage_client_request(p_organization_id,actor))
 or(p_organization_id=rp.provider_organization_id and(private.is_provider_actor(p_organization_id,actor)or private.contract_message_technician_scope_v1(r.id,p_organization_id,actor))))
 and((r.status='OPEN'and sr.status in('RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW')and rp.status not in('WITHDRAWN','SUSPENDED'))
 or private.contract_message_open_scope_v1(r.id,rp.provider_organization_id,actor))),
 paged as(select * from available order by rfq_id,provider_organization_id limit 100 offset(p_page-1)*100)
 select jsonb_build_object('options',coalesce((select jsonb_agg(jsonb_build_object('rfqId',rfq_id,'providerOrganizationId',provider_organization_id,'senderOrganizationId',sender_organization_id,'context',context)order by rfq_id,provider_organization_id)from paged),'[]'::jsonb),'total',(select count(*)from available),'page',p_page,'pageSize',100,'hasMore',(select count(*)from available)>p_page*100)into result;
 return result;
end$$;
revoke all on function private.contract_message_technician_scope_v1(uuid,uuid,uuid),private.contract_message_open_scope_v1(uuid,uuid,uuid),private.provider_message_participant_scope_v1(uuid,uuid,uuid),private.is_internal_message_participant(uuid,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.list_internal_message_open_options_v1(uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_internal_message_open_options_v1(uuid,integer)to authenticated;
notify pgrst,'reload schema';
commit;
