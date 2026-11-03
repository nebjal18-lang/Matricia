begin;
create table private.signature_local_cancellations_v1(
 envelope_id uuid primary key references public.signature_envelopes(id),contract_version_id uuid not null references public.contract_versions(id),
 source_kind text not null check(source_kind in('CONTRACT','AMENDMENT')),source_id uuid not null,source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),source_binding_hash text,
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),kind text not null check(kind in('UNPREPARED_DRAFT_ARCHIVED','MOCK_READY_CANCELLED')),
 cancelled_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 20 and 1000),previous_row_version integer not null,cancelled_at timestamptz not null default clock_timestamp(),
 check(source_binding_hash is null or source_binding_hash~'^[0-9a-f]{64}$'),check(kind<>'MOCK_READY_CANCELLED'or environment in('DEVELOPMENT','STAGING'))
);
-- Reserved for a real adapter's archived native cancellation certificate. No generic client import.
create table private.signature_native_cancellation_attestations_v1(
 envelope_id uuid primary key references public.signature_envelopes(id),provider_event_id text not null,provider_code text not null,provider_envelope_id text not null,
 source_binding_hash text not null check(source_binding_hash~'^[0-9a-f]{64}$'),storage_object_id uuid not null references storage.objects(id),certificate_sha256 text not null check(certificate_sha256~'^[0-9a-f]{64}$'),
 verification_reference text not null check(length(btrim(verification_reference))between 8 and 500),verified_at timestamptz not null,verified_by uuid not null references auth.users(id)
);
revoke all on private.signature_local_cancellations_v1,private.signature_native_cancellation_attestations_v1 from public,anon,authenticated,service_role;
create trigger signature_local_cancellation_immutable before update or delete on private.signature_local_cancellations_v1 for each row execute function private.prevent_contract_immutable_change();
create trigger signature_native_cancellation_immutable before update or delete on private.signature_native_cancellation_attestations_v1 for each row execute function private.prevent_contract_immutable_change();
create or replace function private.guard_contract_amendment_lifecycle()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if tg_op='DELETE'then raise exception'IMMUTABLE_CONTRACT_AMENDMENT_CONTENT'using errcode='55000';end if;
 if old.id<>new.id or old.contract_id<>new.contract_id or old.change_request_id<>new.change_request_id or old.base_contract_version_id<>new.base_contract_version_id or old.amendment_number<>new.amendment_number or old.price_delta_minor<>new.price_delta_minor or old.deadline_delta_days<>new.deadline_delta_days or old.deliverables_delta is distinct from new.deliverables_delta or old.commission_rule_snapshot is distinct from new.commission_rule_snapshot or old.content_hash<>new.content_hash or old.created_by<>new.created_by or old.created_at<>new.created_at then raise exception'IMMUTABLE_CONTRACT_AMENDMENT_CONTENT'using errcode='55000';end if;
 if not((old.status='DRAFT'and new.status='PENDING_SIGNATURE'and new.activated_contract_version_id is null and new.activated_at is null)or(old.status='PENDING_SIGNATURE'and new.status='ACTIVE'and new.activated_contract_version_id is not null and new.activated_at is not null)or(old.status='PENDING_SIGNATURE'and new.status='DRAFT'and new.activated_contract_version_id is null and new.activated_at is null and exists(select 1 from private.signature_local_cancellations_v1 proof join public.signature_envelopes e on e.id=proof.envelope_id join private.admin_execution_environment_v1 env on env.singleton and env.environment=proof.environment where proof.kind='MOCK_READY_CANCELLED'and proof.environment in('DEVELOPMENT','STAGING')and proof.source_kind='AMENDMENT'and proof.source_id=old.id and proof.source_hash=old.content_hash and e.amendment_id=old.id and e.provider_code='MATRICIA_DEV_MOCK'and e.status='VOIDED'and not exists(select 1 from public.signature_provider_events where envelope_id=e.id))and not exists(select 1 from public.contract_amendment_signatures where amendment_id=old.id)and not exists(select 1 from public.signature_envelopes where amendment_id=old.id and status in('DRAFT','READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED','SIGNED'))))then raise exception'INVALID_CONTRACT_AMENDMENT_LIFECYCLE'using errcode='55000';end if;return new;
end$$;

