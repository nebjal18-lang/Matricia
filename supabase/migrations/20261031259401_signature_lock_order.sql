begin;
-- Every mutating signature path takes the same ordered party locks before row locks.
-- Read/auth first, acquire both financial locks, then re-read/authenticate/CAS.
create or replace function public.submit_contract_for_signature(p_contract_id uuid,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();c public.contracts%rowtype;v public.contract_versions%rowtype;e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;hash text;r jsonb;begin
 select*into c from public.contracts where id=p_contract_id;
 if actor is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'CONTRACT_SUBMIT_DENIED'using errcode='42501';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=p_contract_id for update;
 if actor is null or c.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'CONTRACT_SUBMIT_DENIED'using errcode='42501';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('contract_id',p_contract_id,'expected',p_expected_row_version));r:=private.begin_contract_command(c.client_organization_id,'contract.submit',p_idempotency_key,hash,actor);if r is not null then return r;end if;
 if c.status<>'DRAFT'or c.row_version<>p_expected_row_version then raise exception'INVALID_CONTRACT_TRANSITION'using errcode='55000';end if;
 p:=private.require_contract_signature_policy_v1('CONTRACT');select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 select*into e from public.signature_envelopes where contract_id=c.id and contract_version_id=v.id and amendment_id is null and provider_config_id=p.provider_config_id and status in('DRAFT','READY_FOR_SIGNATURE')order by envelope_version desc limit 1;
 if e.id is null then raise exception'SIGNATURE_ENVELOPE_REQUIRED'using errcode='55000';end if;
 if e.status='DRAFT'then perform public.ready_signature_envelope(e.id,e.row_version,'contract-ready:'||e.id::text,p_correlation_id);end if;
 perform private.assert_contract_signature_binding_v1(e.id,false);
 update public.contracts set status='PENDING_SIGNATURE',row_version=row_version+1,updated_at=clock_timestamp()where id=c.id;
 r:=jsonb_build_object('outcome','CONTRACT_PENDING_SIGNATURE','contract_id',c.id,'envelope_id',e.id,'row_version',c.row_version+1);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,actor,'USER','contract.submitted','contract',c.id::text,p_correlation_id,jsonb_build_object('envelope_id',e.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'contract',c.id::text,'ContractSignatureRequestedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(c.client_organization_id,'contract.submit',p_idempotency_key,r);return r;
end$$;

create or replace function public.submit_contract_amendment_for_signature(p_amendment_id uuid,p_expected_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();am public.contract_amendments%rowtype;c public.contracts%rowtype;e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;hash text;r jsonb;begin
 select*into am from public.contract_amendments where id=p_amendment_id;select*into c from public.contracts where id=am.contract_id;
 if actor is null or am.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'AMENDMENT_SUBMIT_AAL2_REQUIRED'using errcode='42501';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=am.contract_id for update;select*into am from public.contract_amendments where id=p_amendment_id for update;
 if actor is null or am.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'AMENDMENT_SUBMIT_AAL2_REQUIRED'using errcode='42501';end if;
 if p_expected_hash is distinct from am.content_hash then raise exception'STALE_AMENDMENT'using errcode='40001';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('amendment',am.id,'hash',p_expected_hash));r:=private.begin_contract_command(c.client_organization_id,'contract.amendment.submit.'||am.id::text,p_idempotency_key,hash,actor);if r is not null then return r;end if;
 if am.status<>'DRAFT'then raise exception'INVALID_AMENDMENT_SUBMIT_TRANSITION'using errcode='55000';end if;
 p:=private.require_contract_signature_policy_v1('AMENDMENT');select*into e from public.signature_envelopes where amendment_id=am.id and contract_version_id=am.base_contract_version_id and provider_config_id=p.provider_config_id and status in('DRAFT','READY_FOR_SIGNATURE')order by envelope_version desc limit 1;
 if e.id is null then raise exception'SIGNATURE_ENVELOPE_REQUIRED'using errcode='55000';end if;
 if e.status='DRAFT'then perform public.ready_signature_envelope(e.id,e.row_version,'amendment-ready:'||e.id::text,p_correlation_id);end if;perform private.assert_contract_signature_binding_v1(e.id,false);
 update public.contract_amendments set status='PENDING_SIGNATURE'where id=am.id;
 r:=jsonb_build_object('outcome','CONTRACT_AMENDMENT_PENDING_SIGNATURE','amendment_id',am.id,'contract_id',c.id,'envelope_id',e.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,actor,'USER','contract.amendment.submitted','contract_amendment',am.id::text,p_correlation_id,jsonb_build_object('content_hash',am.content_hash,'envelope_id',e.id),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'contract_amendment',am.id::text,'ContractAmendmentSignatureRequestedV1',p_correlation_id,r,p_idempotency_key);perform private.finish_contract_command(c.client_organization_id,'contract.amendment.submit.'||am.id::text,p_idempotency_key,r);return r;
end$$;

create or replace function public.ready_signature_envelope(p_envelope_id uuid,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();e public.signature_envelopes%rowtype;c public.contracts%rowtype;v public.contract_versions%rowtype;cfg public.signature_provider_configs%rowtype;r jsonb;
begin select * into e from public.signature_envelopes where id=p_envelope_id;select * into c from public.contracts where id=e.contract_id;
 if a is null or e.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)then raise exception'SIGNATURE_READY_DENIED'using errcode='42501';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);
 select*into c from public.contracts where id=e.contract_id for update;
 if a is null or e.id is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)then raise exception'SIGNATURE_READY_DENIED'using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id for update;select * into v from public.contract_versions where id=e.contract_version_id;select * into cfg from public.signature_provider_configs where id=e.provider_config_id;
 perform private.require_signature_environment_v1(cfg.environment,cfg.provider_code);
 if e.status<>'DRAFT'or e.row_version<>p_expected_row_version or v.version<>c.current_version then raise exception'INVALID_SIGNATURE_READY_TRANSITION'using errcode='55000';end if;
 if not(e.requested_level=any(cfg.supported_levels))then raise exception'SIGNATURE_LEVEL_NOT_SUPPORTED'using errcode='23514';end if;
 if (select count(*) from public.signature_signers where envelope_id=e.id)<2 or exists(select 1 from public.signature_signers s where s.envelope_id=e.id and not exists(select 1 from public.signature_signer_authorities q where q.signer_id=s.id and q.organization_id=s.organization_id and q.status='ACTIVE'and q.revoked_at is null and current_date between q.valid_from and coalesce(q.valid_until,'infinity'::date)and'CONTRACT_SIGNATURE'=any(q.authority_scope)and(q.amount_ceiling_minor is null or(q.currency=v.currency and q.amount_ceiling_minor>=v.price_minor))))then raise exception'SIGNER_AUTHORITY_REQUIRED'using errcode='23514';end if;
 update public.signature_envelopes set status='READY_FOR_SIGNATURE',ready_at=clock_timestamp(),row_version=row_version+1 where id=e.id;
 r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_READY','envelope_id',e.id,'row_version',e.row_version+1,'requested_level',e.requested_level);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,a,'USER','signature.envelope_ready','signature_envelope',e.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.client_organization_id,'signature_envelope',e.id::text,'SignatureEnvelopeReadyV1',p_correlation_id,r,p_idempotency_key);return r;end$$;

