-- Bind signature execution to the database owner's deployment tag, never a caller hint.
create function private.require_signature_environment_v1(p_environment text,p_provider_code text)returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare actual text;
begin
 select environment into actual from private.admin_execution_environment_v1 where singleton;
 if actual is null then raise exception'SIGNATURE_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 if p_environment is distinct from actual or(p_provider_code='MATRICIA_DEV_MOCK'and actual not in('DEVELOPMENT','STAGING'))then raise exception'SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
end$$;
revoke all on function private.require_signature_environment_v1(text,text)from public,anon,authenticated,service_role;
-- The mock has no remote endpoint, is always SIMPLE-only and requires explicit non-production config.
do $$declare c text;begin
 for c in select conname from pg_constraint where conrelid='public.signature_provider_configs'::regclass and contype='c'and pg_get_constraintdef(oid)like'%endpoint_base_url%'loop execute format('alter table public.signature_provider_configs drop constraint %I',c);end loop;
end$$;
alter table public.signature_provider_configs add constraint signature_provider_environment_mode check(
 (provider_code='MATRICIA_DEV_MOCK'and environment in('DEVELOPMENT','STAGING')and supported_levels=array['SIMPLE']::text[]and endpoint_base_url is null)
 or(provider_code<>'MATRICIA_DEV_MOCK'and endpoint_base_url is not null)
);
create function private.enforce_signature_environment_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare cfg public.signature_provider_configs%rowtype;e public.signature_envelopes%rowtype;
begin
 if tg_table_name='signature_envelopes'then
  select*into cfg from public.signature_provider_configs where id=new.provider_config_id;
  if cfg.provider_code is distinct from new.provider_code then raise exception'SIGNATURE_PROVIDER_CONFIG_MISMATCH'using errcode='23514';end if;
  perform private.require_signature_environment_v1(cfg.environment,cfg.provider_code);
  if cfg.provider_code='MATRICIA_DEV_MOCK'and(new.requested_level<>'SIMPLE'or(new.achieved_level is not null and new.achieved_level<>'SIMPLE'))then raise exception'SIGNATURE_MOCK_LEVEL_UNSUPPORTED'using errcode='23514';end if;
 else
  select*into e from public.signature_envelopes where id=new.envelope_id;select*into cfg from public.signature_provider_configs where id=e.provider_config_id;
  if cfg.provider_code is distinct from new.provider_code then raise exception'SIGNATURE_PROVIDER_CONFIG_MISMATCH'using errcode='23514';end if;
  perform private.require_signature_environment_v1(cfg.environment,cfg.provider_code);
 end if;
 return new;
