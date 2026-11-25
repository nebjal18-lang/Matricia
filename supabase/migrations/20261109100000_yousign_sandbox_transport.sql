begin;
-- Actual sandbox transport only. No provider configuration, legal policy or
-- four-eyes approval is created by this migration.
create table private.yousign_signer_inputs_v1 (
 signer_id uuid primary key references public.signature_signers(id),
 first_name text not null check(length(btrim(first_name)) between 1 and 100),
 last_name text not null check(length(btrim(last_name)) between 1 and 100),
 locale text not null check(locale in ('fr','en')),
 fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 1 and 10),
 configured_by uuid not null references auth.users(id),
 configured_at timestamptz not null default clock_timestamp()
);
create table private.yousign_requests_v1 (
 envelope_id uuid primary key references public.signature_envelopes(id),
 provider_request_id uuid not null unique,
 created_at timestamptz not null default clock_timestamp()
);
create table private.yousign_dispatch_operations_v1 (
 envelope_id uuid not null references public.signature_envelopes(id),
 operation text not null check(operation in ('SEND','VOID')),
 operation_key text not null check(length(operation_key) between 8 and 200),
 outcome text not null check(outcome in ('CLAIMED','UNKNOWN','ACCEPTED')),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(envelope_id,operation)
);
create table private.yousign_document_references_v1 (
 envelope_id uuid not null references private.yousign_requests_v1(envelope_id),
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 provider_document_id uuid not null unique,
 primary key(envelope_id,source_sha256)
);
create table private.yousign_signer_references_v1 (
 envelope_id uuid not null references private.yousign_requests_v1(envelope_id),
 signer_id uuid not null unique references public.signature_signers(id),
 provider_signer_id uuid not null unique,
 identity_sha256 text not null check(identity_sha256~'^[a-f0-9]{64}$'),
 primary key(envelope_id,signer_id)
);
create table private.yousign_native_artifacts_v1 (
 envelope_id uuid not null references private.yousign_requests_v1(envelope_id),
 kind text not null check(kind in ('SIGNED_PDF','AUDIT_JSON')),
 provider_reference uuid not null,
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 storage_path text not null,
 storage_object_id uuid not null unique references storage.objects(id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(envelope_id,kind,provider_reference)
);
create table private.yousign_native_evidence_bindings_v1 (
 evidence_package_id uuid primary key references public.signature_evidence_packages(id),
 envelope_id uuid not null unique references private.yousign_requests_v1(envelope_id),
 adapter_evidence_hash text not null check(adapter_evidence_hash~'^[a-f0-9]{64}$'),
 artifact_manifest jsonb not null,
 artifact_manifest_hash text not null check(artifact_manifest_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
do $$declare t text;begin
 foreach t in array array['yousign_signer_inputs_v1','yousign_requests_v1','yousign_dispatch_operations_v1','yousign_document_references_v1','yousign_signer_references_v1','yousign_native_artifacts_v1','yousign_native_evidence_bindings_v1'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['yousign_requests_v1','yousign_document_references_v1','yousign_signer_references_v1','yousign_native_artifacts_v1','yousign_native_evidence_bindings_v1'] loop
  execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_contract_immutable_change()',t||'_immutable',t);
 end loop;
end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('signature-provider-evidence','signature-provider-evidence',false,20971520,array['application/pdf','application/json'])
 on conflict(id) do nothing;
create policy signature_provider_evidence_private_only on storage.objects as restrictive
 for all to anon,authenticated
 using(bucket_id<>'signature-provider-evidence') with check(bucket_id<>'signature-provider-evidence');

-- Signer supplies their exact name and reviewed placement. A display_name is
-- never split heuristically; an arbitrary stamp is never put over legal text.
create function public.configure_yousign_signer_v1(p_signer_id uuid,p_first_name text,p_last_name text,p_locale text,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();s public.signature_signers%rowtype;e public.signature_envelopes%rowtype;f jsonb;begin
 select * into s from public.signature_signers where id=p_signer_id;
 select * into e from public.signature_envelopes where id=s.envelope_id for update;
 if a is null or s.signer_user_id is distinct from a or not private.is_active_org_member(s.organization_id,a) then raise exception 'YOUSIGN_SIGNER_CONFIGURATION_DENIED' using errcode='42501';end if;
 if e.provider_code<>'YOUSIGN' or e.status not in ('DRAFT','READY_FOR_SIGNATURE') or exists(select 1 from private.yousign_dispatch_operations_v1 where envelope_id=e.id) or exists(select 1 from private.yousign_requests_v1 where envelope_id=e.id) then raise exception 'YOUSIGN_SIGNER_CONFIGURATION_FROZEN' using errcode='55000';end if;
 perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),'YOUSIGN');
 if (select environment from private.admin_execution_environment_v1 where singleton) not in ('DEVELOPMENT','STAGING') then raise exception 'YOUSIGN_SANDBOX_ONLY' using errcode='42501';end if;
 if length(btrim(p_first_name)) not between 1 and 100 or length(btrim(p_last_name)) not between 1 and 100 or p_first_name~'[[:cntrl:]]' or p_last_name~'[[:cntrl:]]' or p_locale not in ('fr','en') or jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) not between 1 and 10 then raise exception 'YOUSIGN_SIGNER_CONFIGURATION_INVALID' using errcode='22023';end if;
 for f in select * from jsonb_array_elements(p_fields) loop
  if (select count(*) from jsonb_object_keys(f))<>4 or not(f?'documentSha256' and f?'page' and f?'x' and f?'y') or not exists(select 1 from public.signature_documents where envelope_id=e.id and sha256=f->>'documentSha256') or coalesce(f->>'page','')!~'^[1-9][0-9]{0,3}$' or coalesce(f->>'x','')!~'^[0-9]{1,4}$' or coalesce(f->>'y','')!~'^[0-9]{1,4}$' then raise exception 'YOUSIGN_SIGNATURE_PLACEMENT_INVALID' using errcode='22023';end if;
 end loop;
 insert into private.yousign_signer_inputs_v1(signer_id,first_name,last_name,locale,fields,configured_by) values(s.id,btrim(p_first_name),btrim(p_last_name),p_locale,p_fields,a)
 on conflict(signer_id) do update set first_name=excluded.first_name,last_name=excluded.last_name,locale=excluded.locale,fields=excluded.fields,configured_by=excluded.configured_by,configured_at=clock_timestamp();
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(e.client_organization_id,a,'USER','signature.yousign_signer_prepared','signature_signer',s.id::text,e.correlation_id,jsonb_build_object('envelope_id',e.id,'configuration_hash',private.canonical_request_hash(jsonb_build_object('first_name',btrim(p_first_name),'last_name',btrim(p_last_name),'locale',p_locale,'fields',p_fields))),repeat('0',64));
 return jsonb_build_object('outcome','YOUSIGN_SIGNER_CONFIGURED','signer_id',s.id);
end$$;

create function private.require_yousign_envelope_v1(p_envelope_id uuid) returns public.signature_envelopes
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;cfg public.signature_provider_configs%rowtype;b private.contract_signature_bindings_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;env text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;
 select * into cfg from public.signature_provider_configs where id=e.provider_config_id;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or e.provider_code<>'YOUSIGN' or cfg.provider_code<>'YOUSIGN' or env is null or env not in ('DEVELOPMENT','STAGING') or cfg.environment is distinct from env or cfg.endpoint_base_url is distinct from 'https://api-sandbox.yousign.app/v3' or cfg.status<>'ACTIVE' or cfg.valid_from>statement_timestamp() or cfg.valid_until<=statement_timestamp() or e.requested_level<>'SIMPLE' or not('SIMPLE'=any(cfg.supported_levels)) then raise exception 'YOUSIGN_SANDBOX_POLICY_REQUIRED' using errcode='55000';end if;
 perform private.require_signature_environment_v1(cfg.environment,'YOUSIGN');
 b:=private.assert_contract_signature_binding_v1(e.id,e.status='SIGNED');
 select * into p from private.contract_signature_policy_versions_v1 where id=b.policy_version_id;
 if p.allow_development_mock or p.governance_proposal_id is null or p.require_certificate or p.require_trusted_timestamp or p.minimum_level<>'SIMPLE' then raise exception 'YOUSIGN_NATIVE_CRYPTO_POLICY_UNSUPPORTED' using errcode='55000';end if;
 return e;
end$$;

create function public.get_signature_dispatch_provider_v1(p_envelope_id uuid) returns text
language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role() is distinct from 'service_role' then raise exception 'SIGNATURE_DISPATCH_DENIED' using errcode='42501';end if;
 return (select provider_code from public.signature_envelopes where id=p_envelope_id);
end$$;

create function public.get_yousign_envelope_v1(p_envelope_id uuid default null,p_provider_request_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;r private.yousign_requests_v1%rowtype;begin
 if (p_envelope_id is null)=(p_provider_request_id is null) then raise exception 'YOUSIGN_EXACT_REFERENCE_REQUIRED' using errcode='22023';end if;
 e:=private.require_yousign_envelope_v1(coalesce(p_envelope_id,(select envelope_id from private.yousign_requests_v1 where provider_request_id=p_provider_request_id)));
 select * into r from private.yousign_requests_v1 where envelope_id=e.id;
 select policy.* into p from private.contract_signature_policy_versions_v1 policy join private.contract_signature_bindings_v1 bound on bound.policy_version_id=policy.id where bound.envelope_id=e.id;
 return jsonb_build_object('input',jsonb_build_object('envelopeId',e.id,'requestedLevel',e.requested_level,'idempotencyKey','yousign-create:'||e.id::text,
  'documents',(select jsonb_agg(jsonb_build_object('contractVersionId',d.contract_version_id,'sha256',d.sha256,'fileName',d.file_name,'storagePath',d.storage_path) order by d.sort_order) from public.signature_documents d where d.envelope_id=e.id),
  'signers',(select jsonb_agg(jsonb_build_object('signerId',s.id,'organizationId',s.organization_id,'userId',s.signer_user_id,'signingOrder',s.signing_order) order by s.signing_order) from public.signature_signers s where s.envelope_id=e.id)),
  'providerCode','YOUSIGN','providerEnvelopeId',r.provider_request_id,'evidencePolicy',jsonb_build_object('version',p.id,'requireCertificate',p.require_certificate,'requireTrustedTimestamp',p.require_trusted_timestamp),
  'remainingSignerIds',(select coalesce(jsonb_agg(s.id order by s.signing_order),'[]') from public.signature_signers s where s.envelope_id=e.id and s.status<>'SIGNED'),
  'identities',(select coalesce(jsonb_agg(jsonb_build_object('signerId',s.id,'firstName',i.first_name,'lastName',i.last_name,'email',u.email,'locale',i.locale,'fields',i.fields) order by s.signing_order),'[]') from public.signature_signers s join private.yousign_signer_inputs_v1 i on i.signer_id=s.id join auth.users u on u.id=s.signer_user_id and u.email_confirmed_at is not null where s.envelope_id=e.id and s.email_hash=encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex')),
  'state',jsonb_build_object('envelopeId',e.id,'requestedLevel',e.requested_level,
   'documents',(select coalesce(jsonb_agg(jsonb_build_object('sourceSha256',d.source_sha256,'providerDocumentId',d.provider_document_id) order by original.sort_order),'[]') from private.yousign_document_references_v1 d join public.signature_documents original on original.envelope_id=d.envelope_id and original.sha256=d.source_sha256 where d.envelope_id=e.id),
   'signers',(select coalesce(jsonb_agg(jsonb_build_object('signerId',s.signer_id,'providerSignerId',s.provider_signer_id,'identitySha256',s.identity_sha256) order by original.signing_order),'[]') from private.yousign_signer_references_v1 s join public.signature_signers original on original.id=s.signer_id and original.envelope_id=s.envelope_id where s.envelope_id=e.id)));
end$$;

create function public.begin_yousign_dispatch_v1(p_envelope_id uuid,p_operation text,p_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;o private.yousign_dispatch_operations_v1%rowtype;ctx jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;
 perform private.lock_contract_financial_parties_v1((select client_organization_id from public.contracts where id=e.contract_id),(select provider_organization_id from public.contracts where id=e.contract_id));
 select * into e from public.signature_envelopes where id=p_envelope_id for update;
 e:=private.require_yousign_envelope_v1(e.id);
 if p_operation not in ('SEND','VOID') or length(p_key) not between 8 and 200 then raise exception 'YOUSIGN_OPERATION_INVALID' using errcode='22023';end if;
 select * into o from private.yousign_dispatch_operations_v1 where envelope_id=e.id and operation=p_operation;
 if found then
  if o.operation_key<>p_key then raise exception 'YOUSIGN_OPERATION_KEY_MISMATCH' using errcode='22000';end if;
  return jsonb_build_object('outcome',case when o.outcome='ACCEPTED' then 'COMPLETED' else 'RECONCILIATION_REQUIRED' end);
 end if;
 if (p_operation='SEND' and e.status<>'READY_FOR_SIGNATURE') or (p_operation='VOID' and e.status not in ('SENT','PARTIALLY_SIGNED')) then raise exception 'YOUSIGN_OPERATION_TRANSITION_INVALID' using errcode='55000';end if;
 if p_operation='SEND' and ((e.amendment_id is null and not exists(select 1 from public.contracts where id=e.contract_id and status='PENDING_SIGNATURE')) or (e.amendment_id is not null and not exists(select 1 from public.contract_amendments where id=e.amendment_id and status='PENDING_SIGNATURE'))) then raise exception 'CONTRACT_SIGNATURE_SUBMISSION_REQUIRED' using errcode='55000';end if;
 ctx:=public.get_yousign_envelope_v1(e.id,null);
 if jsonb_array_length(ctx->'identities')<>jsonb_array_length(ctx->'input'->'signers') then raise exception 'YOUSIGN_EXPLICIT_SIGNER_CONFIGURATION_REQUIRED' using errcode='55000';end if;
 insert into private.yousign_dispatch_operations_v1(envelope_id,operation,operation_key,outcome) values(e.id,p_operation,p_key,'CLAIMED');
 return jsonb_build_object('outcome','CLAIMED','envelope',ctx);
end$$;

create function public.record_yousign_reference_v1(p_envelope_id uuid,p_kind text,p_reference uuid,p_local_reference text default null,p_identity_sha256 text default null) returns boolean
language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;previous uuid;begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;
 perform private.lock_contract_financial_parties_v1((select client_organization_id from public.contracts where id=e.contract_id),(select provider_organization_id from public.contracts where id=e.contract_id));
 perform 1 from public.signature_envelopes where id=p_envelope_id for update;
 e:=private.require_yousign_envelope_v1(p_envelope_id);
 if not exists(select 1 from private.yousign_dispatch_operations_v1 where envelope_id=e.id and operation='SEND' and outcome='CLAIMED') then raise exception 'YOUSIGN_DISPATCH_CLAIM_REQUIRED' using errcode='55000';end if;
 if p_kind='REQUEST' then
  select provider_request_id into previous from private.yousign_requests_v1 where envelope_id=e.id;
  if (previous is not null and previous<>p_reference) or (e.provider_envelope_id is not null and e.provider_envelope_id<>p_reference::text) then raise exception 'YOUSIGN_REFERENCE_IMMUTABLE' using errcode='22000';end if;
  insert into private.yousign_requests_v1(envelope_id,provider_request_id) values(e.id,p_reference) on conflict(envelope_id) do nothing;
  update public.signature_envelopes set provider_envelope_id=p_reference::text where id=e.id and (provider_envelope_id is null or provider_envelope_id=p_reference::text);
  if not found then raise exception 'YOUSIGN_REFERENCE_IMMUTABLE' using errcode='22000';end if;
 elsif p_kind='DOCUMENT' then
  if not exists(select 1 from public.signature_documents where envelope_id=e.id and sha256=p_local_reference) then raise exception 'YOUSIGN_DOCUMENT_BINDING_REQUIRED' using errcode='23514';end if;
  select provider_document_id into previous from private.yousign_document_references_v1 where envelope_id=e.id and source_sha256=p_local_reference;
  if previous is not null and previous<>p_reference then raise exception 'YOUSIGN_REFERENCE_IMMUTABLE' using errcode='22000';end if;
  insert into private.yousign_document_references_v1(envelope_id,source_sha256,provider_document_id) values(e.id,p_local_reference,p_reference) on conflict(envelope_id,source_sha256) do nothing;
 elsif p_kind='SIGNER' then
  if not exists(select 1 from public.signature_signers where envelope_id=e.id and id=p_local_reference::uuid) or coalesce(p_identity_sha256,'')!~'^[a-f0-9]{64}$' then raise exception 'YOUSIGN_SIGNER_BINDING_REQUIRED' using errcode='23514';end if;
  select provider_signer_id into previous from private.yousign_signer_references_v1 where envelope_id=e.id and signer_id=p_local_reference::uuid;
  if previous is not null and (previous<>p_reference or exists(select 1 from private.yousign_signer_references_v1 where envelope_id=e.id and signer_id=p_local_reference::uuid and identity_sha256<>p_identity_sha256)) then raise exception 'YOUSIGN_REFERENCE_IMMUTABLE' using errcode='22000';end if;
  insert into private.yousign_signer_references_v1(envelope_id,signer_id,provider_signer_id,identity_sha256) values(e.id,p_local_reference::uuid,p_reference,p_identity_sha256) on conflict(envelope_id,signer_id) do nothing;
 else raise exception 'YOUSIGN_REFERENCE_KIND_INVALID' using errcode='22023';end if;
 return true;
end$$;

create function public.finish_yousign_dispatch_v1(p_envelope_id uuid,p_operation text,p_key text,p_outcome text) returns boolean
language plpgsql security definer set search_path=pg_catalog,private as $$begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 if p_outcome not in ('UNKNOWN','ACCEPTED') then raise exception 'YOUSIGN_OUTCOME_INVALID' using errcode='22023';end if;
 update private.yousign_dispatch_operations_v1 set outcome=p_outcome,updated_at=clock_timestamp() where envelope_id=p_envelope_id and operation=p_operation and operation_key=p_key and outcome='CLAIMED';
 if not found then raise exception 'YOUSIGN_OPERATION_NOT_CLAIMED' using errcode='55000';end if;
 return true;
end$$;

create function public.record_yousign_native_artifact_v1(p_envelope_id uuid,p_kind text,p_provider_reference uuid,p_sha256 text,p_storage_path text) returns boolean
language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;o storage.objects%rowtype;old private.yousign_native_artifacts_v1%rowtype;begin
 e:=private.require_yousign_envelope_v1(p_envelope_id);
 if (p_kind='SIGNED_PDF' and not exists(select 1 from private.yousign_document_references_v1 where envelope_id=e.id and provider_document_id=p_provider_reference)) or (p_kind='AUDIT_JSON' and not exists(select 1 from private.yousign_signer_references_v1 where envelope_id=e.id and provider_signer_id=p_provider_reference)) or p_kind not in ('SIGNED_PDF','AUDIT_JSON') or coalesce(p_sha256,'')!~'^[a-f0-9]{64}$' or p_storage_path is distinct from (e.id::text||'/'||lower(p_kind)||'/'||p_provider_reference::text||'/'||p_sha256||case p_kind when 'SIGNED_PDF' then '.pdf' else '.json' end) then raise exception 'YOUSIGN_ARTIFACT_BINDING_INVALID' using errcode='23514';end if;
 select obj.* into o from storage.objects obj join storage.buckets b on b.id=obj.bucket_id and not b.public where obj.bucket_id='signature-provider-evidence' and obj.name=p_storage_path and obj.metadata->>'mimetype'=case p_kind when 'SIGNED_PDF' then 'application/pdf' else 'application/json' end;
 if o.id is null then raise exception 'YOUSIGN_PRIVATE_ARTIFACT_REQUIRED' using errcode='55000';end if;
 select * into old from private.yousign_native_artifacts_v1 where envelope_id=e.id and kind=p_kind and provider_reference=p_provider_reference;
 if found then
  if old.sha256<>p_sha256 or old.storage_object_id<>o.id or old.storage_path<>p_storage_path then raise exception 'YOUSIGN_ARTIFACT_IMMUTABLE' using errcode='22000';end if;
  return true;
 end if;
 insert into private.yousign_native_artifacts_v1(envelope_id,kind,provider_reference,sha256,storage_path,storage_object_id) values(e.id,p_kind,p_provider_reference,p_sha256,p_storage_path,o.id);
 return true;
end$$;

-- Native callback processing retains all existing source/authority/four-eyes,
-- inbox uniqueness and contract-completion guards. No fake SENT on HTTP202.
create function public.record_yousign_verified_event_v1(p_envelope_id uuid,p_event jsonb,p_evidence jsonb default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;signer uuid;native jsonb;r jsonb;manifest jsonb;manifest_hash text;inserted uuid;old private.yousign_native_evidence_bindings_v1%rowtype;begin
 e:=private.require_yousign_envelope_v1(p_envelope_id);
 if p_event->>'providerEnvelopeId' is distinct from e.provider_envelope_id or coalesce(p_event->>'type','') not in ('SENT','SIGNER_SIGNED','DECLINED','EXPIRED','FAILED','VOIDED') then raise exception 'YOUSIGN_EVENT_BINDING_INVALID' using errcode='23514';end if;
 if p_event->>'type'='SIGNER_SIGNED' then
  signer:=(p_event->>'signerId')::uuid;
  if not exists(select 1 from private.yousign_signer_references_v1 where envelope_id=e.id and signer_id=signer) or p_event->>'achievedLevel' is distinct from 'SIMPLE' then raise exception 'YOUSIGN_SIGNER_EVENT_BINDING_INVALID' using errcode='23514';end if;
  if (select count(*) from public.signature_signers where envelope_id=e.id and status<>'SIGNED')<=1 then
   if p_evidence is null or p_evidence->>'achievedLevel' is distinct from 'SIMPLE' or p_evidence->>'providerEnvelopeId' is distinct from e.provider_envelope_id or coalesce(p_evidence->>'finalHash','')!~'^[a-f0-9]{64}$' or (select count(*) from private.yousign_native_artifacts_v1 where envelope_id=e.id and kind='SIGNED_PDF')<>(select count(*) from public.signature_documents where envelope_id=e.id) or (select count(*) from private.yousign_native_artifacts_v1 where envelope_id=e.id and kind='AUDIT_JSON')<>(select count(*) from public.signature_signers where envelope_id=e.id) then raise exception 'YOUSIGN_NATIVE_EVIDENCE_REQUIRED' using errcode='55000';end if;
  end if;
 end if;
 native:=jsonb_build_object('provider_envelope_id',e.provider_envelope_id,'transport','YOUSIGN_SANDBOX','provider_artifact_hash',p_evidence->>'finalHash',
  'consent',jsonb_build_object('evidence_kind','YOUSIGN_SIGNER_AUDIT_REFERENCES','signer_audits',(select coalesce(jsonb_agg(jsonb_build_object('signer_id',s.signer_id,'provider_signer_id',s.provider_signer_id,'audit_sha256',a.sha256) order by s.signer_id),'[]') from private.yousign_signer_references_v1 s join private.yousign_native_artifacts_v1 a on a.envelope_id=s.envelope_id and a.kind='AUDIT_JSON' and a.provider_reference=s.provider_signer_id where s.envelope_id=e.id)));
 r:=public.process_verified_signature_provider_event(e.id,'YOUSIGN',p_event->>'providerEventId',p_event->>'nonce',p_event->>'type',signer,(p_event->>'occurredAt')::timestamptz,p_event->>'payloadSha256',p_event->>'signatureFingerprint',true,case when signer is null then null else 'SIMPLE' end,native,e.correlation_id);
 if r->>'outcome'='SIGNATURE_ENVELOPE_SIGNED' then
  manifest:=jsonb_build_object('provider_request_id',e.provider_envelope_id,
   'source_documents',(select jsonb_agg(jsonb_build_object('source_sha256',d.source_sha256,'provider_document_id',d.provider_document_id) order by d.source_sha256) from private.yousign_document_references_v1 d where d.envelope_id=e.id),
   'artifacts',(select jsonb_agg(jsonb_build_object('kind',a.kind,'provider_reference',a.provider_reference,'sha256',a.sha256,'storage_object_id',a.storage_object_id,'storage_path',a.storage_path) order by a.kind,a.provider_reference) from private.yousign_native_artifacts_v1 a where a.envelope_id=e.id));
  manifest_hash:=private.canonical_request_hash(manifest);
  insert into private.yousign_native_evidence_bindings_v1(evidence_package_id,envelope_id,adapter_evidence_hash,artifact_manifest,artifact_manifest_hash)
   values((r->>'evidence_package_id')::uuid,e.id,p_evidence->>'finalHash',manifest,manifest_hash)
   on conflict(evidence_package_id) do nothing returning evidence_package_id into inserted;
  select * into old from private.yousign_native_evidence_bindings_v1 where evidence_package_id=(r->>'evidence_package_id')::uuid;
  if old.envelope_id is distinct from e.id or old.adapter_evidence_hash is distinct from p_evidence->>'finalHash' or old.artifact_manifest_hash is distinct from manifest_hash then raise exception 'YOUSIGN_NATIVE_PACKAGE_BINDING_MISMATCH' using errcode='23514';end if;
  if inserted is not null then
   insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
   values(e.client_organization_id,'SERVICE','signature.yousign_native_evidence_bound','signature_evidence_package',inserted::text,e.correlation_id,jsonb_build_object('envelope_id',e.id,'artifact_manifest_hash',manifest_hash,'adapter_evidence_hash',old.adapter_evidence_hash),repeat('0',64));
  end if;
  r:=r||jsonb_build_object('native_artifact_manifest_hash',manifest_hash);
 end if;
 return r;
end$$;

create function public.get_yousign_native_evidence_binding_v1(p_envelope_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if auth.role() is distinct from 'service_role' and not private.signature_envelope_access(p_envelope_id) then raise exception 'SIGNATURE_EVIDENCE_NOT_FOUND' using errcode='42501';end if;
 return (select jsonb_build_object('evidence_package_id',b.evidence_package_id,'envelope_id',b.envelope_id,'adapter_evidence_hash',b.adapter_evidence_hash,'artifact_manifest_hash',b.artifact_manifest_hash) from private.yousign_native_evidence_bindings_v1 b where b.envelope_id=p_envelope_id);
end$$;

revoke all on function private.require_yousign_envelope_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.configure_yousign_signer_v1(uuid,text,text,text,jsonb),public.get_signature_dispatch_provider_v1(uuid),public.get_yousign_envelope_v1(uuid,uuid),public.begin_yousign_dispatch_v1(uuid,text,text),public.record_yousign_reference_v1(uuid,text,uuid,text,text),public.finish_yousign_dispatch_v1(uuid,text,text,text),public.record_yousign_native_artifact_v1(uuid,text,uuid,text,text),public.record_yousign_verified_event_v1(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.configure_yousign_signer_v1(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.get_signature_dispatch_provider_v1(uuid),public.get_yousign_envelope_v1(uuid,uuid),public.begin_yousign_dispatch_v1(uuid,text,text),public.record_yousign_reference_v1(uuid,text,uuid,text,text),public.finish_yousign_dispatch_v1(uuid,text,text,text),public.record_yousign_native_artifact_v1(uuid,text,uuid,text,text),public.record_yousign_verified_event_v1(uuid,jsonb,jsonb) to service_role;
revoke all on function public.get_yousign_native_evidence_binding_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_yousign_native_evidence_binding_v1(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