create function private.signature_envelope_void_is_recorded_v1(p_envelope_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;env text;b private.contract_signature_bindings_v1%rowtype;begin
 select*into e from public.signature_envelopes where id=p_envelope_id;select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or e.status<>'VOIDED'or env is null or not exists(select 1 from public.signature_provider_configs cfg where cfg.id=e.provider_config_id and cfg.environment=env)then return false;end if;
 select*into b from private.contract_signature_bindings_v1 where envelope_id=e.id;
 if exists(select 1 from private.signature_local_cancellations_v1 proof where proof.envelope_id=e.id and proof.contract_version_id=e.contract_version_id and proof.environment=env and proof.previous_row_version<e.row_version and proof.source_id=coalesce(e.amendment_id,e.contract_version_id)and proof.source_hash=case when e.amendment_id is null then(select content_hash from public.contract_versions where id=e.contract_version_id)else(select content_hash from public.contract_amendments where id=e.amendment_id)end and(proof.source_binding_hash is null or proof.source_binding_hash=private.canonical_request_hash(to_jsonb(b)-'bound_at')))then return true;end if;
 if e.provider_code='MATRICIA_DEV_MOCK'and env in('DEVELOPMENT','STAGING')and exists(select 1 from private.signature_policy_revocations_v1 where policy_version_id=b.policy_version_id)then return true;end if;
 return exists(select 1 from private.signature_native_cancellation_attestations_v1 proof join public.signature_provider_events native on native.envelope_id=e.id and native.provider_event_id=proof.provider_event_id and native.provider_code=proof.provider_code and native.event_type='VOIDED'and native.signature_verified join storage.objects object on object.id=proof.storage_object_id join storage.buckets bucket on bucket.id=object.bucket_id where proof.envelope_id=e.id and proof.provider_code=e.provider_code and proof.provider_envelope_id=e.provider_envelope_id and proof.source_binding_hash=private.canonical_request_hash(to_jsonb(b)-'bound_at')and not bucket.public and object.metadata->>'sha256'=proof.certificate_sha256 and proof.verified_at>=native.provider_occurred_at);
end$$;
create function private.archive_unprepared_contract_envelopes_v1(p_contract_id uuid,p_contract_version_id uuid,p_reason text,p_correlation_id uuid)returns integer language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();c public.contracts%rowtype;e public.signature_envelopes%rowtype;env text;n integer:=0;r jsonb;begin
 select*into c from public.contracts where id=p_contract_id;select environment into env from private.admin_execution_environment_v1 where singleton;
 if a is null or auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],a))or env is null or length(btrim(coalesce(p_reason,'')))not between 20 and 1000 then raise exception'SIGNATURE_DRAFT_ARCHIVE_DENIED'using errcode='42501';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);select*into c from public.contracts where id=p_contract_id for update;
 if not(private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],a))then raise exception'SIGNATURE_DRAFT_ARCHIVE_DENIED'using errcode='42501';end if;
 if c.status<>'DRAFT'or not exists(select 1 from public.contract_versions where id=p_contract_version_id and contract_id=c.id and version=c.current_version)then raise exception'SIGNATURE_DRAFT_ARCHIVE_DENIED'using errcode='42501';end if;
 for e in select*from public.signature_envelopes where contract_id=c.id and contract_version_id=p_contract_version_id order by id for update loop
  perform private.require_signature_environment_v1((select environment from public.signature_provider_configs where id=e.provider_config_id),e.provider_code);
  if e.status='VOIDED'and private.signature_envelope_void_is_recorded_v1(e.id)then continue;end if;
  if e.status<>'DRAFT'or e.ready_at is not null or e.sent_at is not null or e.provider_envelope_id is not null or exists(select 1 from private.contract_signature_bindings_v1 where envelope_id=e.id)or exists(select 1 from public.signature_provider_events where envelope_id=e.id)or exists(select 1 from public.signature_attempts where envelope_id=e.id and(attempt_type<>'CREATE'or outcome<>'SUCCEEDED'))then raise exception'SIGNATURE_NATIVE_CANCELLATION_REQUIRED'using errcode='55000';end if;
  insert into private.signature_local_cancellations_v1(envelope_id,contract_version_id,source_kind,source_id,source_hash,environment,kind,cancelled_by,reason,previous_row_version)values(e.id,e.contract_version_id,case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end,coalesce(e.amendment_id,e.contract_version_id),case when e.amendment_id is null then(select content_hash from public.contract_versions where id=e.contract_version_id)else(select content_hash from public.contract_amendments where id=e.amendment_id)end,env,'UNPREPARED_DRAFT_ARCHIVED',a,btrim(p_reason),e.row_version);
  update public.signature_envelopes set status='VOIDED',completed_at=clock_timestamp(),row_version=row_version+1 where id=e.id;n:=n+1;
  r:=jsonb_build_object('outcome','SIGNATURE_UNPREPARED_DRAFT_ARCHIVED','envelope_id',e.id,'native_send',false);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,a,'USER','signature.unprepared_draft.archived','signature_envelope',e.id::text,p_correlation_id,r,repeat('0',64));
 end loop;return n;
