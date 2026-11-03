begin;
-- A browser submits references, never an authoritative hash or storage path.
create function private.dispute_evidence_party_v1(p_case uuid,p_org uuid default null) returns uuid
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.dispute_cases%rowtype; chosen uuid;
begin
 select * into d from public.dispute_cases where id=p_case;
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or d.id is null then raise exception 'DISPUTE_EVIDENCE_DENIED' using errcode='42501';end if;
 if (p_org is null or p_org=d.client_organization_id) and private.has_org_role(d.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then chosen:=d.client_organization_id;
 elsif (p_org is null or p_org=d.provider_organization_id) and private.has_org_role(d.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'])then chosen:=d.provider_organization_id;
 else raise exception 'DISPUTE_EVIDENCE_DENIED' using errcode='42501';end if;
 return chosen;
end$$;
create function private.canonical_party_dispute_evidence_v1(p_case uuid,p_org uuid,p_items jsonb) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.dispute_cases%rowtype; item jsonb; result jsonb:='[]'; visibility text;
 doc public.provider_document_versions%rowtype; msg public.internal_messages%rowtype; proof public.delivery_proofs%rowtype; canonical jsonb;
begin
 perform private.dispute_evidence_party_v1(p_case,p_org);
 select * into d from public.dispute_cases where id=p_case;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)not between 1 and 20 then raise exception 'DISPUTE_EVIDENCE_REQUIRED' using errcode='22023';end if;
 for item in select * from jsonb_array_elements(p_items)loop
  visibility:=item->>'visibility';
  if visibility is null or visibility not in('BOTH_PARTIES','MEDIATOR_ONLY',case when p_org=d.provider_organization_id then 'PROVIDER_ONLY'else 'CLIENT_ONLY'end)then raise exception 'INVALID_EVIDENCE_VISIBILITY' using errcode='22023';end if;
  if item->>'type'='DOCUMENT' and p_org=d.client_organization_id then
   canonical:=private.canonical_client_dispute_evidence_v1(p_org,jsonb_build_array(item));result:=result||canonical;
  elsif item->>'type'='DOCUMENT' then
   select * into doc from public.provider_document_versions where id=(item#>>'{metadata,source_document_id}')::uuid and provider_organization_id=p_org and status='VERIFIED'and(expires_on is null or expires_on>=current_date);
   if doc.id is null or not private.provider_document_is_clean(doc.storage_object_path,doc.content_hash)then raise exception 'DISPUTE_DOCUMENT_NOT_REUSABLE' using errcode='42501';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type','DOCUMENT','statement',coalesce(doc.metadata->>'original_file_name',doc.reference_number,'Document'),'storage_path',doc.storage_object_path,'hash',doc.content_hash,'visibility',visibility,'metadata',jsonb_build_object('source_provider_document_id',doc.id,'source_organization_id',p_org,'document_version',doc.version_number)));
  elsif item->>'type'='MESSAGE'and item#>>'{metadata,source_message_id}'is not null then
   select m.* into msg from public.internal_messages m join public.internal_message_threads t on t.id=m.thread_id
   join public.contract_versions cv on cv.id=d.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.quotes q on q.id=qv.quote_id
   where m.id=(item#>>'{metadata,source_message_id}')::uuid and t.object_id=q.rfq_id and t.provider_organization_id=d.provider_organization_id and t.client_organization_id=d.client_organization_id and private.can_access_internal_message_thread(t.id);
   if msg.id is null then raise exception 'DISPUTE_MESSAGE_NOT_REUSABLE' using errcode='42501';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type','MESSAGE','statement',msg.body,'hash',encode(extensions.digest(convert_to(msg.body,'UTF8'),'sha256'),'hex'),'visibility',visibility,'metadata',jsonb_build_object('source_message_id',msg.id,'source_thread_id',msg.thread_id,'source_created_at',msg.created_at,'source_organization_id',p_org)));
  elsif item->>'type'='DELIVERY_PROOF'then
   select p.* into proof from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id join public.deliverables dl on dl.id=v.deliverable_id
   where p.id=(item#>>'{metadata,source_delivery_proof_id}')::uuid and dl.mission_id=d.mission_id and private.mission_party_access(dl.mission_id)
   and ((p.storage_path is null and p.url is not null)or(p.scan_status='CLEAN'and exists(select 1 from private.delivery_proof_scan_results s where s.id=p.current_scan_result_id and s.proof_id=p.id and s.result='CLEAN'and s.computed_sha256=p.evidence_hash)));
   if proof.id is null then raise exception 'DISPUTE_DELIVERY_PROOF_NOT_REUSABLE'using errcode='42501';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type','DELIVERY_PROOF','statement',coalesce(proof.metadata->>'file_name',proof.metadata->>'original_file_name',proof.url,'Livraison'),'storage_path',proof.storage_path,'url',proof.url,'hash',proof.evidence_hash,'visibility',visibility,'metadata',jsonb_build_object('source_delivery_proof_id',proof.id,'source_delivery_version_id',proof.delivery_version_id,'source_organization_id',p_org)));
  elsif item->>'type'='MESSAGE'and length(btrim(coalesce(item->>'statement','')))between 1 and 4000 then
   result:=result||jsonb_build_array(jsonb_build_object('type','MESSAGE','statement',btrim(item->>'statement'),'hash',encode(extensions.digest(convert_to(btrim(item->>'statement'),'UTF8'),'sha256'),'hex'),'visibility',visibility,'metadata',jsonb_build_object('source_organization_id',p_org)));
  else raise exception 'INVALID_DISPUTE_EVIDENCE_SOURCE'using errcode='22023';end if;
 end loop;
 return result;
end$$;
create function public.get_dispute_evidence_context_v1(p_case_id uuid,p_party text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare d public.dispute_cases%rowtype;org uuid;docs jsonb;msgs jsonb;proofs jsonb;
begin
 select * into d from public.dispute_cases where id=p_case_id;
 if p_party not in('client','provider')or p_party is null then raise exception 'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
 org:=private.dispute_evidence_party_v1(d.id,case when p_party='provider'then d.provider_organization_id else d.client_organization_id end);
 if p_party='provider'then
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',coalesce(v.metadata->>'original_file_name',v.reference_number,f.code))order by v.created_at desc,v.id),'[]')into docs
  from public.provider_document_versions v join public.provider_document_families f on f.id=v.family_id
  where v.provider_organization_id=org and v.status='VERIFIED'and(v.expires_on is null or v.expires_on>=current_date)and private.provider_document_is_clean(v.storage_object_path,v.content_hash)
  and not exists(select 1 from public.provider_document_versions newer where newer.family_id=v.family_id and newer.version_number>v.version_number);
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.original_file_name)order by v.created_at desc,v.id),'[]')into docs from public.client_compliance_documents v
  where v.organization_id=org and v.status='VERIFIED'and v.scan_status='CLEAN'and(v.expires_on is null or v.expires_on>=current_date)
  and exists(select 1 from private.client_document_scan_results s where s.id=v.current_scan_result_id and s.document_id=v.id and s.result='CLEAN'and s.computed_sha256=v.declared_sha256);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',left(m.body,160))order by m.created_at desc,m.id),'[]')into msgs from public.internal_messages m join public.internal_message_threads t on t.id=m.thread_id
 join public.contract_versions cv on cv.id=d.contract_version_id join public.quote_versions qv on qv.id=cv.selected_quote_version_id join public.quotes q on q.id=qv.quote_id
 where t.object_id=q.rfq_id and t.provider_organization_id=d.provider_organization_id and t.client_organization_id=d.client_organization_id and private.can_access_internal_message_thread(t.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.metadata->>'original_file_name',p.metadata->>'file_name',v.description),'version',v.version)order by v.submitted_at desc,p.id),'[]')into proofs
 from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id join public.deliverables dl on dl.id=v.deliverable_id
 where dl.mission_id=d.mission_id and private.mission_party_access(dl.mission_id)and ((p.storage_path is null and p.url is not null)or(p.scan_status='CLEAN'and exists(select 1 from private.delivery_proof_scan_results s where s.id=p.current_scan_result_id and s.proof_id=p.id and s.result='CLEAN'and s.computed_sha256=p.evidence_hash)));
 return jsonb_build_object('organizationId',org,'party',p_party,'documents',docs,'messages',msgs,'deliveries',proofs);