create or replace function public.process_verified_signature_provider_event(p_envelope_id uuid,p_provider_code text,p_provider_event_id text,p_nonce text,p_event_type text,p_signer_id uuid,p_provider_occurred_at timestamptz,p_payload_hash text,p_signature_fingerprint text,p_signature_verified boolean,p_achieved_level text,p_provider_evidence jsonb,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,auth,extensions set timezone='UTC' as $$
declare e public.signature_envelopes%rowtype;cfg public.signature_provider_configs%rowtype;old public.signature_provider_events%rowtype;s public.signature_signers%rowtype;cnt integer;total integer;r jsonb;ep uuid;actions jsonb;final_hash text;event_chain text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'SIGNATURE_EVENT_PROCESS_DENIED'using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;select * into cfg from public.signature_provider_configs where id=e.provider_config_id;
 perform private.lock_contract_financial_parties_v1((select client_organization_id from public.contracts where id=e.contract_id),(select provider_organization_id from public.contracts where id=e.contract_id));
 if e.id is null or cfg.provider_code<>p_provider_code or p_event_type not in('SENT','SIGNER_SIGNED','DECLINED','EXPIRED','FAILED','VOIDED')or p_payload_hash!~'^[0-9a-f]{64}$'or p_signature_fingerprint!~'^[0-9a-f]{64}$'or p_signature_verified is not true or abs(extract(epoch from(clock_timestamp()-p_provider_occurred_at)))>cfg.webhook_tolerance_seconds then raise exception'INVALID_VERIFIED_SIGNATURE_EVENT'using errcode='22023';end if;
 perform private.require_signature_environment_v1(cfg.environment,cfg.provider_code);
 perform pg_advisory_xact_lock(hashtextextended(p_provider_code||':'||p_provider_event_id,0));
 select * into old from public.signature_provider_events where provider_code=p_provider_code and provider_event_id=p_provider_event_id;
 if found then if old.envelope_id<>e.id or old.nonce<>p_nonce or old.event_type<>p_event_type or old.payload_hash<>p_payload_hash or old.signature_fingerprint<>p_signature_fingerprint then raise exception'SIGNATURE_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;return old.processing_result||jsonb_build_object('replayed',true);end if;
 if exists(select 1 from public.signature_provider_events where provider_code=p_provider_code and nonce=p_nonce)then raise exception'SIGNATURE_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id for update;
 if(p_event_type='SENT'and e.status<>'READY_FOR_SIGNATURE')or(p_event_type='SIGNER_SIGNED'and e.status not in('SENT','PARTIALLY_SIGNED'))then raise exception'INVALID_SIGNATURE_EVENT_TRANSITION'using errcode='55000';end if;
 if p_event_type in('SENT','SIGNER_SIGNED')then perform private.assert_contract_signature_binding_v1(e.id,false);if(e.amendment_id is null and not exists(select 1 from public.contracts where id=e.contract_id and status='PENDING_SIGNATURE'))or(e.amendment_id is not null and not exists(select 1 from public.contract_amendments where id=e.amendment_id and status='PENDING_SIGNATURE'))then raise exception'CONTRACT_SIGNATURE_SUBMISSION_REQUIRED'using errcode='55000';end if;end if;
 if p_event_type='SENT'then if e.status<>'READY_FOR_SIGNATURE'then raise exception'INVALID_SIGNATURE_EVENT_TRANSITION'using errcode='55000';end if;update public.signature_envelopes set status='SENT',provider_envelope_id=coalesce(nullif(p_provider_evidence->>'provider_envelope_id',''),provider_envelope_id),sent_at=p_provider_occurred_at,row_version=row_version+1 where id=e.id;r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_SENT','envelope_id',e.id,'replayed',false);
 elsif p_event_type='SIGNER_SIGNED'then
  if e.status not in('SENT','PARTIALLY_SIGNED')or p_signer_id is null then raise exception'INVALID_SIGNATURE_EVENT_TRANSITION'using errcode='55000';end if;
  if p_achieved_level is null or not(p_achieved_level=any(cfg.supported_levels))then raise exception'SIGNATURE_LEVEL_NOT_SUPPORTED'using errcode='23514';end if;
  select * into s from public.signature_signers where id=p_signer_id and envelope_id=e.id for update;if not found then raise exception'SIGNATURE_SIGNER_NOT_FOUND'using errcode='P0002';end if;
  if s.status<>'SIGNED'then update public.signature_signers set status='SIGNED',identity_verification_level=case p_achieved_level when'QUALIFIED'then'QUALIFIED'when'ADVANCED'then'STRONG'else'BASIC'end,signed_at=p_provider_occurred_at where id=s.id;end if;
  select count(*) into cnt from public.signature_signers where envelope_id=e.id and status='SIGNED';select count(*) into total from public.signature_signers where envelope_id=e.id;
  if cnt=total then
   if p_achieved_level<>e.requested_level then raise exception'QUALIFIED_LEVEL_NOT_ACHIEVED'using errcode='23514';end if;
   update public.signature_envelopes set status='SIGNED',achieved_level=p_achieved_level,completed_at=p_provider_occurred_at,row_version=row_version+1 where id=e.id;
   select jsonb_agg(jsonb_build_object('signer_id',x.id,'organization_id',x.organization_id,'signer_user_id',x.signer_user_id,'role',x.signer_role,'signed_at',x.signed_at)order by x.signing_order)into actions from public.signature_signers x where x.envelope_id=e.id;
   event_chain:=private.canonical_request_hash(jsonb_build_object('previous_events',(select coalesce(jsonb_agg(jsonb_build_object('provider_event_id',q.provider_event_id,'payload_hash',q.payload_hash)order by q.id),'[]')from public.signature_provider_events q where q.envelope_id=e.id),'current_event_id',p_provider_event_id,'current_payload_hash',p_payload_hash));
   final_hash:=private.canonical_request_hash(jsonb_build_object('envelope_id',e.id,'contract_version_id',e.contract_version_id,'pdf_sha256',e.document_set_hash,'signers',actions,'provider',p_provider_code,'level',p_achieved_level,'event_chain_hash',event_chain,'source_binding_hash',(select private.canonical_request_hash(to_jsonb(binding)-'bound_at')from private.contract_signature_bindings_v1 binding where envelope_id=e.id)));
   insert into public.signature_evidence_packages(source_binding_hash,envelope_id,contract_version_id,pdf_sha256,signer_actions_snapshot,consent_snapshot,provider_snapshot,event_chain_hash,verification_result,final_hash,correlation_id)values((select private.canonical_request_hash(to_jsonb(binding)-'bound_at')from private.contract_signature_bindings_v1 binding where envelope_id=e.id),e.id,e.contract_version_id,e.document_set_hash,actions,coalesce(p_provider_evidence->'consent','{}'),jsonb_build_object('provider_code',p_provider_code,'provider_config_version',cfg.version,'achieved_level',p_achieved_level,'provider_envelope_id',e.provider_envelope_id),event_chain,case when p_achieved_level='SIMPLE'then'VERIFIED_WITH_LIMITATIONS'else'VERIFIED'end,final_hash,p_correlation_id)returning id into ep;
   if p_provider_evidence?'certificate_fingerprint'then insert into public.signature_certificates(evidence_package_id,signer_id,provider_certificate_id,certificate_fingerprint,subject_hash,issuer_name,valid_from,valid_until,qualification_status,verification_status)values(ep,s.id,nullif(p_provider_evidence->>'certificate_id',''),p_provider_evidence->>'certificate_fingerprint',p_provider_evidence->>'certificate_subject_hash',nullif(p_provider_evidence->>'certificate_issuer',''),nullif(p_provider_evidence->>'certificate_valid_from','')::timestamptz,nullif(p_provider_evidence->>'certificate_valid_until','')::timestamptz,case when p_achieved_level='QUALIFIED'then'QUALIFIED'else'NOT_QUALIFIED'end,'VERIFIED');end if;
   if p_provider_evidence?'timestamp_token_hash'then insert into public.trusted_timestamps(evidence_package_id,signer_id,authority_name,token_hash,timestamped_at,verification_status)values(ep,s.id,coalesce(nullif(p_provider_evidence->>'timestamp_authority',''),'PROVIDER_TIMESTAMP'),p_provider_evidence->>'timestamp_token_hash',p_provider_occurred_at,'VERIFIED');end if;
   r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_SIGNED','envelope_id',e.id,'evidence_package_id',ep,'final_hash',final_hash,'achieved_level',p_achieved_level,'replayed',false);
  else update public.signature_envelopes set status='PARTIALLY_SIGNED',row_version=row_version+1 where id=e.id;r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_PARTIALLY_SIGNED','envelope_id',e.id,'signer_id',s.id,'signature_count',cnt,'replayed',false);end if;
 else
  if e.status not in('READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED')then raise exception'INVALID_SIGNATURE_EVENT_TRANSITION'using errcode='55000';end if;
  update public.signature_envelopes set status=p_event_type,completed_at=p_provider_occurred_at,row_version=row_version+1 where id=e.id;
  r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_'||p_event_type,'envelope_id',e.id,'replayed',false);
 end if;
 insert into public.signature_provider_events(envelope_id,provider_code,provider_event_id,nonce,event_type,provider_occurred_at,payload_hash,signature_fingerprint,signature_verified,processing_result,correlation_id)values(e.id,p_provider_code,p_provider_event_id,p_nonce,p_event_type,p_provider_occurred_at,p_payload_hash,p_signature_fingerprint,true,r,p_correlation_id);
 insert into public.signature_attempts(envelope_id,signer_id,attempt_type,outcome,provider_request_id,occurred_at,correlation_id,metadata)values(e.id,p_signer_id,case p_event_type when'SENT'then'SEND'when'SIGNER_SIGNED'then'SIGN'when'DECLINED'then'DECLINE'when'VOIDED'then'VOID'else'PROVIDER_CALLBACK'end,'SUCCEEDED',p_provider_event_id,p_provider_occurred_at,p_correlation_id,jsonb_build_object('event_type',p_event_type,'payload_hash',p_payload_hash));
 if r->>'outcome'='SIGNATURE_ENVELOPE_SIGNED'then perform private.complete_contract_signatures_from_envelope_v1(e.id,p_correlation_id);end if;
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,'SERVICE','signature.provider_event_processed','signature_envelope',e.id::text,p_correlation_id,r||jsonb_build_object('provider_event_id',p_provider_event_id,'event_type',p_event_type),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.client_organization_id,'signature_envelope',e.id::text,case when r->>'outcome'='SIGNATURE_ENVELOPE_SIGNED'then'SignatureEnvelopeSignedV1'else'SignatureEnvelopeTransitionedV1'end,p_correlation_id,r,p_provider_code||':'||p_provider_event_id);return r;
end$$;