end$$;
create function public.cancel_development_signature_envelope_v1(p_envelope_id uuid,p_expected_row_version integer,p_reason text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();c public.contracts%rowtype;e public.signature_envelopes%rowtype;env text;b private.contract_signature_bindings_v1%rowtype;hash text;r jsonb;begin
 select*into e from public.signature_envelopes where id=p_envelope_id;select*into c from public.contracts where id=e.contract_id;select environment into env from private.admin_execution_environment_v1 where singleton;
 if a is null or auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not(private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.has_org_role(c.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],a)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],a))or env is null or env not in('DEVELOPMENT','STAGING')or e.provider_code is distinct from'MATRICIA_DEV_MOCK'or not exists(select 1 from public.signature_provider_configs where id=e.provider_config_id and environment=env)then raise exception'SIGNATURE_LOCAL_MOCK_CANCELLATION_DENIED'using errcode='42501';end if;
 if p_expected_row_version is null or p_expected_row_version<1 or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 20 and 1000 then raise exception'INVALID_SIGNATURE_LOCAL_CANCELLATION'using errcode='22023';end if;
 perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);select*into c from public.contracts where id=e.contract_id for update;
 if e.amendment_id is not null then perform 1 from public.contract_amendments where id=e.amendment_id for update;end if;
 select*into e from public.signature_envelopes where id=p_envelope_id for update;
 perform private.require_signature_environment_v1(env,e.provider_code);
 if not(private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a)or private.has_org_role(c.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],a)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],a))then raise exception'SIGNATURE_LOCAL_MOCK_CANCELLATION_DENIED'using errcode='42501';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('envelope_id',e.id,'expected',p_expected_row_version,'reason',btrim(p_reason)));r:=private.begin_contract_command(c.client_organization_id,'signature.local_mock.cancel',p_idempotency_key::text,hash,a);if r is not null then return r;end if;
 if e.row_version<>p_expected_row_version then raise exception'SIGNATURE_LOCAL_CANCELLATION_STALE'using errcode='40001';end if;
 if e.status not in('DRAFT','READY_FOR_SIGNATURE')then raise exception'SIGNATURE_NATIVE_CANCELLATION_REQUIRED'using errcode='55000';end if;
 if e.provider_envelope_id is not null or e.sent_at is not null or exists(select 1 from public.signature_provider_events where envelope_id=e.id)or exists(select 1 from public.signature_attempts where envelope_id=e.id and(attempt_type not in('CREATE','READY')or outcome<>'SUCCEEDED'))then raise exception'SIGNATURE_NATIVE_CANCELLATION_REQUIRED'using errcode='55000';end if;
 select*into b from private.contract_signature_bindings_v1 where envelope_id=e.id;
 insert into private.signature_local_cancellations_v1(envelope_id,contract_version_id,source_kind,source_id,source_hash,source_binding_hash,environment,kind,cancelled_by,reason,previous_row_version)values(e.id,e.contract_version_id,case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end,coalesce(e.amendment_id,e.contract_version_id),case when e.amendment_id is null then(select content_hash from public.contract_versions where id=e.contract_version_id)else(select content_hash from public.contract_amendments where id=e.amendment_id)end,case when b.envelope_id is not null then private.canonical_request_hash(to_jsonb(b)-'bound_at')end,env,'MOCK_READY_CANCELLED',a,btrim(p_reason),e.row_version);
 update public.signature_envelopes set status='VOIDED',completed_at=clock_timestamp(),row_version=row_version+1 where id=e.id;
 if e.amendment_id is null and c.status='PENDING_SIGNATURE'and exists(select 1 from public.contract_versions where id=e.contract_version_id and contract_id=c.id and version=c.current_version)then update public.contracts set status='DRAFT',row_version=row_version+1,updated_at=clock_timestamp()where id=c.id;
 elsif e.amendment_id is not null then update public.contract_amendments set status='DRAFT'where id=e.amendment_id and status='PENDING_SIGNATURE';end if;
 r:=jsonb_build_object('outcome','SIGNATURE_DEVELOPMENT_ENVELOPE_VOIDED','envelope_id',e.id,'native_send',false,'development_mock',true);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.client_organization_id,a,'USER','signature.local_mock.cancelled','signature_envelope',e.id::text,e.correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.client_organization_id,'signature_envelope',e.id::text,'SignatureEnvelopeLocallyVoidedV1',e.correlation_id,r,'signature-local-mock-cancel:'||e.id::text)on conflict do nothing;
 perform private.finish_contract_command(c.client_organization_id,'signature.local_mock.cancel',p_idempotency_key::text,r);return r;