end$$;
-- A response retry after the committed state transition must reach its existing
-- command receipt before enforcing the state precondition for a NEW operation.
do $$declare def text; needle text:='if d.status<>''WARNING_LEVEL_1''or p_response_type';begin
 def:=pg_get_functiondef('public.respond_to_mission_dispute(uuid,text,text,jsonb,text,uuid)'::regprocedure);
 if strpos(def,needle)=0 then raise exception 'DISPUTE_RESPONSE_RETRY_DEFINITION_CHANGED';end if;
 execute replace(def,needle,'if p_response_type');
end$$;
do $$declare def text; needle text:='if d.status<>''DECIDED''or clock_timestamp()>d.appeal_due_at or length'; guard text:='select id into dec from public.dispute_decisions';begin
 def:=pg_get_functiondef('public.appeal_mission_dispute(uuid,text,jsonb,text,uuid)'::regprocedure);
 if strpos(def,needle)=0 or strpos(def,guard)=0 then raise exception 'DISPUTE_APPEAL_RETRY_DEFINITION_CHANGED';end if;
 if strpos(def,'org:=case when private.is_active_org_member(d.client_organization_id,a)then d.client_organization_id else d.provider_organization_id end;')=0 then raise exception 'DISPUTE_APPEAL_PARTY_DEFINITION_CHANGED';end if;
 def:=replace(def,'org:=case when private.is_active_org_member(d.client_organization_id,a)then d.client_organization_id else d.provider_organization_id end;',$party$org:=private.dispute_evidence_party_v1(d.id,nullif(p_evidence#>>'{0,metadata,source_organization_id}','')::uuid);$party$);
 def:=replace(def,needle,'if length');
 def:=replace(def,guard,'select * into d from public.dispute_cases where id=d.id for update;if d.status<>''DECIDED''or d.appeal_due_at is null or clock_timestamp()>d.appeal_due_at then raise exception ''INVALID_DISPUTE_APPEAL''using errcode=''22023'';end if;'||guard);
 execute def;
end$$;
-- Retain original CAS, immutable response/appeal, audit and Outbox. Direct legacy
-- entry points are revoked; callers cannot forge an alternative evidence path.
alter function public.respond_to_mission_dispute(uuid,text,text,jsonb,text,uuid)rename to respond_to_mission_dispute_legacy_0441;
alter function public.appeal_mission_dispute(uuid,text,jsonb,text,uuid)rename to appeal_mission_dispute_legacy_0441;
revoke all on function public.respond_to_mission_dispute_legacy_0441(uuid,text,text,jsonb,text,uuid),public.appeal_mission_dispute_legacy_0441(uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
create function public.respond_to_mission_dispute(p_dispute_case_id uuid,p_response_type text,p_statement text,p_evidence jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;client_org uuid;canonical jsonb;request_hash text;cached jsonb;result jsonb;scope text;
begin
 select provider_organization_id,client_organization_id into org,client_org from public.dispute_cases where id=p_dispute_case_id;
 perform private.dispute_evidence_party_v1(p_dispute_case_id,org);
 scope:='dispute.respond.refs.'||p_dispute_case_id::text||'.'||auth.uid()::text;
 request_hash:=private.canonical_request_hash(jsonb_build_object('type',p_response_type,'statement',p_statement,'evidence',p_evidence));
 cached:=private.begin_contract_command(client_org,scope,p_idempotency_key,request_hash,auth.uid());
 if cached is not null then return cached;end if;
 canonical:=private.canonical_party_dispute_evidence_v1(p_dispute_case_id,org,p_evidence);
 result:=public.respond_to_mission_dispute_legacy_0441(p_dispute_case_id,p_response_type,p_statement,canonical,p_idempotency_key,p_correlation_id);
 perform private.finish_contract_command(client_org,scope,p_idempotency_key,result);return result;
end$$;
create function public.appeal_mission_dispute(p_dispute_case_id uuid,p_grounds text,p_evidence jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare org uuid;client_org uuid;canonical jsonb;request_hash text;cached jsonb;result jsonb;scope text;
begin
 org:=private.dispute_evidence_party_v1(p_dispute_case_id,nullif(p_evidence#>>'{0,metadata,source_organization_id}','')::uuid);
 select client_organization_id into client_org from public.dispute_cases where id=p_dispute_case_id;
 scope:='dispute.appeal.refs.'||p_dispute_case_id::text||'.'||auth.uid()::text;
 request_hash:=private.canonical_request_hash(jsonb_build_object('grounds',p_grounds,'evidence',p_evidence));
 cached:=private.begin_contract_command(client_org,scope,p_idempotency_key,request_hash,auth.uid());
 if cached is not null then return cached;end if;
 canonical:=private.canonical_party_dispute_evidence_v1(p_dispute_case_id,org,p_evidence);
 result:=public.appeal_mission_dispute_legacy_0441(p_dispute_case_id,p_grounds,canonical,p_idempotency_key,p_correlation_id);
 perform private.finish_contract_command(client_org,scope,p_idempotency_key,result);return result;
end$$;
revoke all on function private.dispute_evidence_party_v1(uuid,uuid),private.canonical_party_dispute_evidence_v1(uuid,uuid,jsonb),public.get_dispute_evidence_context_v1(uuid,text),public.respond_to_mission_dispute(uuid,text,text,jsonb,text,uuid),public.appeal_mission_dispute(uuid,text,jsonb,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_dispute_evidence_context_v1(uuid,text),public.respond_to_mission_dispute(uuid,text,text,jsonb,text,uuid),public.appeal_mission_dispute(uuid,text,jsonb,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
