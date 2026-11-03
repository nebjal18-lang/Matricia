begin;
-- Dispute deadlines are taken from the approved template frozen into the signed
-- contract, never entered by a Client. Missing contractual policy stays blocked.
create function private.client_contract_dispute_policy_v1(p_version uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare cv public.contract_versions%rowtype;t public.contract_policy_versions_v1%rowtype;p jsonb;k text;
begin
 select*into cv from public.contract_versions where id=p_version;
 if coalesce(cv.clauses->>'template_policy_version_id','')!~*'^[0-9a-f-]{36}$'then raise exception'CONTRACT_DISPUTE_POLICY_REQUIRED'using errcode='55000';end if;
 select*into t from public.contract_policy_versions_v1 where id=(cv.clauses->>'template_policy_version_id')::uuid and kind='TEMPLATE';
 if t.id is null or(cv.clauses-array['template_policy_version_id','template_code','template_version','template_content_hash','approval_reference'])is distinct from(t.data->'clauses')or not exists(select 1 from public.contract_policy_decisions_v1 d where d.policy_version_id=t.id and d.decision='APPROVE'and d.content_hash=t.content_hash and d.decided_by<>t.created_by)then raise exception'CONTRACT_DISPUTE_POLICY_REQUIRED'using errcode='55000';end if;
 p:=t.data#>'{clauses,dispute_policy}';
 if jsonb_typeof(p)is distinct from'object'or length(btrim(coalesce(p->>'version','')))not between 1 and 80 then raise exception'CONTRACT_DISPUTE_POLICY_REQUIRED'using errcode='55000';end if;
 foreach k in array array['response_hours','urgent_response_hours','correction_business_days','review_business_days','appeal_hours']loop
  if coalesce(p->>k,'')!~'^[1-9][0-9]{0,4}$'then raise exception'CONTRACT_DISPUTE_POLICY_REQUIRED'using errcode='55000';end if;
 end loop;
 return(p-'content_hash')||jsonb_build_object('content_hash',private.canonical_request_hash(p-'content_hash'),'template_policy_version_id',t.id,'contract_version_id',cv.id);
end$$;
revoke all on function private.client_contract_dispute_policy_v1(uuid)from public,anon,authenticated,service_role;

create function public.get_client_dispute_open_context_v1(p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare m public.missions%rowtype;policy_ready boolean;missions jsonb:='[]';obligations jsonb;docs jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'DISPUTE_OPEN_DENIED'using errcode='42501';end if;
 for m in select*from public.missions where client_organization_id=p_organization_id and status in('ACTIVE','DELIVERY_SUBMITTED','ACCEPTANCE_IN_PROGRESS')order by created_at desc,id loop
  policy_ready:=true;
  begin perform private.client_contract_dispute_policy_v1(m.contract_version_id);exception when sqlstate'55000'then policy_ready:=false;end;
  select coalesce(jsonb_agg(jsonb_build_object('key',item_key,'label_fr',label_fr,'label_ar',label_ar)order by sort_order,id),'[]')into obligations from public.contract_items where contract_version_id=m.contract_version_id and item_type in('DELIVERABLE','ACCEPTANCE_CRITERION','CORRECTION');
  missions:=missions||jsonb_build_array(jsonb_build_object('id',m.id,'status',m.status,'policy_ready',policy_ready,'obligations',obligations));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.original_file_name)order by d.created_at desc,d.id),'[]')into docs from public.client_compliance_documents d where d.organization_id=p_organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256);
 return jsonb_build_object('organization_id',p_organization_id,'missions',missions,'documents',docs);
end$$;

create function private.canonical_client_dispute_evidence_v1(p_org uuid,p_evidence jsonb)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare x jsonb;d public.client_compliance_documents%rowtype;result jsonb:='[]';visibility text;
begin
 if jsonb_typeof(p_evidence)is distinct from'array'or jsonb_array_length(p_evidence)not between 1 and 20 then raise exception'DISPUTE_EVIDENCE_REQUIRED'using errcode='22023';end if;
 for x in select*from jsonb_array_elements(p_evidence)loop
  visibility:=x->>'visibility';if visibility is null or visibility not in('BOTH_PARTIES','CLIENT_ONLY','MEDIATOR_ONLY')then raise exception'INVALID_EVIDENCE_VISIBILITY'using errcode='22023';end if;
  if x->>'type'='DOCUMENT'then
   select*into d from public.client_compliance_documents where id=(x#>>'{metadata,source_document_id}')::uuid and organization_id=p_org and status='VERIFIED'and scan_status='CLEAN'and(expires_on is null or expires_on>=current_date);
   if d.id is null or not exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=p_org and s.result='CLEAN'and s.computed_sha256=d.declared_sha256)then raise exception'DISPUTE_DOCUMENT_NOT_REUSABLE'using errcode='42501';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type','DOCUMENT','statement',d.original_file_name,'storage_path',d.storage_object_path,'hash',d.declared_sha256,'visibility',visibility,'metadata',jsonb_build_object('source_document_id',d.id,'document_version',d.version,'file_name',d.original_file_name)));
  elsif x->>'type'='MESSAGE'and length(btrim(coalesce(x->>'statement','')))between 1 and 4000 then
   result:=result||jsonb_build_array(jsonb_build_object('type','MESSAGE','statement',btrim(x->>'statement'),'hash',encode(extensions.digest(convert_to(btrim(x->>'statement'),'UTF8'),'sha256'),'hex'),'visibility',visibility,'metadata','{}'::jsonb));
  else raise exception'INVALID_CLIENT_DISPUTE_EVIDENCE'using errcode='22023';end if;
 end loop;
 return result;
