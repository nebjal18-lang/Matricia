-- Request progress follows immutable selections, canonical drafts and verified
-- signature facts. It never follows a browser confirmation or a legacy status.
begin;
create function private.project_client_request_stage_v1(p_request_id uuid,p_stage text,p_source jsonb,p_actor uuid,p_correlation uuid)returns void language plpgsql security definer set search_path=pg_catalog,private as $$
declare request public.service_requests%rowtype;old_rank integer;new_rank integer;result jsonb;
begin
 if p_stage not in('PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED')then raise exception'INVALID_REQUEST_STAGE'using errcode='22023';end if;
 select*into request from public.service_requests where id=p_request_id for update;
 if request.id is null then raise exception'REQUEST_STAGE_SOURCE_MISSING'using errcode='23514';end if;
 old_rank:=case request.status when'PROVIDER_SELECTED'then 1 when'CONTRACT_PENDING'then 2 when'CONTRACTED'then 3 else 0 end;
 new_rank:=case p_stage when'PROVIDER_SELECTED'then 1 when'CONTRACT_PENDING'then 2 else 3 end;
 if old_rank>=new_rank then return;end if;
 if request.status in('CANCELLED','EXPIRED')and p_stage<>'CONTRACTED'then raise exception'REQUEST_CLOSED_TO_NEW_COMMITMENTS'using errcode='55000';end if;
 update public.service_requests set status=p_stage,row_version=row_version+1,updated_at=clock_timestamp()where id=request.id;
 result:=jsonb_build_object('request_id',request.id,'previous_status',request.status,'status',p_stage,'source',p_source,'row_version',request.row_version+1);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(request.client_organization_id,p_actor,case when p_actor is null then'SERVICE'else'USER'end,'rfq.request.stage_projected','service_request',request.id::text,p_correlation,result,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(request.client_organization_id,'service_request',request.id::text,'ServiceRequestStageChangedV1',p_correlation,result);
end$$;
create function private.project_selected_quote_request_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare request_id uuid;client_id uuid;correlation uuid;
begin
 select r.request_id,s.client_organization_id into request_id,client_id from public.rfqs r join public.service_requests s on s.id=r.request_id join public.quotes q on q.rfq_id=r.id and q.id=new.selected_quote_id and q.status='SELECTED'and q.selected_version_id=new.selected_quote_version_id where r.id=new.rfq_id;
 if request_id is null or client_id is distinct from new.client_organization_id then raise exception'SELECTION_REQUEST_SOURCE_MISMATCH'using errcode='23514';end if;
 select correlation_id into correlation from public.audit_events where action='quote.selected'and resource_id=new.selected_quote_id::text order by occurred_at desc,id desc limit 1;
 perform private.project_client_request_stage_v1(request_id,'PROVIDER_SELECTED',jsonb_build_object('kind','QUOTE_SELECTION_DECISION','rfq_id',new.rfq_id,'quote_id',new.selected_quote_id,'quote_version_id',new.selected_quote_version_id),new.created_by,coalesce(correlation,extensions.gen_random_uuid()));return new;
end$$;
create trigger selected_quote_projects_request after insert on public.quote_selection_decisions for each row execute function private.project_selected_quote_request_v1();
create function private.project_drafted_contract_request_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private,extensions as $$begin
 perform private.project_client_request_stage_v1(new.request_id,'CONTRACT_PENDING',jsonb_build_object('kind','CANONICAL_CONTRACT_DRAFT','contract_id',new.contract_id,'contract_version_id',new.contract_version_id,'quote_version_id',new.quote_version_id),new.created_by,extensions.gen_random_uuid());return new;
end$$;
create trigger canonical_contract_projects_request after insert on public.selected_quote_contract_drafts_v1 for each row execute function private.project_drafted_contract_request_v1();
create function private.project_signed_contract_request_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare binding public.selected_quote_contract_drafts_v1%rowtype;contract_ref uuid;version_ref uuid;envelope_ref uuid;
begin
 if new.event_type<>'ContractSignedV1'then return new;end if;
 contract_ref:=nullif(new.payload->>'contract_id','')::uuid;version_ref:=nullif(new.payload->>'contract_version_id','')::uuid;envelope_ref:=nullif(new.payload->>'envelope_id','')::uuid;
 select*into binding from public.selected_quote_contract_drafts_v1 where contract_id=contract_ref and contract_version_id=version_ref;
 if binding.quote_version_id is null then return new;end if;
 if envelope_ref is null or not private.contract_version_signature_effective_v1(binding.contract_id,binding.contract_version_id)or not exists(select 1 from public.signature_envelopes e join public.signature_evidence_packages ep on ep.envelope_id=e.id where e.id=envelope_ref and e.contract_id=binding.contract_id and e.contract_version_id=binding.contract_version_id and e.status='SIGNED'and ep.id::text=new.payload->>'evidence_package_id')then raise exception'CONTRACT_SIGNATURE_PROGRESS_SOURCE_REQUIRED'using errcode='55000';end if;
 perform private.project_client_request_stage_v1(binding.request_id,'CONTRACTED',jsonb_build_object('kind','VERIFIED_SIGNATURE_ENVELOPE','contract_id',binding.contract_id,'contract_version_id',binding.contract_version_id,'envelope_id',envelope_ref,'evidence_package_id',new.payload->>'evidence_package_id'),null,new.correlation_id);return new;
end$$;
create trigger signed_contract_projects_request after insert on public.event_outbox for each row when(new.event_type='ContractSignedV1')execute function private.project_signed_contract_request_v1();
-- Only the public comparison/reason command can select an offer. The existing
-- primitive remains callable by its definer, not directly by authenticated users.
revoke execute on function public.select_quote(uuid,uuid,text,uuid)from authenticated,anon,service_role,public;
do $$declare definition text;target text;begin
 select pg_get_functiondef('public.select_quote_and_notify(uuid,uuid,text,uuid,text,uuid)'::regprocedure)into definition;
 target:='  select * into snapshot from public.quote_comparison_snapshots where id = p_comparison_snapshot_id;';
 if strpos(definition,target)=0 then raise exception'SELECT_QUOTE_AUTH_SCOPE_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'  if auth.jwt()->>''aal''is distinct from''aal2''or not exists(select 1 from public.rfqs r join public.service_requests sr on sr.id=r.request_id where r.id=quote.rfq_id and private.has_org_role(sr.client_organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'',''CLIENT_BUYER'']))then raise exception''QUOTE_CLIENT_SCOPE_DENIED''using errcode=''42501'';end if;'||chr(10)||target);
 target:='  response := public.select_quote(p_quote_id, p_expected_version_id, p_idempotency_key, p_correlation_id);';
 if strpos(definition,target)=0 then raise exception'SELECT_QUOTE_LOCK_ORDER_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'  perform private.lock_contract_financial_parties_v1(snapshot.client_organization_id,quote.provider_organization_id);
  perform pg_advisory_xact_lock(hashtextextended(''service-request:''||(select request_id::text from public.rfqs where id=quote.rfq_id),0));
  perform 1 from public.service_requests sr join public.rfqs r on r.request_id=sr.id where r.id=quote.rfq_id for update of sr;
  if not private.subscription_financially_clear(snapshot.client_organization_id)or not private.client_identity_allows_new_operations(snapshot.client_organization_id)then raise exception''CLIENT_NEW_COMMITMENT_NOT_ALLOWED''using errcode=''55000'';end if;
  if exists(select 1 from public.rfqs r join public.service_requests sr on sr.id=r.request_id where r.id=quote.rfq_id and(sr.status in(''CANCELLED'',''EXPIRED'')or r.status=''CANCELLED''))then raise exception''REQUEST_CLOSED_TO_NEW_COMMITMENTS''using errcode=''55000'';end if;
