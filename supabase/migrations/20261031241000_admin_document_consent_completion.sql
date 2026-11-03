begin;
alter table public.client_document_bindings drop constraint client_document_bindings_target_type_check;
alter table public.client_document_bindings add constraint client_document_bindings_target_type_check check(target_type in('SERVICE_REQUEST','CONTRACT_VERSION','MISSION','COMPLIANCE_CASE'));
alter table public.admin_document_reuse_requests_v1 drop constraint admin_document_reuse_requests_v1_target_type_check;
alter table public.admin_document_reuse_requests_v1 add constraint admin_document_reuse_requests_v1_target_type_check check(target_type in('SERVICE_REQUEST','CONTRACT_VERSION','MISSION','COMPLIANCE_CASE'));
create or replace function private.client_document_target_organization(p_target_type text,p_target_id uuid)returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
 case p_target_type
 when'SERVICE_REQUEST'then select client_organization_id into result from public.service_requests where id=p_target_id;
 when'CONTRACT_VERSION'then select c.client_organization_id into result from public.contract_versions v join public.contracts c on c.id=v.contract_id where v.id=p_target_id;
 when'MISSION'then select client_organization_id into result from public.missions where id=p_target_id;
 when'COMPLIANCE_CASE'then select organization_id into result from public.client_compliance_cases where id=p_target_id;
 else return null;end case;return result;
end$$;
alter function public.respond_admin_document_reuse_v1(uuid,boolean,text)rename to respond_admin_document_reuse_delivery_internal;
revoke all on function public.respond_admin_document_reuse_delivery_internal(uuid,boolean,text)from public,anon,authenticated,service_role;
create function public.respond_admin_document_reuse_v1(p_request_id uuid,p_accept boolean,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare result jsonb;r public.admin_document_reuse_requests_v1%rowtype;parent public.admin_operational_action_requests%rowtype;proof text;c uuid:=extensions.gen_random_uuid();
begin
 result:=public.respond_admin_document_reuse_delivery_internal(p_request_id,p_accept,p_idempotency_key);
 select*into r from public.admin_document_reuse_requests_v1 where id=p_request_id;
 select*into parent from public.admin_operational_action_requests where id=r.action_request_id for update;
 if parent.status='REQUEST_TRACKED'then
  proof:=private.canonical_request_hash(jsonb_build_object('request_id',parent.id,'owner_response',p_accept,'binding_id',r.binding_id));
  update public.admin_operational_action_requests set status=case when p_accept then'EXECUTED'else'CANCELLED'end,executed_at=case when p_accept then clock_timestamp()else null end,execution_result_hash=proof,row_version=row_version+1 where id=parent.id;
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER',case when p_accept then'admin.action.owner_consent_executed'else'admin.action.owner_declined'end,'admin_action_request',parent.id::text,c,jsonb_build_object('binding_id',r.binding_id,'result_hash',proof),repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(r.organization_id,'admin_action_request',parent.id::text,case when p_accept then'AdminActionExecutedV1'else'AdminActionCancelledV1'end,c,jsonb_build_object('action_request_id',parent.id,'binding_id',r.binding_id,'result_hash',proof));
 end if;
 return result;
end$$;
revoke all on function public.respond_admin_document_reuse_v1(uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.respond_admin_document_reuse_v1(uuid,boolean,text)to authenticated;
notify pgrst,'reload schema';
commit;
