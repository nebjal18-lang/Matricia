begin;
alter table public.admin_membership_capability_reviews_v1 add column resolution text check(resolution in('REJECTED','CANONICAL_ROLE_APPLIED')),add column canonical_role text references public.role_definitions(code),add column decided_by uuid references auth.users(id),add column decided_at timestamptz;
create function public.get_admin_capability_reviews_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ADMIN_CAPABILITY_REVIEW_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.action_request_id,'userId',m.user_id,'organizationId',m.organization_id,'organizationName',o.display_name,'requestedCapabilities',r.requested_capabilities,'status',r.status,'resolution',r.resolution,'roles',coalesce((select jsonb_agg(role_code)from public.organization_member_roles where membership_id=m.id and revoked_at is null),'[]'::jsonb))order by r.created_at desc)from public.admin_membership_capability_reviews_v1 r join public.organization_memberships m on m.id=r.membership_id join public.organizations o on o.id=m.organization_id),'[]'::jsonb);
end$$;
create function public.resolve_admin_capability_review_v1(p_review_id uuid,p_resolution text,p_canonical_role text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare r public.admin_membership_capability_reviews_v1%rowtype;m public.organization_memberships%rowtype;c uuid:=extensions.gen_random_uuid();w public.admin_work_items%rowtype;
begin
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'ADMIN_CAPABILITY_REVIEW_DENIED'using errcode='42501';end if;
 select*into r from public.admin_membership_capability_reviews_v1 where action_request_id=p_review_id for update;
 if r.action_request_id is null then raise exception'ADMIN_CAPABILITY_REVIEW_NOT_FOUND'using errcode='P0002';end if;
 if r.status='REVIEWED'then return jsonb_build_object('outcome','ADMIN_CAPABILITY_REVIEW_RECORDED');end if;
 if p_resolution not in('REJECTED','CANONICAL_ROLE_APPLIED')or length(btrim(coalesce(p_reason,'')))not between 3 and 500 then raise exception'INVALID_CAPABILITY_REVIEW_RESOLUTION'using errcode='22023';end if;
 select*into m from public.organization_memberships where id=r.membership_id;
 if p_resolution='CANONICAL_ROLE_APPLIED'and(m.status<>'ACTIVE'or not exists(select 1 from public.organization_member_roles a join public.role_definitions d on d.code=a.role_code where a.membership_id=m.id and a.revoked_at is null and a.role_code=p_canonical_role and d.scope_type in('ORGANIZATION','FRANCHISE')))then raise exception'CANONICAL_ROLE_NOT_APPLIED'using errcode='55000';end if;
 update public.admin_membership_capability_reviews_v1 set status='REVIEWED',resolution=p_resolution,canonical_role=case when p_resolution='CANONICAL_ROLE_APPLIED'then p_canonical_role end,decided_by=auth.uid(),decided_at=clock_timestamp()where action_request_id=r.action_request_id;
 for w in select*from public.admin_work_items where resource_type='membership_capability_review'and resource_id=r.action_request_id::text and status not in('RESOLVED','DISMISSED')for update loop
  update public.admin_work_items set status='RESOLVED',resolution_code='COMPLETED',resolution_reason=p_reason,resolution_evidence=jsonb_build_object('resolution',p_resolution,'canonical_role',p_canonical_role,'custom_privileges_granted',false),updated_at=clock_timestamp(),row_version=row_version+1 where id=w.id;
  insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w.id,'HUMAN_RESOLUTION',w.status,'RESOLVED',auth.uid(),p_reason,jsonb_build_object('resolution',p_resolution,'custom_privileges_granted',false),c);
 end loop;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(m.organization_id,auth.uid(),'USER','admin.capability.reviewed','membership_capability_review',r.action_request_id::text,c,jsonb_build_object('resolution',p_resolution,'canonical_role',p_canonical_role,'custom_privileges_granted',false),repeat('0',64));
 return jsonb_build_object('outcome','ADMIN_CAPABILITY_REVIEW_RECORDED');
end$$;
revoke all on function public.get_admin_capability_reviews_v1(),public.resolve_admin_capability_review_v1(uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.get_admin_capability_reviews_v1(),public.resolve_admin_capability_review_v1(uuid,text,text,text)to authenticated;
-- Every retention request has a durable human queue entry, never a fabricated purge result.
alter function public.request_privacy_retention_action(uuid,text,text,text,uuid)rename to request_privacy_retention_action_delivery_internal;
revoke all on function public.request_privacy_retention_action_delivery_internal(uuid,text,text,text,uuid)from public,anon,authenticated,service_role;
create function public.request_privacy_retention_action(p_policy_id uuid,p_subject_reference_hash text,p_action_type text,p_idempotency_key text,p_correlation_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare result uuid;o uuid;q uuid;w uuid;
begin
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'PRIVACY_RETENTION_MFA_REQUIRED'using errcode='42501';end if;
 select organization_id into o from public.retention_policies where id=p_policy_id and status='ACTIVE'and effective_from<=current_date and(effective_until is null or effective_until>=current_date);
 if o is null then raise exception'PRIVACY_RETENTION_POLICY_INACTIVE'using errcode='55000';end if;
 result:=public.request_privacy_retention_action_delivery_internal(p_policy_id,p_subject_reference_hash,p_action_type,p_idempotency_key,p_correlation_id);
 select id into q from public.admin_queue_versions where queue_key='RISK_FLAGS'and status='ACTIVE';
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
 values(q,o,'MANUAL_REVIEW','privacy_retention_action',result::text,'Rétention : instruction humaine et preuve requises','الاحتفاظ: معالجة بشرية وإثبات مطلوبان','HIGH',clock_timestamp()+interval'1 day',jsonb_build_object('policy_id',p_policy_id,'action_type',p_action_type,'execution_status','PENDING','responsible_role','COMPLIANCE_MANAGER'),auth.uid())on conflict(queue_version_id,source_kind,resource_type,resource_id)do nothing returning id into w;
 if w is not null then
  insert into public.admin_work_item_events(work_item_id,event_type,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w,'OPENED','OPEN',auth.uid(),'Demande de rétention transmise pour instruction humaine',jsonb_build_object('action_id',result,'completed',false),p_correlation_id);
 end if;
 return result;
end$$;
revoke all on function public.request_privacy_retention_action(uuid,text,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.request_privacy_retention_action(uuid,text,text,text,uuid)to authenticated;
create or replace function public.get_admin_privacy_console_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid())then raise exception'ADMIN_PRIVACY_DENIED'using errcode='42501';end if;
 return jsonb_build_object(
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'display_name',display_name)order by display_name,id)from public.organizations),'[]'::jsonb),
 'retentionActions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'organizationId',a.organization_id,'actionType',a.action_type,'status',a.status,'requestedAt',a.requested_at,'responsibleRole','COMPLIANCE_MANAGER','workItemId',(select id from public.admin_work_items w where w.resource_type='privacy_retention_action'and w.resource_id=a.id::text limit 1))order by a.requested_at desc)from public.privacy_retention_actions a),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'request_type',request_type,'status',status,'due_at',due_at,'row_version',row_version)order by due_at,id)from public.data_subject_requests),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'disposition',disposition,'retention_days',retention_days)order by organization_id,id)from public.retention_policies where status='ACTIVE'and effective_from<=current_date and(effective_until is null or effective_until>=current_date)),'[]'::jsonb));
end$$;

notify pgrst,'reload schema';
commit;
