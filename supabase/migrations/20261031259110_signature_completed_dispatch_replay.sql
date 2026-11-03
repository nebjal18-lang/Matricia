begin;
-- A recorded native effect remains replayable after policy expiry/revocation.
-- Only an unexecuted step needs current authorization; no second SDK send occurs.
create or replace function public.execute_signature_mock_step_v1(p_command_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare c private.signature_mock_commands_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;e public.signature_envelopes%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
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
create function private.signature_recorded_send_is_valid_v1(p_envelope_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select exists(select 1 from public.signature_envelopes e join private.contract_signature_bindings_v1 b on b.envelope_id=e.id join private.contract_signature_policy_versions_v1 p on p.id=b.policy_version_id join public.contract_versions v on v.id=b.contract_version_id left join public.contract_amendments am on am.id=e.amendment_id join public.signature_provider_events native on native.envelope_id=e.id
 where e.id=p_envelope_id and e.provider_config_id=p.provider_config_id and b.source_id=coalesce(e.amendment_id,v.id)and b.source_hash=case when e.amendment_id is null then v.content_hash else am.content_hash end and b.contract_version_hash=v.content_hash and b.pdf_sha256=e.document_set_hash and b.requested_level=e.requested_level and b.parties_hash=private.contract_signature_parties_hash_v1(v.id)and b.signers_hash=private.contract_signature_signers_hash_v1(e.id)and b.documents_hash=private.contract_signature_documents_hash_v1(e.id)
 and native.event_type='SENT'and native.signature_verified and native.provider_code=e.provider_code and native.processing_result->>'outcome'='SIGNATURE_ENVELOPE_SENT'and native.processing_result->>'envelope_id'=e.id::text and native.provider_occurred_at>=b.bound_at and native.provider_occurred_at>=p.approved_at and(p.valid_until is null or native.provider_occurred_at<p.valid_until)
 and exists(select 1 from public.signature_attempts attempt where attempt.envelope_id=e.id and attempt.attempt_type='SEND'and attempt.outcome='SUCCEEDED'and attempt.provider_request_id=native.provider_event_id));
$$;
revoke all on function private.signature_recorded_send_is_valid_v1(uuid)from public,anon,authenticated,service_role;
create or replace function public.dispatch_governed_signature_envelope_v1(p_envelope_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_DISPATCH_DENIED'using errcode='42501';end if;
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