end$$;
revoke all on function private.signature_envelope_void_is_recorded_v1(uuid),private.archive_unprepared_contract_envelopes_v1(uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
revoke all on function public.cancel_development_signature_envelope_v1(uuid,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.cancel_development_signature_envelope_v1(uuid,integer,text,uuid)to authenticated;
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
 if e.status='VOIDED'and private.signature_envelope_void_is_recorded_v1(e.id)then return jsonb_build_object('outcome','SIGNATURE_DISPATCH_CANCELLED','envelope_id',e.id,'development_mock',true);end if;
 select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;
 if r is not null then
  if not private.signature_recorded_send_is_valid_v1(e.id)then raise exception'SIGNATURE_RECORDED_SEND_UNVERIFIED'using errcode='23514';end if;
  if not exists(select 1 from private.contract_signature_bindings_v1 bound join private.contract_signature_policy_versions_v1 policy on policy.id=bound.policy_version_id where bound.envelope_id=e.id and policy.allow_development_mock and policy.governance_proposal_id is not null)then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
  return r||jsonb_build_object('replayed',true,'development_mock',true);end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.governance_proposal_id is null or e.provider_config_id<>p.provider_config_id then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
 return public.run_mock_signature_provider(e.id,'SENT',null,'governed-dispatch:'||e.id::text,e.id)||jsonb_build_object('development_mock',true);
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
 if e.status='VOIDED'and private.signature_envelope_void_is_recorded_v1(e.id)then r:=jsonb_build_object('outcome','SIGNATURE_SIMULATION_CANCELLED','envelope_id',e.id,'development_mock',true);insert into private.signature_mock_command_results_v1(command_id,result)values(c.id,r);return r;end if;
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],c.requested_by)then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.id<>c.policy_version_id or p.governance_proposal_id is null or e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;

 if c.action='SENT'then select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;end if;
 if r is null then r:=public.run_mock_signature_provider(c.envelope_id,c.action,c.signer_id,'governed-mock:'||c.id::text,c.id);end if;
 insert into private.signature_mock_command_results_v1(command_id,result)values(c.id,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,c.requested_by,'SERVICE','signature.simulation.executed','signature_simulation',c.id::text,c.id,jsonb_build_object('envelope_id',e.id,'policy_version_id',p.id,'mode','NON_CONTRACTUAL_DEMO','step',c.action,'result',r),repeat('0',64));
 return r;
end$$;

alter function public.list_signature_policy_governance_v1()set schema private;
alter function private.list_signature_policy_governance_v1()rename to list_signature_policy_governance_core_v1;
revoke all on function private.list_signature_policy_governance_core_v1()from public,anon,authenticated,service_role;
create function public.list_signature_policy_governance_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$declare r jsonb;begin
 r:=private.list_signature_policy_governance_core_v1();
 return r||jsonb_build_object('local_envelopes',coalesce((select jsonb_agg(row_to_json(q))from(select e.id,e.contract_id,e.row_version,e.status,e.amendment_id,not(e.provider_envelope_id is not null or e.sent_at is not null or exists(select 1 from public.signature_provider_events where envelope_id=e.id)or exists(select 1 from public.signature_attempts where envelope_id=e.id and(attempt_type not in('CREATE','READY')or outcome<>'SUCCEEDED')))may_cancel from public.signature_envelopes e join public.signature_provider_configs cfg on cfg.id=e.provider_config_id where e.provider_code='MATRICIA_DEV_MOCK'and cfg.environment=(r->>'environment')and e.status in('DRAFT','READY_FOR_SIGNATURE')order by e.created_at desc,e.id desc limit 100)q),'[]'::jsonb));
end$$;
revoke all on function public.list_signature_policy_governance_v1()from public,anon,authenticated,service_role;
grant execute on function public.list_signature_policy_governance_v1()to authenticated;
notify pgrst,'reload schema';
commit;