end$$;
revoke all on function private.enforce_signature_environment_v1()from public,anon,authenticated,service_role;
create trigger signature_envelope_deployment_guard before insert or update on public.signature_envelopes for each row execute function private.enforce_signature_environment_v1();
create trigger signature_event_deployment_guard before insert on public.signature_provider_events for each row execute function private.enforce_signature_environment_v1();
create or replace function public.create_signature_envelope(
  p_contract_id uuid,p_contract_version_id uuid,p_provider_code text,p_environment text,p_requested_level text,
  p_document_file_name text,p_document_storage_path text,p_document_sha256 text,p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions
as $$
declare a uuid:=auth.uid();c public.contracts%rowtype;v public.contract_versions%rowtype;cfg public.signature_provider_configs%rowtype;prior public.signature_envelopes%rowtype;n integer;h text;e uuid;r jsonb;
begin
  select * into c from public.contracts where id=p_contract_id;
  if a is null or not found or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a) then raise exception 'SIGNATURE_ENVELOPE_CREATE_DENIED' using errcode='42501';end if;
  perform private.require_signature_environment_v1(p_environment,p_provider_code);
  select * into v from public.contract_versions where id=p_contract_version_id and contract_id=c.id;
  if not found then raise exception 'SIGNATURE_CONTRACT_VERSION_NOT_FOUND' using errcode='P0002';end if;
  if v.version<>c.current_version then raise exception 'SIGNATURE_CONTRACT_VERSION_STALE' using errcode='55000';end if;
  if p_requested_level not in('SIMPLE','ADVANCED','QUALIFIED') or p_document_sha256!~'^[0-9a-f]{64}$' or length(btrim(coalesce(p_document_file_name,'')))not between 1 and 255 or length(btrim(coalesce(p_document_storage_path,'')))not between 3 and 1000 then raise exception 'INVALID_SIGNATURE_ENVELOPE' using errcode='22023';end if;
  select * into cfg from public.signature_provider_configs where provider_code=p_provider_code and environment=p_environment and status='ACTIVE' and valid_from<=clock_timestamp() and(valid_until is null or valid_until>clock_timestamp()) order by version desc limit 1;
  if not found or not(p_requested_level=any(cfg.supported_levels)) then raise exception 'SIGNATURE_LEVEL_NOT_SUPPORTED' using errcode='23514';end if;
  h:=private.canonical_request_hash(jsonb_build_object('contract_id',c.id,'contract_version_id',v.id,'provider',cfg.provider_code,'provider_config_version',cfg.version,'requested_level',p_requested_level,'document_sha256',p_document_sha256));
  select * into prior from public.signature_envelopes where client_organization_id=c.client_organization_id and idempotency_key=p_idempotency_key;
  if found then if prior.request_hash<>h then raise exception 'SIGNATURE_ENVELOPE_IDEMPOTENCY_MISMATCH' using errcode='22000';end if;return jsonb_build_object('outcome','SIGNATURE_ENVELOPE_CREATED','envelope_id',prior.id,'envelope_version',prior.envelope_version,'replayed',true);end if;
  if exists(select 1 from public.signature_envelopes where contract_id=c.id and contract_version_id=v.id and status in('DRAFT','READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED','SIGNED')) then raise exception 'SIGNATURE_ENVELOPE_ALREADY_ACTIVE' using errcode='55000';end if;
  select * into prior from public.signature_envelopes where contract_id=c.id order by envelope_version desc limit 1;
  n:=coalesce(prior.envelope_version,0)+1;
  insert into public.signature_envelopes(client_organization_id,contract_id,contract_version_id,provider_config_id,provider_code,envelope_version,supersedes_envelope_id,requested_level,document_set_hash,idempotency_key,request_hash,correlation_id,created_by)
  values(c.client_organization_id,c.id,v.id,cfg.id,cfg.provider_code,n,prior.id,p_requested_level,p_document_sha256,p_idempotency_key,h,p_correlation_id,a)returning id into e;
  insert into public.signature_documents(envelope_id,contract_version_id,document_type,exact_version,file_name,storage_path,sha256,sort_order)values(e,v.id,'CONTRACT',v.version,p_document_file_name,p_document_storage_path,p_document_sha256,1);
  r:=jsonb_build_object('outcome','SIGNATURE_ENVELOPE_CREATED','envelope_id',e,'envelope_version',n,'contract_version_id',v.id,'requested_level',p_requested_level,'supersedes_envelope_id',prior.id,'replayed',false);
  insert into public.signature_attempts(envelope_id,attempt_type,outcome,occurred_at,correlation_id)values(e,'CREATE','SUCCEEDED',clock_timestamp(),p_correlation_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,a,'USER','signature.envelope_created','signature_envelope',e::text,p_correlation_id,r,repeat('0',64));
  insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'signature_envelope',e::text,'SignatureEnvelopeCreatedV1',p_correlation_id,r,p_idempotency_key);
  return r;
end$$;

