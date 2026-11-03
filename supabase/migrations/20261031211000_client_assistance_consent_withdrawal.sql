-- A Client may withdraw human-assistance consent, including after case closure.
begin;
alter table public.client_assistance_requests add column consent_revoked_at timestamptz;
drop policy assistance_request_reader on public.client_assistance_requests;
create policy assistance_request_reader on public.client_assistance_requests for select to authenticated using(private.can_read_client_assistance(organization_id)and(created_by=auth.uid()or(status<>'DRAFT'and consented_at is not null and consent_revoked_at is null)));
create function public.withdraw_client_assistance_consent(p_request_id uuid,p_expected_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare a uuid:=auth.uid();r public.client_assistance_requests%rowtype;work public.admin_work_items%rowtype;h text;result jsonb;
begin
 select*into r from public.client_assistance_requests where id=p_request_id for update;
 if a is null or not found or r.created_by<>a or not private.has_org_role(r.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_EDITOR','CLIENT_MEMBER','CLIENT_BUYER'],a)then raise exception 'ASSISTANCE_CONSENT_WITHDRAWAL_DENIED'using errcode='42501';end if;
 if p_expected_version is null or p_expected_version<1 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception 'INVALID_ASSISTANCE_WITHDRAWAL'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request_id',r.id,'expected_version',p_expected_version));
 result:=private.begin_contract_command(r.organization_id,'client.assistance.withdraw.'||r.id::text,p_idempotency_key,h,a);
 if result is not null then return result;end if;
 if r.consent_revoked_at is not null then
  result:=jsonb_build_object('id',r.id,'status',r.status,'consent_revoked_at',r.consent_revoked_at,'row_version',r.row_version);
  perform private.finish_contract_command(r.organization_id,'client.assistance.withdraw.'||r.id::text,p_idempotency_key,result);return result;
 end if;
 if r.row_version is distinct from p_expected_version then raise exception 'STALE_ASSISTANCE'using errcode='40001';end if;
 if r.status not in('SUBMITTED','ASSIGNED','CLOSED')or r.consented_at is null then raise exception 'ASSISTANCE_NOT_SUBMITTED'using errcode='55000';end if;
 update public.client_assistance_requests set status='CLOSED',consent_revoked_at=clock_timestamp(),updated_at=clock_timestamp(),row_version=row_version+1 where id=r.id returning*into r;
 for work in select*from public.admin_work_items where resource_type='client_assistance_request'and resource_id=r.id::text and organization_id=r.organization_id and status in('OPEN','CLAIMED','WAITING_INFORMATION')for update loop
  update public.admin_work_items set status='RESOLVED',resolution_code='CONSENT_WITHDRAWN',resolution_reason='Retrait du consentement par le Client',resolution_evidence=jsonb_build_object('request_id',r.id),updated_at=clock_timestamp(),row_version=row_version+1 where id=work.id;
  insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(work.id,'CONSENT_WITHDRAWN',work.status,'RESOLVED',a,'Retrait du consentement par le Client',jsonb_build_object('request_id',r.id),p_correlation_id);
 end loop;
 result:=jsonb_build_object('id',r.id,'status',r.status,'consent_revoked_at',r.consent_revoked_at,'row_version',r.row_version);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,a,'USER','client.assistance.consent_withdrawn','client_assistance_request',r.id::text,p_correlation_id,jsonb_build_object('row_version',r.row_version),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(r.organization_id,'client_assistance_request',r.id::text,'ClientAssistanceConsentWithdrawnV1',p_correlation_id,jsonb_build_object('request_id',r.id),p_idempotency_key);
 perform private.finish_contract_command(r.organization_id,'client.assistance.withdraw.'||r.id::text,p_idempotency_key,result);return result;
end$$;
revoke all on function public.withdraw_client_assistance_consent(uuid,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.withdraw_client_assistance_consent(uuid,integer,text,uuid)to authenticated;
create or replace function public.authorize_client_assistance_document(p_request_id uuid,p_document_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare r public.client_assistance_requests%rowtype; d public.client_compliance_documents%rowtype;
begin
 select * into r from public.client_assistance_requests where id=p_request_id and status in('SUBMITTED','ASSIGNED','CLOSED')and consented_at is not null and consent_revoked_at is null and p_document_id=any(document_ids);
 if not found or not private.can_read_client_assistance(r.organization_id)then raise exception 'CLIENT_DOCUMENT_DENIED'using errcode='42501';end if;
 select * into d from public.client_compliance_documents d where d.id=p_document_id and d.organization_id=r.organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256);
 if not found then raise exception 'CLIENT_DOCUMENT_DENIED'using errcode='42501';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','client.assistance.document_downloaded','client_compliance_document',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('request_id',r.id,'version',d.version),repeat('0',64));
 return jsonb_build_object('outcome','CLIENT_DOCUMENT_AUTHORIZED','document_id',d.id,'bucket',d.storage_bucket,'object_path',d.storage_object_path,'file_name',d.original_file_name,'mime_type',d.declared_mime_type,'size_bytes',d.declared_size_bytes);
end$$;
commit;
