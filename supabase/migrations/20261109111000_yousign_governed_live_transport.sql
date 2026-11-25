begin;
-- Adds executable live transport capability, never provider credentials, legal
-- attestations, policy approval or a production deployment binding. A live
-- adapter still requires the database owner's PRODUCTION tag, a live fixed
-- endpoint config, a current independently approved non-mock policy, exact
-- source/party authority and native evidence. SIMPLE is the only supported level.
create function public.get_yousign_runtime_environment_v1() returns text
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare env text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null or env not in ('DEVELOPMENT','STAGING','PRODUCTION') then raise exception 'YOUSIGN_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED' using errcode='55000';end if;
 return env;
end$$;
revoke all on function public.get_yousign_runtime_environment_v1() from public,anon,authenticated,service_role;
grant execute on function public.get_yousign_runtime_environment_v1() to service_role;

create or replace function public.configure_yousign_signer_v1(p_signer_id uuid,p_first_name text,p_last_name text,p_locale text,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();s public.signature_signers%rowtype;e public.signature_envelopes%rowtype;f jsonb;begin
 select * into s from public.signature_signers where id=p_signer_id;
 select * into e from public.signature_envelopes where id=s.envelope_id for update;
 if a is null or s.signer_user_id is distinct from a or not private.is_active_org_member(s.organization_id,a) then raise exception 'YOUSIGN_SIGNER_CONFIGURATION_DENIED' using errcode='42501';end if;
 if e.provider_code<>'YOUSIGN' or e.status not in ('DRAFT','READY_FOR_SIGNATURE') or exists(select 1 from private.yousign_dispatch_operations_v1 where envelope_id=e.id) or exists(select 1 from private.yousign_requests_v1 where envelope_id=e.id) then raise exception 'YOUSIGN_SIGNER_CONFIGURATION_FROZEN' using errcode='55000';end if;
 perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),'YOUSIGN');
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

create or replace function private.require_yousign_envelope_v1(p_envelope_id uuid) returns public.signature_envelopes
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;cfg public.signature_provider_configs%rowtype;b private.contract_signature_bindings_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;env text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'YOUSIGN_SERVICE_REQUIRED' using errcode='42501';end if;
 select * into e from public.signature_envelopes where id=p_envelope_id;
 select * into cfg from public.signature_provider_configs where id=e.provider_config_id;
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or e.provider_code<>'YOUSIGN' or cfg.provider_code<>'YOUSIGN' or env is null or env not in ('DEVELOPMENT','STAGING','PRODUCTION') or cfg.environment is distinct from env or cfg.endpoint_base_url is distinct from (case when env='PRODUCTION' then 'https://api.yousign.app/v3' else 'https://api-sandbox.yousign.app/v3' end) or cfg.status<>'ACTIVE' or cfg.valid_from>statement_timestamp() or cfg.valid_until<=statement_timestamp() or e.requested_level<>'SIMPLE' or not('SIMPLE'=any(cfg.supported_levels)) then raise exception 'YOUSIGN_GOVERNED_PROVIDER_POLICY_REQUIRED' using errcode='55000';end if;
 perform private.require_signature_environment_v1(cfg.environment,'YOUSIGN');
 -- Once credentials are managed in Admin, an old policy cannot dispatch using
 -- a newly approved account's global credentials. Rotation or deactivation
 -- blocks old envelopes until an explicit governed reconciliation is performed.
 if to_regclass('private.admin_configuration_revisions_v1') is not null then
  if exists(select 1 from private.admin_configuration_revisions_v1 where environment=env and section='YOUSIGN') then
   if not exists(select 1 from private.admin_configuration_revisions_v1 active where active.environment=env and active.section='YOUSIGN' and active.status='ACTIVE' and active.id::text=cfg.config_metadata->>'admin_configuration_revision_id') then
    raise exception 'YOUSIGN_ACTIVE_CONFIGURATION_REQUIRED' using errcode='55000';end if;
  end if;
 end if;
 b:=private.assert_contract_signature_binding_v1(e.id,e.status='SIGNED');
 select * into p from private.contract_signature_policy_versions_v1 where id=b.policy_version_id;
 if p.allow_development_mock or p.governance_proposal_id is null or p.require_certificate or p.require_trusted_timestamp or p.minimum_level<>'SIMPLE' then raise exception 'YOUSIGN_NATIVE_CRYPTO_POLICY_UNSUPPORTED' using errcode='55000';end if;
 return e;
end$$;


-- Called only by the independently approved configuration transaction. This
-- registers technical transport capability, never legal/signature authority.
create function private.activate_configured_yousign_provider_v1(p_revision_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,private as $$
declare env text:=private.admin_configuration_environment_v1();r record;probe record;config_id uuid;next_version integer;endpoint text;begin
 select * into r from private.admin_configuration_revisions_v1 where id=p_revision_id and environment=env and section='YOUSIGN' and status='ACTIVE';
 if not found or r.approved_by is distinct from auth.uid() or r.approved_by=r.created_by or r.approved_at is null
  or (r.settings->>'YOUSIGN_ENVIRONMENT') is distinct from (case when env='PRODUCTION' then 'live' else 'sandbox' end)
  or not r.secret_keys@>array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'] then
  raise exception 'YOUSIGN_APPROVED_CONFIGURATION_REQUIRED' using errcode='42501';end if;
 select * into probe from private.admin_configuration_probe_results_v1 where revision_id=r.id and content_hash=r.content_hash and environment=env order by checked_at desc,id desc limit 1;
 if not found or probe.status<>'PASS' or probe.code<>'YOUSIGN_CREDENTIALS_VALID' or probe.valid_until<=clock_timestamp() then
  raise exception 'YOUSIGN_FRESH_CONFIGURATION_PROBE_REQUIRED' using errcode='55000';end if;
 endpoint:=case when env='PRODUCTION' then 'https://api.yousign.app/v3' else 'https://api-sandbox.yousign.app/v3' end;
 perform pg_advisory_xact_lock(hashtextextended('yousign-provider:'||env,0));
 -- A changed credential/account revision receives its own immutable provider
 -- version; a previous account’s legal attestation is never inherited.
 select id into config_id from public.signature_provider_configs where provider_code='YOUSIGN' and environment=env and status='ACTIVE'
  and endpoint_base_url=endpoint and supported_levels=array['SIMPLE']::text[]
  and config_metadata->>'admin_configuration_revision_id'=r.id::text
  and valid_from<=statement_timestamp() and(valid_until is null or valid_until>statement_timestamp()) order by version desc limit 1;
 if config_id is null then
  select coalesce(max(version),0)+1 into next_version from public.signature_provider_configs where provider_code='YOUSIGN' and environment=env;
  insert into public.signature_provider_configs(provider_code,environment,version,status,supported_levels,endpoint_base_url,secret_reference_names,config_metadata,created_by)
  values('YOUSIGN',env,next_version,'ACTIVE',array['SIMPLE'],endpoint,array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],
   jsonb_build_object('admin_configuration_revision_id',r.id,'verification_scope','TECHNICAL_CONNECTION_ONLY','requires_independent_legal_attestation',true),r.approved_by) returning id into config_id;
 end if;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(auth.uid(),'USER','signature.yousign_provider_configured','signature_provider_config',config_id::text,extensions.gen_random_uuid(),
  jsonb_build_object('environment',env,'configuration_revision_id',r.id,'configuration_hash',r.content_hash,'scope','TECHNICAL_CONNECTION_ONLY'),repeat('0',64));
 return config_id;
end$$;
revoke all on function private.activate_configured_yousign_provider_v1(uuid) from public,anon,authenticated,service_role;

commit;