create or replace function public.execute_signature_mock_step_v1(p_command_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare c private.signature_mock_commands_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;e public.signature_envelopes%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into c from private.signature_mock_commands_v1 where id=p_command_id;
 perform private.lock_contract_financial_parties_v1((select client_organization_id from public.contracts where id=(select contract_id from public.signature_envelopes where id=c.envelope_id)),(select provider_organization_id from public.contracts where id=(select contract_id from public.signature_envelopes where id=c.envelope_id)));
 select*into c from private.signature_mock_commands_v1 where id=p_command_id for update;select environment into env from private.admin_execution_environment_v1 where singleton;
 if c.id is null or env is null or env not in('DEVELOPMENT','STAGING')then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into e from public.signature_envelopes where id=c.envelope_id;
 perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),e.provider_code);
 select result into r from private.signature_mock_command_results_v1 where command_id=c.id;if found then return r||jsonb_build_object('replayed',true);end if;
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],c.requested_by)then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.id<>c.policy_version_id or p.governance_proposal_id is null or e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;

 if c.action='SENT'then select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;end if;
 if r is null then r:=public.run_mock_signature_provider(c.envelope_id,c.action,c.signer_id,'governed-mock:'||c.id::text,c.id);end if;
 insert into private.signature_mock_command_results_v1(command_id,result)values(c.id,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,c.requested_by,'SERVICE','signature.simulation.executed','signature_simulation',c.id::text,c.id,jsonb_build_object('envelope_id',e.id,'policy_version_id',p.id,'mode','NON_CONTRACTUAL_DEMO','step',c.action,'result',r),repeat('0',64));
 return r;
