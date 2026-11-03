begin;
-- Stable tie-breaks prevent equal timestamps from duplicating or losing rows
-- across bounded admin projection pages.
do $$declare definition text;begin
 select pg_get_functiondef('public.list_admin_supervision_page_raw_v1(integer,integer)'::regprocedure)into definition;
 definition:=replace(definition,'where o.status in (''ACTIVE'',''PENDING'',''SUSPENDED'')','where o.status in (''ACTIVE'',''PENDING'',''SUSPENDED'',''ARCHIVED'')');
 definition:=replace(definition,'order by r.created_at desc','order by r.created_at desc,r.id');
 definition:=replace(definition,'order by qt.updated_at desc nulls last','order by qt.updated_at desc nulls last,qt.id');
 definition:=replace(definition,'order by m.updated_at desc nulls last','order by m.updated_at desc nulls last,m.id');
 definition:=replace(definition,'order by d.completed_at desc nulls last','order by d.completed_at desc nulls last,d.id');
 definition:=replace(definition,'order by mr.started_at desc','order by mr.started_at desc,mr.id');
 definition:=replace(definition,'order by c.created_at desc','order by c.created_at desc,c.id');
 definition:=replace(definition,'order by a.created_at desc','order by a.created_at desc,a.id');
 definition:=replace(definition,'order by d.created_at desc','order by d.created_at desc,d.id');
 definition:=replace(definition,'order by v.created_at desc','order by v.created_at desc,v.id');
 definition:=replace(definition,'order by t.created_at desc','order by t.created_at desc,t.id');
 definition:=replace(definition,'order by w.severity_rank desc, w.due_at','order by w.severity_rank desc, w.due_at,w.id');
 definition:=replace(definition,'order by t.template_code, t.locale','order by t.template_code, t.locale,t.id');
 execute definition;
end$$;
create or replace function public.list_admin_supervision_page_v1(p_limit integer default 100,p_offset integer default 0)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;rows jsonb;
begin
 result:=public.list_admin_supervision_page_raw_v1(p_limit,p_offset);
 result:=jsonb_set(result,'{organizations}',coalesce((select jsonb_agg(org||jsonb_build_object('role_codes',private.administration_organization_roles_v1((org->>'id')::uuid)))from jsonb_array_elements(result->'organizations')org),'[]'));
 select coalesce(jsonb_agg(item),'[]'::jsonb)into rows from(select jsonb_build_object('id',d.id,'organization_id',n.organization_id,'organization_name',o.display_name,'event_type',n.event_type,'channel',d.channel,'status',d.status,'priority',n.priority,'read_at',n.read_at,'updated_at',d.updated_at,'error_code',d.last_error_code,'attempt_count',d.attempt_count)item from public.notification_deliveries d join public.notification_instances n on n.id=d.notification_id join public.organizations o on o.id=n.organization_id order by d.updated_at desc,d.id limit greatest(1,least(coalesce(p_limit,100),500))offset greatest(coalesce(p_offset,0),0))page;
 return result||jsonb_build_object('notifications',rows);
end$$;

create function public.get_admin_thread_message_page_v1(p_thread_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 100)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare rows jsonb;oldest jsonb;c uuid:=extensions.gen_random_uuid();o uuid;more boolean;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())or not private.can_access_internal_message_thread(p_thread_id,auth.uid())then raise exception'ADMIN_CONVERSATION_SCOPE_DENIED'using errcode='42501';end if;
 if p_limit not between 1 and 100 or((p_before_at is null)<>(p_before_id is null))then raise exception'INVALID_CONVERSATION_CURSOR'using errcode='22023';end if;
 select client_organization_id into o from public.internal_message_threads where id=p_thread_id;
 if o is null then raise exception'CONVERSATION_NOT_FOUND'using errcode='P0002';end if;
 select coalesce(jsonb_agg(item order by created_at,id),'[]'::jsonb)into rows from(select m.created_at,m.id,jsonb_build_object('id',m.id,'body',m.body,'createdAt',m.created_at,'senderAlias',p.display_alias,'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.original_file_name,'scanStatus',a.scan_status,'downloadReady',a.scan_status='CLEAN')order by a.created_at,a.id)from public.internal_message_attachments a where a.message_id=m.id),'[]'::jsonb))item from public.internal_messages m join public.internal_message_participants p on p.id=m.sender_participant_id where m.thread_id=p_thread_id and(p_before_at is null or(m.created_at,m.id)<(p_before_at,p_before_id))order by m.created_at desc,m.id desc limit p_limit)page;
 oldest:=rows->0;
 more:=oldest is not null and exists(select 1 from public.internal_messages m where m.thread_id=p_thread_id and(m.created_at,m.id)<((oldest->>'createdAt')::timestamptz,(oldest->>'id')::uuid));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(o,auth.uid(),'USER','admin.conversation.read','internal_message_thread',p_thread_id::text,c,jsonb_build_object('message_count',jsonb_array_length(rows),'has_more',more),repeat('0',64));
 return jsonb_build_object('messages',rows,'hasMore',more,'nextCursor',case when more then jsonb_build_object('at',oldest->>'createdAt','id',oldest->>'id')end);
end$$;
revoke all on function public.get_admin_thread_message_page_v1(uuid,timestamptz,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_thread_message_page_v1(uuid,timestamptz,uuid,integer)to authenticated;
-- History includes only explicit human-readable evidence keys, never arbitrary
-- audit metadata, signed URLs, body payloads or authentication material.
create or replace function public.get_admin_resource_history_v1(p_resource_id text,p_organization_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','FINANCE_MANAGER','DISPUTE_MANAGER','LIBRARY_MANAGER','READ_ONLY_AUDITOR'])then raise exception'ADMIN_HISTORY_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(item order by item->>'occurredAt',item->>'id')from(select jsonb_build_object('id',e.id::text,'action',e.action,'occurredAt',e.occurred_at,'actorType',e.actor_type,'actorLabel',p.display_name,'reason',left(coalesce(e.metadata->>'reason_code',e.metadata->>'reason',e.metadata->>'decision_reason_code',''),500),'correlationId',e.correlation_id)item from public.audit_events e left join public.user_profiles p on p.id=e.actor_user_id where e.resource_id=p_resource_id and(p_organization_id is null or e.organization_id=p_organization_id)order by e.id desc limit 200)events),'[]'::jsonb);
end$$;
notify pgrst,'reload schema';
commit;