'||target);
 execute definition;
end$$;
-- New effects require an effective signed version in the trusted deployment.
-- Historical reads and already-existing obligations are not reclassified.
do $$declare definition text;target text;begin
 select pg_get_functiondef('public.create_mission(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)'::regprocedure)into definition;
 target:=' r:=public.create_mission_legacy_0191(p_contract_id';
 if strpos(definition,target)=0 then raise exception'MISSION_SIGNATURE_EFFECTIVE_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'if auth.uid()is null or auth.jwt()->>''aal''is distinct from''aal2''or not exists(select 1 from public.contracts c where c.id=p_contract_id and private.has_org_role(c.client_organization_id,array[''CLIENT_OWNER'',''CLIENT_ADMIN'']))then raise exception''MISSION_CREATE_DENIED''using errcode=''42501'';end if;if not private.contract_version_signature_effective_v1(p_contract_id,p_contract_version_id)then raise exception''CONTRACT_SIGNATURE_NOT_EFFECTIVE_IN_DEPLOYMENT''using errcode=''55000'';end if;'||target);execute definition;
 select pg_get_functiondef('public.create_contract_amendment(uuid,text,jsonb,bigint,integer,jsonb,jsonb,text,uuid)'::regprocedure)into definition;
 target:='h:=private.canonical_request_hash(jsonb_build_object(''contract'',c.id,''reason'',p_reason';
 if strpos(definition,target)=0 then raise exception'AMENDMENT_SIGNATURE_EFFECTIVE_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,target,'if not private.contract_version_signature_effective_v1(c.id,v)then raise exception''CONTRACT_SIGNATURE_NOT_EFFECTIVE_IN_DEPLOYMENT''using errcode=''55000'';end if;'||target);execute definition;
end$$;
create function public.verify_service_request_stage_event_v1(p_event_id bigint,p_request_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$declare event public.event_outbox%rowtype;actual text;begin
 if auth.role()is distinct from'service_role'then raise exception'REQUEST_STAGE_EVENT_VERIFICATION_DENIED'using errcode='42501';end if;
 select*into event from public.event_outbox where id=p_event_id and event_type='ServiceRequestStageChangedV1'and aggregate_id=p_request_id::text;
 if event.id is null then return false;end if;
 select status into actual from public.service_requests where id=p_request_id;
 return actual is not null and exists(select 1 from public.audit_events where action='rfq.request.stage_projected'and resource_id=p_request_id::text and correlation_id=event.correlation_id and metadata=event.payload);
end$$;
revoke all on function private.project_client_request_stage_v1(uuid,text,jsonb,uuid,uuid),private.project_selected_quote_request_v1(),private.project_drafted_contract_request_v1(),private.project_signed_contract_request_v1(),public.verify_service_request_stage_event_v1(bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.verify_service_request_stage_event_v1(bigint,uuid)to service_role;
notify pgrst,'reload schema';
commit;