end$$;

create or replace function public.dispatch_governed_signature_envelope_v1(p_envelope_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_DISPATCH_DENIED'using errcode='42501';end if;
 select*into e from public.signature_envelopes where id=p_envelope_id;
 perform private.lock_contract_financial_parties_v1((select client_organization_id from public.contracts where id=e.contract_id),(select provider_organization_id from public.contracts where id=e.contract_id));
 select*into e from public.signature_envelopes where id=p_envelope_id for update;select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or env is null then raise exception'SIGNATURE_PROVIDER_NOT_CONFIGURED'using errcode='55000';end if;
 perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),e.provider_code);
 if e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_REAL_ADAPTER_VALIDATION_REQUIRED'using errcode='55000';end if;
 if env not in('DEVELOPMENT','STAGING')then raise exception'SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY'using errcode='42501';end if;
 if e.status='VOIDED'and exists(select 1 from private.contract_signature_bindings_v1 b join private.signature_policy_revocations_v1 revoked on revoked.policy_version_id=b.policy_version_id where b.envelope_id=e.id)then return jsonb_build_object('outcome','SIGNATURE_DISPATCH_CANCELLED','envelope_id',e.id,'development_mock',true);end if;
 select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;
 if r is not null then
  if not private.signature_recorded_send_is_valid_v1(e.id)then raise exception'SIGNATURE_RECORDED_SEND_UNVERIFIED'using errcode='23514';end if;
  if not exists(select 1 from private.contract_signature_bindings_v1 bound join private.contract_signature_policy_versions_v1 policy on policy.id=bound.policy_version_id where bound.envelope_id=e.id and policy.allow_development_mock and policy.governance_proposal_id is not null)then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
  return r||jsonb_build_object('replayed',true,'development_mock',true);end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.governance_proposal_id is null or e.provider_config_id<>p.provider_config_id then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
 return public.run_mock_signature_provider(e.id,'SENT',null,'governed-dispatch:'||e.id::text,e.id)||jsonb_build_object('development_mock',true);
end$$;

notify pgrst,'reload schema';
commit;