end$$;
revoke all on function private.canonical_client_dispute_evidence_v1(uuid,jsonb)from public,anon,authenticated,service_role;

alter function public.open_mission_dispute(uuid,text,text,text,jsonb,jsonb,text,uuid)rename to open_mission_dispute_legacy_client_0220;
revoke all on function public.open_mission_dispute_legacy_client_0220(uuid,text,text,text,jsonb,jsonb,text,uuid)from public,anon,authenticated,service_role;
create function public.open_mission_dispute(p_mission_id uuid,p_obligation_key text,p_description text,p_urgency text,p_policy_snapshot jsonb,p_evidence jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare m public.missions%rowtype;policy jsonb;evidence jsonb;
begin
 select*into m from public.missions where id=p_mission_id for update;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or m.id is null or not private.has_org_role(m.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])then raise exception'DISPUTE_OPEN_DENIED'using errcode='42501';end if;
 if not exists(select 1 from public.contract_items where contract_version_id=m.contract_version_id and item_key=p_obligation_key and item_type in('DELIVERABLE','ACCEPTANCE_CRITERION','CORRECTION'))then raise exception'DISPUTE_OBLIGATION_OUTSIDE_CONTRACT'using errcode='22023';end if;
 policy:=private.client_contract_dispute_policy_v1(m.contract_version_id);
 if p_policy_snapshot is not null and p_policy_snapshot is distinct from policy then raise exception'DISPUTE_POLICY_FROM_CONTRACT_REQUIRED'using errcode='22023';end if;
 evidence:=private.canonical_client_dispute_evidence_v1(m.client_organization_id,p_evidence);
 return public.open_mission_dispute_legacy_client_0220(m.id,p_obligation_key,p_description,p_urgency,policy,evidence,p_idempotency_key,p_correlation_id);
end$$;

create function public.open_client_contract_dispute_v1(p_mission_id uuid,p_obligation_key text,p_description text,p_urgency text,p_document_ids uuid[],p_statement text,p_visibility text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare items jsonb;doc uuid;
begin
 if coalesce(cardinality(p_document_ids),0)not between 1 and 19 or(select count(*)<>count(distinct x)from unnest(p_document_ids)x)then raise exception'DISPUTE_DOCUMENT_REQUIRED'using errcode='22023';end if;
 items:=jsonb_build_array(jsonb_build_object('type','MESSAGE','statement',p_statement,'visibility',p_visibility));
 foreach doc in array p_document_ids loop items:=items||jsonb_build_array(jsonb_build_object('type','DOCUMENT','visibility',p_visibility,'metadata',jsonb_build_object('source_document_id',doc)));end loop;
 return public.open_mission_dispute(p_mission_id,p_obligation_key,p_description,p_urgency,null,items,p_idempotency_key,p_correlation_id);
end$$;

create function public.authorize_client_dispute_attachment_v1(p_evidence_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare e public.dispute_evidence%rowtype;d public.client_compliance_documents%rowtype;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.dispute_evidence_access(p_evidence_id)then raise exception'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
 select*into e from public.dispute_evidence where id=p_evidence_id and evidence_type='DOCUMENT';
 select*into d from public.client_compliance_documents where id=(e.metadata->>'source_document_id')::uuid and status='VERIFIED'and scan_status='CLEAN'and storage_object_path=e.storage_path and declared_sha256=e.evidence_hash;
 if d.id is null or not exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256)then raise exception'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
 return jsonb_build_object('evidence_id',e.id,'bucket',d.storage_bucket,'object_path',d.storage_object_path,'file_name',d.original_file_name,'mime_type',d.declared_mime_type,'size_bytes',d.declared_size_bytes::text,'sha256',d.declared_sha256);
end$$;
revoke all on function public.get_client_dispute_open_context_v1(uuid),public.open_mission_dispute(uuid,text,text,text,jsonb,jsonb,text,uuid),public.open_client_contract_dispute_v1(uuid,text,text,text,uuid[],text,text,text,uuid),public.authorize_client_dispute_attachment_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_dispute_open_context_v1(uuid),public.open_mission_dispute(uuid,text,text,text,jsonb,jsonb,text,uuid),public.open_client_contract_dispute_v1(uuid,text,text,text,uuid[],text,text,text,uuid),public.authorize_client_dispute_attachment_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