create or replace function public.ready_signature_envelope(p_envelope_id uuid,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();e public.signature_envelopes%rowtype;c public.contracts%rowtype;v public.contract_versions%rowtype;cfg public.signature_provider_configs%rowtype;r jsonb;
begin select * into e from public.signature_envelopes where id=p_envelope_id;select * into c from public.contracts where id=e.contract_id;
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
language plpgsql security definer set search_path=pg_catalog,public,private,auth,extensions as $$
declare e public.signature_envelopes%rowtype;cfg public.signature_provider_configs%rowtype;old public.signature_provider_events%rowtype;s public.signature_signers%rowtype;cnt integer;total integer;r jsonb;ep uuid;actions jsonb;final_hash text;event_chain text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'SIGNATURE_EVENT_PROCESS_DENIED'using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;select * into cfg from public.signature_provider_configs where id=e.provider_config_id;
 if e.id is null or cfg.provider_code<>p_provider_code or p_event_type not in('SENT','SIGNER_SIGNED','DECLINED','EXPIRED','FAILED','VOIDED')or p_payload_hash!~'^[0-9a-f]{64}$'or p_signature_fingerprint!~'^[0-9a-f]{64}$'or p_signature_verified is not true or abs(extract(epoch from(clock_timestamp()-p_provider_occurred_at)))>cfg.webhook_tolerance_seconds then raise exception'INVALID_VERIFIED_SIGNATURE_EVENT'using errcode='22023';end if;
 perform private.require_signature_environment_v1(cfg.environment,cfg.provider_code);
 perform pg_advisory_xact_lock(hashtextextended(p_provider_code||':'||p_provider_event_id,0));
 select * into old from public.signature_provider_events where provider_code=p_provider_code and provider_event_id=p_provider_event_id;
 if found then if old.envelope_id<>e.id or old.nonce<>p_nonce or old.event_type<>p_event_type or old.payload_hash<>p_payload_hash or old.signature_fingerprint<>p_signature_fingerprint then raise exception'SIGNATURE_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;return old.processing_result||jsonb_build_object('replayed',true);end if;
 if exists(select 1 from public.signature_provider_events where provider_code=p_provider_code and nonce=p_nonce)then raise exception'SIGNATURE_EVENT_REPLAY_MISMATCH'using errcode='22000';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id for update;
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
   insert into public.contract_signatures(contract_id,contract_version_id,organization_id,signer_user_id,signer_role,contract_hash,proof,signed_at,correlation_id)
   select e.contract_id,e.contract_version_id,x.organization_id,x.signer_user_id,x.signer_role,e.document_set_hash,jsonb_build_object('method','SIGNATURE_PROVIDER_'||p_achieved_level,'signed_at',x.signed_at,'evidence_hash',p_payload_hash),x.signed_at,p_correlation_id from public.signature_signers x where x.envelope_id=e.id on conflict(contract_version_id,organization_id)do nothing;
   update public.contracts set status='ACTIVE',row_version=row_version+1,updated_at=clock_timestamp()where id=e.contract_id and status='PENDING_SIGNATURE';
   select jsonb_agg(jsonb_build_object('signer_id',x.id,'organization_id',x.organization_id,'signer_user_id',x.signer_user_id,'role',x.signer_role,'signed_at',x.signed_at)order by x.signing_order)into actions from public.signature_signers x where x.envelope_id=e.id;
   event_chain:=private.canonical_request_hash(jsonb_build_object('previous_events',(select coalesce(jsonb_agg(jsonb_build_object('provider_event_id',q.provider_event_id,'payload_hash',q.payload_hash)order by q.id),'[]')from public.signature_provider_events q where q.envelope_id=e.id),'current_event_id',p_provider_event_id,'current_payload_hash',p_payload_hash));
   final_hash:=private.canonical_request_hash(jsonb_build_object('envelope_id',e.id,'contract_version_id',e.contract_version_id,'pdf_sha256',e.document_set_hash,'signers',actions,'provider',p_provider_code,'level',p_achieved_level,'event_chain_hash',event_chain));
   insert into public.signature_evidence_packages(envelope_id,contract_version_id,pdf_sha256,signer_actions_snapshot,consent_snapshot,provider_snapshot,event_chain_hash,verification_result,final_hash,correlation_id)values(e.id,e.contract_version_id,e.document_set_hash,actions,coalesce(p_provider_evidence->'consent','{}'),jsonb_build_object('provider_code',p_provider_code,'provider_config_version',cfg.version,'achieved_level',p_achieved_level,'provider_envelope_id',e.provider_envelope_id),event_chain,case when p_achieved_level='SIMPLE'then'VERIFIED_WITH_LIMITATIONS'else'VERIFIED'end,final_hash,p_correlation_id)returning id into ep;
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
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,'SERVICE','signature.provider_event_processed','signature_envelope',e.id::text,p_correlation_id,r||jsonb_build_object('provider_event_id',p_provider_event_id,'event_type',p_event_type),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.client_organization_id,'signature_envelope',e.id::text,case when r->>'outcome'='SIGNATURE_ENVELOPE_SIGNED'then'SignatureEnvelopeSignedV1'else'SignatureEnvelopeTransitionedV1'end,p_correlation_id,r,p_provider_code||':'||p_provider_event_id);return r;
end$$;

create or replace function public.run_mock_signature_provider(p_envelope_id uuid,p_action text,p_signer_id uuid,p_request_id text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,auth,extensions as $$
declare e public.signature_envelopes%rowtype;h text;
begin if coalesce(auth.role(),'')<>'service_role'then raise exception'SIGNATURE_MOCK_DENIED'using errcode='42501';end if;select * into e from public.signature_envelopes where id=p_envelope_id;if e.provider_code<>'MATRICIA_DEV_MOCK'or p_action not in('SENT','SIGNER_SIGNED','DECLINED','EXPIRED','FAILED','VOIDED')then raise exception'SIGNATURE_MOCK_DEVELOPMENT_ONLY'using errcode='42501';end if;perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),e.provider_code);h:=private.canonical_request_hash(jsonb_build_object('envelope_id',e.id,'action',p_action,'signer_id',p_signer_id,'request_id',p_request_id));return public.process_verified_signature_provider_event(e.id,e.provider_code,'mock-event:'||p_request_id,'mock-nonce:'||p_request_id,p_action,p_signer_id,clock_timestamp(),h,repeat('a',64),true,case when p_action='SIGNER_SIGNED'then'SIMPLE'else null end,jsonb_build_object('provider_envelope_id','mock-envelope:'||e.id,'consent',jsonb_build_object('method','DEVELOPMENT_MOCK')),p_correlation_id);end$$;
notify pgrst,'reload schema';
