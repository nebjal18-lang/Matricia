begin;
create function public.attest_privacy_retention_work_item_v1(p_action_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a public.privacy_retention_actions%rowtype;w public.admin_work_items%rowtype;request_hash text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PRIVACY_WORK_TRACKING_DENIED'using errcode='42501';end if;
 select*into a from public.privacy_retention_actions where id=p_action_request_id;
 if a.id is null or p_correlation_id is null then raise exception'PRIVACY_RETENTION_REQUEST_NOT_FOUND'using errcode='P0002';end if;
 select*into w from public.admin_work_items where organization_id=a.organization_id and resource_type='privacy_retention_action'and resource_id=a.id::text and source_kind='MANUAL_REVIEW'for update;
 if w.id is null or w.redacted_context->>'policy_id'is distinct from a.retention_policy_id::text or w.redacted_context->>'action_type'is distinct from a.action_type
 or not exists(select 1 from public.audit_events where organization_id=a.organization_id and resource_type='privacy_retention_action'and resource_id=a.id::text and action='privacy.retention.requested'and correlation_id=a.correlation_id and metadata->>'policy_id'=a.retention_policy_id::text and metadata->>'action_type'=a.action_type)then raise exception'PRIVACY_RETENTION_DURABLE_WORK_REQUIRED'using errcode='55000';end if;
 request_hash:=private.canonical_request_hash(jsonb_build_object('action_id',a.id,'organization_id',a.organization_id,'policy_id',a.retention_policy_id,'subject_reference_hash',a.subject_reference_hash,'action_type',a.action_type,'idempotency_key',a.idempotency_key));
 if w.redacted_context?'request_hash'and w.redacted_context->>'request_hash'is distinct from request_hash then raise exception'PRIVACY_RETENTION_WORK_HASH_MISMATCH'using errcode='22000';end if;
 if not(w.redacted_context?'request_hash')then update public.admin_work_items set redacted_context=redacted_context||jsonb_build_object('request_hash',request_hash),updated_at=clock_timestamp(),row_version=row_version+1 where id=w.id;end if;
 if not exists(select 1 from public.audit_events where organization_id=a.organization_id and action='privacy.retention.work_item_tracked'and resource_id=a.id::text and metadata->>'request_hash'=request_hash)then
  insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w.id,'WORK_ITEM_TRACKED',w.status,w.status,a.requested_by,'Prise en charge durable attestée ; aucune disposition déclarée exécutée',jsonb_build_object('request_hash',request_hash,'disposition_executed',false),p_correlation_id);
  insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a.organization_id,'SERVICE','privacy.retention.work_item_tracked','privacy_retention_action',a.id::text,p_correlation_id,jsonb_build_object('work_item_id',w.id,'request_hash',request_hash,'disposition_executed',false,'dsr_fulfilled',false),repeat('0',64));
 end if;
 return jsonb_build_object('outcome','PRIVACY_WORK_ITEM_TRACKED','action_id',a.id,'work_item_id',w.id,'request_hash',request_hash);
end$$;
revoke all on function public.attest_privacy_retention_work_item_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.attest_privacy_retention_work_item_v1(uuid,uuid)to service_role;
notify pgrst,'reload schema';
commit;
