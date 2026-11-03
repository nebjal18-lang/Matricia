begin;
-- A global read role may coexist with Technician. It must never stand in for
-- the separate permission to execute an assigned mission.
do $$declare definition text;begin
 select pg_get_functiondef('private.contract_message_technician_scope_v1(uuid,uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'private.provider_mission_access_v1')=0 then raise exception'MESSAGE_EXECUTION_SCOPE_PATCH_TARGET_MISSING';end if;
 execute replace(definition,'private.provider_mission_access_v1','private.provider_mission_execution_access_v1');
end$$;
create or replace function private.internal_message_draft_can_send_v1(p_thread uuid,p_sender uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()is not null and exists(select 1 from public.internal_message_threads t join public.internal_message_participants p on p.thread_id=t.id and p.organization_id=p_sender
 where t.id=p_thread and t.status='OPEN'and private.is_internal_message_participant(t.id,p_sender,auth.uid())and case p.participant_kind
 when'FRANCHISE'then private.franchise_message_can_write(t.franchise_id,auth.uid())
 when'PROVIDER'then private.has_org_role(p_sender,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES'],auth.uid())or(t.object_type='RFQ'and private.contract_message_technician_scope_v1(t.object_id,p_sender,auth.uid()))
 when'CLIENT'then private.has_org_role(p_sender,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_ACCOUNTING','CLIENT_MEMBER'],auth.uid())
 else false end)
$$;
-- Capabilities come from the current server guard, including role changes and
-- revocation; the browser does not infer write access from a readable object.
do $$declare definition text;old text;begin
 select pg_get_functiondef('public.get_internal_message_thread(uuid,integer)'::regprocedure)into definition;
 old:='''participant_organization_id'',v_organization,''participant_kind'',v_kind';
 if strpos(definition,old)=0 then raise exception'MESSAGE_LEGACY_CAPABILITY_PATCH_TARGET_MISSING';end if;
 execute replace(definition,old,'''participant_organization_id'',v_organization,''can_send'',private.internal_message_draft_can_send_v1(p_thread_id,v_organization),''participant_kind'',v_kind');
 select pg_get_functiondef('public.get_internal_message_thread_page(uuid,timestamptz,uuid,integer)'::regprocedure)into definition;
 old:='return jsonb_build_object(''thread'',thread,''messages'',messages';
 if strpos(definition,old)=0 then raise exception'MESSAGE_PAGE_CAPABILITY_PATCH_TARGET_MISSING';end if;
 execute replace(definition,old,'return jsonb_build_object(''thread'',thread||jsonb_build_object(''can_send'',private.internal_message_draft_can_send_v1(p_thread_id,(thread->>''participant_organization_id'')::uuid)),''messages'',messages');
 select pg_get_functiondef('public.get_internal_message_thread_page_for_organization_v1(uuid,uuid,timestamptz,uuid,integer)'::regprocedure)into definition;
 old:='''counterparty_alias'',other_alias)';
 if strpos(definition,old)=0 then raise exception'MESSAGE_SCOPED_CAPABILITY_PATCH_TARGET_MISSING';end if;
 execute replace(definition,old,'''counterparty_alias'',other_alias,''can_send'',private.internal_message_draft_can_send_v1(p_thread_id,p_organization_id))');
end$$;
revoke all on function private.internal_message_draft_can_send_v1(uuid,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
