begin;
-- A first draft or rejection must not interrupt an already governed legacy
-- integration. Adoption starts at an actual independent activation and remains
-- historical after retirement, so disabling never re-enables legacy keys.
create or replace function private.yousign_configuration_adopted_v1(p_environment text) returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select exists(select 1 from private.admin_configuration_revisions_v1
 where environment=p_environment and section='YOUSIGN'
 and status in('ACTIVE','RETIRED') and approved_by is not null)
$$;
revoke all on function private.yousign_configuration_adopted_v1(text) from public,anon,authenticated,service_role;

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
  if private.yousign_configuration_adopted_v1(env) then
   if not exists(select 1 from private.admin_configuration_revisions_v1 active where active.environment=env and active.section='YOUSIGN' and active.status='ACTIVE' and active.id::text=cfg.config_metadata->>'admin_configuration_revision_id') then
    raise exception 'YOUSIGN_ACTIVE_CONFIGURATION_REQUIRED' using errcode='55000';end if;
  end if;
 end if;
 b:=private.assert_contract_signature_binding_v1(e.id,e.status='SIGNED');
 select * into p from private.contract_signature_policy_versions_v1 where id=b.policy_version_id;
 if p.allow_development_mock or p.governance_proposal_id is null or p.require_certificate or p.require_trusted_timestamp or p.minimum_level<>'SIMPLE' then raise exception 'YOUSIGN_NATIVE_CRYPTO_POLICY_UNSUPPORTED' using errcode='55000';end if;
 return e;
end$$;



commit;
