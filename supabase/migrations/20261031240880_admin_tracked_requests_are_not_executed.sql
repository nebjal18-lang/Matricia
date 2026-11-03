begin;
alter table public.admin_operational_action_requests drop constraint admin_operational_action_requests_status_check;
alter table public.admin_operational_action_requests add constraint admin_operational_action_requests_status_check check(status in('PENDING_APPROVAL','AUTHORIZED','REQUEST_TRACKED','REJECTED','EXECUTED','FAILED','CANCELLED'));
create function private.track_admin_operational_request_v1(p_request_id uuid,p_result_hash text,p_correlation_id uuid,p_effect jsonb)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;
begin
 if auth.role()is distinct from'service_role'then raise exception'ADMIN_REQUEST_TRACKING_DENIED'using errcode='42501';end if;
 select*into x from public.admin_operational_action_requests where id=p_request_id for update;
 if x.status<>'AUTHORIZED'then raise exception'ADMIN_ACTION_NOT_AUTHORIZED'using errcode='55000';end if;
 update public.admin_operational_action_requests set status='REQUEST_TRACKED',execution_result_hash=p_result_hash,row_version=row_version+1 where id=x.id;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(x.organization_id,'SERVICE','admin.action.request_tracked','admin_action_request',x.id::text,p_correlation_id,jsonb_build_object('result_hash',p_result_hash,'effect_status',p_effect->>'status','executed',false),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(x.organization_id,'admin_action_request',x.id::text,'AdminActionRequestTrackedV1',p_correlation_id,jsonb_build_object('action_request_id',x.id,'result_hash',p_result_hash,'effect_status',p_effect->>'status'));
 return jsonb_build_object('outcome','ADMIN_ACTION_REQUEST_TRACKED','action_request_id',x.id,'result_hash',p_result_hash,'effect',p_effect);
end$$;
revoke all on function private.track_admin_operational_request_v1(uuid,text,uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'if x.status=''EXECUTED''then')=0 then raise exception'ADMIN_TRACKED_REPLAY_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'if x.status=''EXECUTED''then','if x.status=''REQUEST_TRACKED''then return jsonb_build_object(''outcome'',''ADMIN_ACTION_REQUEST_TRACKED'',''action_request_id'',x.id,''result_hash'',x.execution_result_hash);end if; if x.status=''EXECUTED''then');
 definition:=replace(definition,'return public.complete_admin_operational_action(x.id,result_hash,true,p_correlation_id)', 'if result->>''status''in(''DRAFT'',''PENDING_CLIENT_DECISION'',''PENDING_OWNER_CONSENT'',''MANUAL_REVIEW_PENDING'')then return private.track_admin_operational_request_v1(x.id,result_hash,p_correlation_id,result);end if; return public.complete_admin_operational_action(x.id,result_hash,true,p_correlation_id)');
 execute definition;
end$$;
do $$declare definition text;begin
 select pg_get_functiondef('private.execute_admin_membership_mutation_v1(uuid,uuid)'::regprocedure)into definition;
 definition:=replace(definition,'return jsonb_build_object(''membership_id'',m.id,','return case when old_role is not distinct from new_role and source_franchise is not distinct from target_franchise and jsonb_array_length(coalesce(payload->''capabilities'',''[]''))>0 then jsonb_build_object(''status'',''MANUAL_REVIEW_PENDING'')else ''{}''::jsonb end||jsonb_build_object(''membership_id'',m.id,');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
