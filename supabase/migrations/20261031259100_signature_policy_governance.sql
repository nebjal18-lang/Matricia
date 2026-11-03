begin;
-- Owner-provisioned evidence of an actual installed adapter and approved legal scope.
-- No attestation, issuer or real provider is seeded or writable through the application.
create table private.signature_adapter_attestations_v1(
 id uuid primary key default extensions.gen_random_uuid(),environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 issuer_organization_id uuid not null references public.organizations(id),provider_config_id uuid not null references public.signature_provider_configs(id),
 source_kinds text[] not null check(cardinality(source_kinds)>0 and source_kinds<@array['CONTRACT','AMENDMENT','FRANCHISE_MANDATE']::text[]),
 levels text[] not null check(cardinality(levels)>0 and levels<@array['SIMPLE','ADVANCED','QUALIFIED']::text[]),
 legal_approval_reference text not null,adapter_registration_reference text not null,verification_reference text not null,
 verified_by uuid not null references auth.users(id),reviewed_by uuid not null references auth.users(id),verified_at timestamptz not null,valid_until timestamptz not null,
 check(verified_by<>reviewed_by),check(valid_until>verified_at),check(length(verification_reference)between 8 and 500)
);
create table private.signature_policy_proposals_v1(
 id uuid primary key default extensions.gen_random_uuid(),environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 issuer_organization_id uuid not null references public.organizations(id),source_kind text not null check(source_kind in('CONTRACT','AMENDMENT','FRANCHISE_MANDATE')),
 provider_config_id uuid not null references public.signature_provider_configs(id),minimum_level text not null check(minimum_level in('SIMPLE','ADVANCED','QUALIFIED')),
 development_mock boolean not null,require_certificate boolean not null,require_trusted_timestamp boolean not null,
 legal_approval_reference text not null,adapter_registration_reference text not null,valid_hours integer not null check(valid_hours between 1 and 8760),
 reason text not null check(length(btrim(reason))between 20 and 1000),content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),
 proposed_by uuid not null references auth.users(id),idempotency_key uuid not null,proposed_at timestamptz not null default clock_timestamp(),unique(proposed_by,idempotency_key)
);
create table private.signature_policy_decisions_v1(
 proposal_id uuid primary key references private.signature_policy_proposals_v1(id),decision text not null check(decision in('APPROVED','REJECTED')),
 decided_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 20 and 1000),content_hash text not null,
 policy_version_id uuid,decided_at timestamptz not null default clock_timestamp(),check((decision='APPROVED')=(policy_version_id is not null))
);
create table private.signature_policy_revocations_v1(
 policy_version_id uuid primary key,proposal_id uuid not null references private.signature_policy_proposals_v1(id),revoked_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason))between 20 and 1000),revoked_at timestamptz not null default clock_timestamp(),voided_mock_envelopes integer not null default 0
);
alter table private.contract_signature_policy_versions_v1 add column issuer_organization_id uuid references public.organizations(id),add column governance_proposal_id uuid unique references private.signature_policy_proposals_v1(id),add column governance_content_hash text check(governance_content_hash~'^[0-9a-f]{64}$');
alter table private.franchise_mandate_signature_policies_v1 add column governance_proposal_id uuid unique references private.signature_policy_proposals_v1(id),add column governance_content_hash text check(governance_content_hash~'^[0-9a-f]{64}$');
revoke all on private.signature_adapter_attestations_v1,private.signature_policy_proposals_v1,private.signature_policy_decisions_v1,private.signature_policy_revocations_v1 from public,anon,authenticated,service_role;
create trigger signature_adapter_attestation_immutable before update or delete on private.signature_adapter_attestations_v1 for each row execute function private.prevent_contract_immutable_change();
create trigger signature_policy_proposal_immutable before update or delete on private.signature_policy_proposals_v1 for each row execute function private.prevent_contract_immutable_change();
create trigger signature_policy_decision_immutable before update or delete on private.signature_policy_decisions_v1 for each row execute function private.prevent_contract_immutable_change();
create trigger signature_policy_revocation_immutable before update or delete on private.signature_policy_revocations_v1 for each row execute function private.prevent_contract_immutable_change();
create function private.require_signature_policy_admin_v1(p_write boolean default true)returns uuid language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare a uuid:=auth.uid();begin
 if a is null or auth.role()is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(case when p_write then array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER']else array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']end,a)then raise exception'SIGNATURE_POLICY_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;return a;
end$$;
create function public.propose_signature_policy_v1(p_issuer_organization_id uuid,p_source_kind text,p_provider_config_id uuid,p_minimum_level text,p_require_certificate boolean,p_require_trusted_timestamp boolean,p_legal_approval_reference text,p_adapter_registration_reference text,p_valid_hours integer,p_reason text,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=private.require_signature_policy_admin_v1();env text;cfg public.signature_provider_configs%rowtype;q private.signature_policy_proposals_v1%rowtype;h text;mock boolean;r jsonb;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;if env is null then raise exception'SIGNATURE_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 select*into cfg from public.signature_provider_configs where id=p_provider_config_id;mock:=cfg.provider_code='MATRICIA_DEV_MOCK';
 if p_source_kind is null or p_source_kind not in('CONTRACT','AMENDMENT','FRANCHISE_MANDATE')or p_minimum_level is null or p_minimum_level not in('SIMPLE','ADVANCED','QUALIFIED')or p_require_certificate is null or p_require_trusted_timestamp is null or p_valid_hours is null or p_valid_hours not between 1 and 8760 or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 20 and 1000 or coalesce(p_legal_approval_reference,'')!~'^[A-Z][A-Z0-9_.:/-]{7,199}$'or coalesce(p_adapter_registration_reference,'')!~'^[A-Z][A-Z0-9_.:/-]{7,199}$'then raise exception'INVALID_SIGNATURE_POLICY_PROPOSAL'using errcode='22023';end if;
 if cfg.id is null or cfg.environment is distinct from env or cfg.status<>'ACTIVE'or cfg.valid_from>clock_timestamp()or cfg.valid_until<=clock_timestamp()or not(p_minimum_level=any(cfg.supported_levels))or not exists(select 1 from public.organizations where id=p_issuer_organization_id and status='ACTIVE')then raise exception'SIGNATURE_POLICY_SCOPE_MISMATCH'using errcode='23514';end if;
 if mock and(env not in('DEVELOPMENT','STAGING')or p_source_kind='FRANCHISE_MANDATE'or p_minimum_level<>'SIMPLE'or p_require_certificate or p_require_trusted_timestamp or p_valid_hours>24)then raise exception'SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY'using errcode='42501';end if;
 if not mock and(p_minimum_level<>'SIMPLE'and(not p_require_certificate or not p_require_trusted_timestamp))then raise exception'SIGNATURE_LEVEL_EVIDENCE_REQUIRED'using errcode='23514';end if;
 h:=private.canonical_request_hash(jsonb_build_object('environment',env,'issuer',p_issuer_organization_id,'source_kind',p_source_kind,'provider_config',cfg.id,'level',p_minimum_level,'certificate',p_require_certificate,'timestamp',p_require_trusted_timestamp,'legal_reference',p_legal_approval_reference,'adapter_reference',p_adapter_registration_reference,'valid_hours',p_valid_hours,'reason',btrim(p_reason),'development_mock',mock));
 insert into private.signature_policy_proposals_v1(environment,issuer_organization_id,source_kind,provider_config_id,minimum_level,development_mock,require_certificate,require_trusted_timestamp,legal_approval_reference,adapter_registration_reference,valid_hours,reason,content_hash,proposed_by,idempotency_key)values(env,p_issuer_organization_id,p_source_kind,cfg.id,p_minimum_level,mock,p_require_certificate,p_require_trusted_timestamp,p_legal_approval_reference,p_adapter_registration_reference,p_valid_hours,btrim(p_reason),h,a,p_idempotency_key)on conflict do nothing;
 select*into q from private.signature_policy_proposals_v1 where proposed_by=a and idempotency_key=p_idempotency_key;if q.content_hash is distinct from h then raise exception'SIGNATURE_POLICY_IDEMPOTENCY_MISMATCH'using errcode='22000';end if;
 r:=jsonb_build_object('outcome','SIGNATURE_POLICY_PROPOSED','proposal_id',q.id,'content_hash',h,'environment',env,'development_mock',mock);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)select q.issuer_organization_id,a,'USER','signature.policy.proposed','signature_policy_proposal',q.id::text,q.id,r,repeat('0',64)where not exists(select 1 from public.audit_events where action='signature.policy.proposed'and resource_id=q.id::text);
 return r;
end$$;
create function public.decide_signature_policy_v1(p_proposal_id uuid,p_expected_content_hash text,p_approve boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=private.require_signature_policy_admin_v1();q private.signature_policy_proposals_v1%rowtype;d private.signature_policy_decisions_v1%rowtype;cfg public.signature_provider_configs%rowtype;env text;v integer;pid uuid;until_at timestamptz;r jsonb;begin
 select*into q from private.signature_policy_proposals_v1 where id=p_proposal_id for update;select environment into env from private.admin_execution_environment_v1 where singleton;
 if q.id is null or env is null or q.environment<>env then raise exception'SIGNATURE_POLICY_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if q.proposed_by=a then raise exception'FOUR_EYES_REQUIRED'using errcode='42501';end if;
 if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],q.proposed_by)then raise exception'SIGNATURE_POLICY_PROPOSER_AUTHORITY_REVOKED'using errcode='42501';end if;
 if q.content_hash is distinct from p_expected_content_hash or p_approve is null or length(btrim(coalesce(p_reason,'')))not between 20 and 1000 then raise exception'SIGNATURE_POLICY_REVIEW_MISMATCH'using errcode='23514';end if;
 select*into d from private.signature_policy_decisions_v1 where proposal_id=q.id;if d.proposal_id is not null then if(d.decision='APPROVED')<>p_approve or d.content_hash<>p_expected_content_hash then raise exception'SIGNATURE_POLICY_DECISION_CONFLICT'using errcode='22000';end if;return jsonb_build_object('outcome','SIGNATURE_POLICY_'||d.decision,'proposal_id',q.id,'policy_version_id',d.policy_version_id,'replayed',true);end if;
 if p_approve then
  select*into cfg from public.signature_provider_configs where id=q.provider_config_id;until_at:=q.proposed_at+make_interval(hours=>q.valid_hours);
  if until_at<=clock_timestamp()or cfg.environment<>env or cfg.status<>'ACTIVE'or cfg.valid_from>clock_timestamp()or cfg.valid_until<=clock_timestamp()or not(q.minimum_level=any(cfg.supported_levels))or not exists(select 1 from public.organizations where id=q.issuer_organization_id and status='ACTIVE')then raise exception'SIGNATURE_POLICY_SCOPE_MISMATCH'using errcode='23514';end if;
  if q.development_mock then if env not in('DEVELOPMENT','STAGING')or cfg.provider_code<>'MATRICIA_DEV_MOCK'or q.source_kind='FRANCHISE_MANDATE'or q.minimum_level<>'SIMPLE'or q.require_certificate or q.require_trusted_timestamp or q.valid_hours>24 then raise exception'SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY'using errcode='42501';end if;
  elsif cfg.provider_code='MATRICIA_DEV_MOCK'or not exists(select 1 from private.signature_adapter_attestations_v1 t where t.environment=env and t.issuer_organization_id=q.issuer_organization_id and t.provider_config_id=cfg.id and q.source_kind=any(t.source_kinds)and q.minimum_level=any(t.levels)and t.legal_approval_reference=q.legal_approval_reference and t.adapter_registration_reference=q.adapter_registration_reference and t.verified_at<=clock_timestamp()and t.valid_until>=until_at)then raise exception'SIGNATURE_REAL_ADAPTER_VALIDATION_REQUIRED'using errcode='55000';end if;
  perform pg_advisory_xact_lock(hashtextextended('signature-policy:'||env||':'||q.source_kind,0));
  if q.source_kind='FRANCHISE_MANDATE'then
   select coalesce(max(version),0)+1 into v from private.franchise_mandate_signature_policies_v1 where environment=env and issuer_organization_id=q.issuer_organization_id;
   insert into private.franchise_mandate_signature_policies_v1(environment,issuer_organization_id,version,provider_config_id,minimum_level,require_certificate,require_trusted_timestamp,legal_approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at,valid_until,governance_proposal_id,governance_content_hash)values(env,q.issuer_organization_id,v,cfg.id,q.minimum_level,q.require_certificate,q.require_trusted_timestamp,q.legal_approval_reference,q.adapter_registration_reference,q.proposed_by,a,clock_timestamp(),until_at,q.id,q.content_hash)returning id into pid;
  else
   select coalesce(max(version),0)+1 into v from private.contract_signature_policy_versions_v1 where environment=env and source_kind=q.source_kind;
   insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at,valid_until,issuer_organization_id,governance_proposal_id,governance_content_hash)values(env,q.source_kind,v,cfg.id,q.minimum_level,q.development_mock,q.require_certificate,q.require_trusted_timestamp,q.legal_approval_reference,q.adapter_registration_reference,q.proposed_by,a,clock_timestamp(),until_at,q.issuer_organization_id,q.id,q.content_hash)returning id into pid;
  end if;
 end if;
 insert into private.signature_policy_decisions_v1(proposal_id,decision,decided_by,reason,content_hash,policy_version_id)values(q.id,case when p_approve then'APPROVED'else'REJECTED'end,a,btrim(p_reason),q.content_hash,pid);
 r:=jsonb_build_object('outcome',case when p_approve then'SIGNATURE_POLICY_APPROVED'else'SIGNATURE_POLICY_REJECTED'end,'proposal_id',q.id,'policy_version_id',pid,'environment',env,'development_mock',q.development_mock,'valid_until',until_at);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(q.issuer_organization_id,a,'USER','signature.policy.decided','signature_policy_proposal',q.id::text,q.id,r,repeat('0',64));return r;
end$$;
create function public.disable_signature_policy_v1(p_proposal_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=private.require_signature_policy_admin_v1();q private.signature_policy_proposals_v1%rowtype;d private.signature_policy_decisions_v1%rowtype;env text;n integer:=0;r jsonb;begin
 select*into q from private.signature_policy_proposals_v1 where id=p_proposal_id for update;select*into d from private.signature_policy_decisions_v1 where proposal_id=q.id;select environment into env from private.admin_execution_environment_v1 where singleton;
 if q.id is null or d.decision is distinct from'APPROVED'or env is null or q.environment<>env or length(btrim(coalesce(p_reason,'')))not between 20 and 1000 then raise exception'SIGNATURE_POLICY_DISABLE_DENIED'using errcode='42501';end if;
 if exists(select 1 from private.signature_policy_revocations_v1 where policy_version_id=d.policy_version_id)then return jsonb_build_object('outcome','SIGNATURE_POLICY_DISABLED','proposal_id',q.id,'replayed',true);end if;
 -- Immediate safety stop needs one authorized AAL2 actor; enabling always needs another reviewer.
 if q.development_mock then
  update public.signature_envelopes e set status='VOIDED',row_version=row_version+1 where e.provider_code='MATRICIA_DEV_MOCK'and e.status in('DRAFT','READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED')and exists(select 1 from private.contract_signature_bindings_v1 b where b.envelope_id=e.id and b.policy_version_id=d.policy_version_id);
  get diagnostics n=row_count;
 end if;
 insert into private.signature_policy_revocations_v1(policy_version_id,proposal_id,revoked_by,reason,voided_mock_envelopes)values(d.policy_version_id,q.id,a,btrim(p_reason),n);
 r:=jsonb_build_object('outcome','SIGNATURE_POLICY_DISABLED','proposal_id',q.id,'policy_version_id',d.policy_version_id,'voided_mock_envelopes',n,'development_mock',q.development_mock);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(q.issuer_organization_id,a,'USER','signature.policy.disabled','signature_policy_proposal',q.id::text,q.id,r,repeat('0',64));return r;
end$$;
create function public.list_signature_policy_governance_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare a uuid:=private.require_signature_policy_admin_v1(false);env text;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 return jsonb_build_object('environment',env,'can_write',private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],a),'providers',coalesce((select jsonb_agg(jsonb_build_object('id',cfg.id,'code',cfg.provider_code,'supported_levels',cfg.supported_levels))from public.signature_provider_configs cfg where cfg.environment=env and cfg.status='ACTIVE'and cfg.valid_from<=statement_timestamp()and(cfg.valid_until is null or cfg.valid_until>statement_timestamp())),'[]'::jsonb),'proposals',coalesce((select jsonb_agg(rowdata order by proposed_at desc)from(select q.proposed_at,to_jsonb(q)-'idempotency_key'||jsonb_build_object('provider_code',cfg.provider_code,'may_decide',q.proposed_by<>a,'status',case when revoked.policy_version_id is not null then'DISABLED'when d.decision='APPROVED'and q.proposed_at+make_interval(hours=>q.valid_hours)<=statement_timestamp()then'EXPIRED'else coalesce(d.decision,'PENDING')end,'policy_version_id',d.policy_version_id,'valid_until',q.proposed_at+make_interval(hours=>q.valid_hours))rowdata from private.signature_policy_proposals_v1 q join public.signature_provider_configs cfg on cfg.id=q.provider_config_id left join private.signature_policy_decisions_v1 d on d.proposal_id=q.id left join private.signature_policy_revocations_v1 revoked on revoked.policy_version_id=d.policy_version_id where q.environment=env order by q.proposed_at desc,q.id desc limit 100)records),'[]'::jsonb));
end$$;
create or replace function private.require_contract_signature_policy_v1(p_kind text)returns private.contract_signature_policy_versions_v1 language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare env text;p private.contract_signature_policy_versions_v1%rowtype;cfg public.signature_provider_configs%rowtype;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if env is null then raise exception'SIGNATURE_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 select*into p from private.contract_signature_policy_versions_v1 where environment=env and source_kind=p_kind and approved_at<=statement_timestamp()order by version desc limit 1;
 if p.id is null or p.valid_until<=statement_timestamp()or exists(select 1 from private.signature_policy_revocations_v1 where policy_version_id=p.id)then raise exception'SIGNATURE_PROVIDER_NOT_CONFIGURED'using errcode='55000';end if;
 select*into cfg from public.signature_provider_configs where id=p.provider_config_id;
 perform private.require_signature_environment_v1(env,cfg.provider_code);
 if cfg.environment is distinct from env or cfg.status<>'ACTIVE'or cfg.valid_from>statement_timestamp()or cfg.valid_until<=statement_timestamp()or not(p.minimum_level=any(cfg.supported_levels))or(p.allow_development_mock is distinct from(cfg.provider_code='MATRICIA_DEV_MOCK'))then raise exception'SIGNATURE_PROVIDER_NOT_CONFIGURED'using errcode='55000';end if;
 return p;
end$$;
create or replace function private.franchise_mandate_signature_reference_v1(p_franchise_id uuid,p_mandate_version_id uuid,p_mandate_hash text,p_operator_org_id uuid,p_actor uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private set timezone='UTC' as $$
declare f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;proof private.franchise_mandate_signature_proofs_v1%rowtype;policy private.franchise_mandate_signature_policies_v1%rowtype;cfg public.signature_provider_configs%rowtype;env text;party private.franchise_mandate_signature_parties_v1%rowtype;expected text;party_hash text;begin
 if p_actor is null or p_mandate_hash is null or p_mandate_hash!~'^[0-9a-f]{64}$'then return null;end if;
 select*into f from public.franchises where id=p_franchise_id;select*into m from public.franchise_mandate_versions where id=p_mandate_version_id and franchise_id=f.id;
 if f.id is null or m.id is null or f.operator_organization_id is distinct from p_operator_org_id or m.content_hash is distinct from p_mandate_hash or not private.is_active_org_member(p_operator_org_id,p_actor)then return null;end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;if env is null then return null;end if;
 if m.id is distinct from(select q.mandate_version_id from public.franchise_approval_requests q where q.franchise_id=f.id and q.status='APPROVED'order by q.decided_at desc,q.id desc limit 1)then return null;end if;
 select*into proof from private.franchise_mandate_signature_proofs_v1 where franchise_id=f.id and source_mandate_version_id=m.id and source_version=m.version and source_hash=m.content_hash and operator_organization_id=p_operator_org_id order by verified_at desc limit 1;
 if proof.id is null then return null;end if;select*into policy from private.franchise_mandate_signature_policies_v1 where id=proof.policy_version_id;select*into cfg from public.signature_provider_configs where id=policy.provider_config_id;
 if exists(select 1 from private.signature_policy_revocations_v1 where policy_version_id=policy.id)then return null;end if;
 if policy.id is null or policy.environment is distinct from env or cfg.environment is distinct from env or policy.issuer_organization_id is distinct from proof.issuer_organization_id or cfg.provider_code is distinct from proof.provider_code or cfg.provider_code='MATRICIA_DEV_MOCK'or cfg.status<>'ACTIVE'or cfg.valid_from>proof.completed_at or cfg.valid_until<proof.completed_at or policy.approved_at>proof.completed_at or policy.valid_until<clock_timestamp()or proof.completed_at>clock_timestamp()or proof.verified_at<proof.completed_at or proof.verified_at>clock_timestamp()or array_position(array['SIMPLE','ADVANCED','QUALIFIED'],proof.achieved_level)<array_position(array['SIMPLE','ADVANCED','QUALIFIED'],policy.minimum_level)or not(proof.achieved_level=any(cfg.supported_levels))then return null;end if;
 if not exists(select 1 from public.organizations where id=proof.issuer_organization_id and status='ACTIVE')or not exists(select 1 from public.organizations where id=p_operator_org_id and status='ACTIVE')or exists(select 1 from(values(proof.pdf_storage_object_id),(proof.evidence_storage_object_id))required(id)where not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=required.id and not b.public))then return null;end if;
 if not exists(select 1 from jsonb_array_elements(proof.verified_events)event where event->>'event_type'='SENT')or exists(select 1 from jsonb_array_elements(proof.verified_events)event where coalesce(event->>'event_type','')not in('SENT','SIGNER_SIGNED')or length(coalesce(event->>'provider_event_id',''))not between 8 and 200 or length(coalesce(event->>'nonce',''))not between 8 and 200 or event->>'source_binding_hash'is distinct from proof.source_binding_hash or coalesce(event->>'payload_sha256','')!~'^[0-9a-f]{64}$'or coalesce(event->>'signature_fingerprint','')!~'^[0-9a-f]{64}$')or(select count(distinct event->>'provider_event_id')from jsonb_array_elements(proof.verified_events)event)<>jsonb_array_length(proof.verified_events)or(select count(distinct event->>'nonce')from jsonb_array_elements(proof.verified_events)event)<>jsonb_array_length(proof.verified_events)then return null;end if;
 if proof.source_binding_hash is distinct from private.franchise_mandate_source_binding_hash_v1(proof.id)or proof.event_chain_hash is distinct from private.canonical_request_hash(proof.verified_events)or(select count(*)from private.franchise_mandate_signature_parties_v1 where proof_id=proof.id)<>2 then return null;end if;
 for party in select*from private.franchise_mandate_signature_parties_v1 where proof_id=proof.id loop
  if party.organization_id is distinct from(case when party.party_role='ISSUER'then proof.issuer_organization_id else p_operator_org_id end)or(party.party_role='OPERATOR'and party.signer_user_id<>p_actor)or not private.is_active_org_member(party.organization_id,party.signer_user_id)or not exists(select 1 from auth.users u where u.id=party.signer_user_id and u.email_confirmed_at is not null and party.verified_email_sha256=encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex'))or party.achieved_level is distinct from proof.achieved_level or party.authority_source_hash is distinct from m.content_hash or party.authority_valid_from>party.signed_at or party.authority_valid_until<party.signed_at or party.signed_at>proof.completed_at or not exists(select 1 from jsonb_array_elements(proof.verified_events)event where event->>'event_type'='SIGNER_SIGNED'and event->>'provider_event_id'=party.provider_event_id and event->>'signer_reference'=party.provider_signer_reference and event->>'source_binding_hash'=proof.source_binding_hash and coalesce(event->>'payload_sha256','')~'^[0-9a-f]{64}$'and coalesce(event->>'signature_fingerprint','')~'^[0-9a-f]{64}$')then return null;end if;
  if policy.require_certificate and(party.certificate_status is distinct from'VERIFIED'or party.certificate_fingerprint is null or party.certificate_valid_from is null or party.certificate_valid_until is null or party.certificate_valid_from>party.signed_at or party.certificate_valid_until<party.signed_at or(proof.achieved_level='QUALIFIED'and party.certificate_qualification is distinct from'QUALIFIED'))then return null;end if;
  if policy.require_trusted_timestamp and(party.timestamp_status is distinct from'VERIFIED'or party.timestamp_token_hash is null or party.timestamped_at is null or abs(extract(epoch from(party.timestamped_at-party.signed_at)))>300)then return null;end if;
 end loop;
 select private.canonical_request_hash(jsonb_agg(to_jsonb(q)order by q.party_role))into party_hash from private.franchise_mandate_signature_parties_v1 q where proof_id=proof.id;
 expected:=private.canonical_request_hash(jsonb_build_object('source_binding_hash',proof.source_binding_hash,'provider_code',proof.provider_code,'provider_envelope_id',proof.provider_envelope_id,'provider_package_id',proof.provider_package_id,'provider_package_sha256',proof.provider_package_sha256,'level',proof.achieved_level,'event_chain_hash',proof.event_chain_hash,'parties_hash',party_hash));
 if proof.final_hash is distinct from expected then return null;end if;
 return jsonb_build_object('proofLedgerId',proof.id,'legalDocumentVersionId',proof.legal_document_version_id,'policyVersionId',policy.id,'providerCode',proof.provider_code,'signatureLevel',proof.achieved_level,'issuerOrg',proof.issuer_organization_id,'operatorOrg',proof.operator_organization_id,'signerUserId',p_actor,'sourceMandateId',m.id,'sourceVersion',m.version,'sourceHash',m.content_hash,'sourceBindingHash',proof.source_binding_hash,'finalHash',proof.final_hash);
exception when others then return null;
end$$;
create table private.signature_mock_commands_v1(
 id uuid primary key default extensions.gen_random_uuid(),envelope_id uuid not null references public.signature_envelopes(id),policy_version_id uuid not null references private.contract_signature_policy_versions_v1(id),
 action text not null check(action in('SENT','SIGNER_SIGNED')),signer_id uuid references public.signature_signers(id),requested_by uuid not null references auth.users(id),
 idempotency_key uuid not null,request_hash text not null,requested_at timestamptz not null default clock_timestamp(),unique(requested_by,idempotency_key),check((action='SIGNER_SIGNED')=(signer_id is not null))
);
create table private.signature_mock_command_results_v1(command_id uuid primary key references private.signature_mock_commands_v1(id),result jsonb not null,completed_at timestamptz not null default clock_timestamp());
revoke all on private.signature_mock_commands_v1,private.signature_mock_command_results_v1 from public,anon,authenticated,service_role;
create trigger signature_mock_command_immutable before update or delete on private.signature_mock_commands_v1 for each row execute function private.prevent_contract_immutable_change();
create trigger signature_mock_result_immutable before update or delete on private.signature_mock_command_results_v1 for each row execute function private.prevent_contract_immutable_change();
create function public.request_signature_mock_step_v1(p_envelope_id uuid,p_action text,p_signer_id uuid,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare a uuid:=private.require_signature_policy_admin_v1();e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;c private.signature_mock_commands_v1%rowtype;h text;env text;begin
 select*into e from public.signature_envelopes where id=p_envelope_id;select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or env is null or env not in('DEVELOPMENT','STAGING')or e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY'using errcode='42501';end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.governance_proposal_id is null or e.provider_config_id<>p.provider_config_id then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
 perform private.assert_contract_signature_binding_v1(e.id,false);
 if p_action is null or p_action not in('SENT','SIGNER_SIGNED')or(p_action='SIGNER_SIGNED')<>(p_signer_id is not null)or(p_signer_id is not null and not exists(select 1 from public.signature_signers where id=p_signer_id and envelope_id=e.id))or p_idempotency_key is null then raise exception'INVALID_SIGNATURE_SIMULATION_STEP'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('envelope_id',e.id,'action',p_action,'signer_id',p_signer_id,'policy_id',p.id));
 insert into private.signature_mock_commands_v1(envelope_id,policy_version_id,action,signer_id,requested_by,idempotency_key,request_hash)values(e.id,p.id,p_action,p_signer_id,a,p_idempotency_key,h)on conflict do nothing;
 select*into c from private.signature_mock_commands_v1 where requested_by=a and idempotency_key=p_idempotency_key;if c.request_hash<>h then raise exception'SIGNATURE_SIMULATION_IDEMPOTENCY_MISMATCH'using errcode='22000';end if;
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(e.client_organization_id,'signature_simulation',c.id::text,'SignatureSimulationStepRequestedV1',c.id,jsonb_build_object('command_id',c.id,'mode','NON_CONTRACTUAL_DEMO'),'governed-signature-simulation:'||c.id::text)on conflict do nothing;
 return jsonb_build_object('outcome','SIGNATURE_SIMULATION_QUEUED','command_id',c.id,'development_mock',true);
end$$;
create function public.execute_signature_mock_step_v1(p_command_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare c private.signature_mock_commands_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;e public.signature_envelopes%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into c from private.signature_mock_commands_v1 where id=p_command_id for update;select environment into env from private.admin_execution_environment_v1 where singleton;
 if c.id is null or env is null or env not in('DEVELOPMENT','STAGING')or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],c.requested_by)then raise exception'SIGNATURE_SIMULATION_EXECUTION_DENIED'using errcode='42501';end if;
 select*into e from public.signature_envelopes where id=c.envelope_id;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.id<>c.policy_version_id or p.governance_proposal_id is null or e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
 select result into r from private.signature_mock_command_results_v1 where command_id=c.id;if found then return r||jsonb_build_object('replayed',true);end if;
 if c.action='SENT'then select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;end if;
 if r is null then r:=public.run_mock_signature_provider(c.envelope_id,c.action,c.signer_id,'governed-mock:'||c.id::text,c.id);end if;
 insert into private.signature_mock_command_results_v1(command_id,result)values(c.id,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(e.client_organization_id,c.requested_by,'SERVICE','signature.simulation.executed','signature_simulation',c.id::text,c.id,jsonb_build_object('envelope_id',e.id,'policy_version_id',p.id,'mode','NON_CONTRACTUAL_DEMO','step',c.action,'result',r),repeat('0',64));
 return r;
end$$;
revoke all on function public.request_signature_mock_step_v1(uuid,text,uuid,uuid),public.execute_signature_mock_step_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.request_signature_mock_step_v1(uuid,text,uuid,uuid)to authenticated;
grant execute on function public.execute_signature_mock_step_v1(uuid)to service_role;
create function public.dispatch_governed_signature_envelope_v1(p_envelope_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;r jsonb;env text;begin
 if auth.role()is distinct from'service_role'then raise exception'SIGNATURE_DISPATCH_DENIED'using errcode='42501';end if;
 select*into e from public.signature_envelopes where id=p_envelope_id for update;select environment into env from private.admin_execution_environment_v1 where singleton;
 if e.id is null or env is null then raise exception'SIGNATURE_PROVIDER_NOT_CONFIGURED'using errcode='55000';end if;
 if e.provider_code<>'MATRICIA_DEV_MOCK'then raise exception'SIGNATURE_REAL_ADAPTER_VALIDATION_REQUIRED'using errcode='55000';end if;
 if env not in('DEVELOPMENT','STAGING')then raise exception'SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY'using errcode='42501';end if;
 if e.status='VOIDED'and exists(select 1 from private.contract_signature_bindings_v1 b join private.signature_policy_revocations_v1 revoked on revoked.policy_version_id=b.policy_version_id where b.envelope_id=e.id)then return jsonb_build_object('outcome','SIGNATURE_DISPATCH_CANCELLED','envelope_id',e.id,'development_mock',true);end if;
 p:=private.require_contract_signature_policy_v1(case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end);
 if not p.allow_development_mock or p.governance_proposal_id is null or e.provider_config_id<>p.provider_config_id then raise exception'SIGNATURE_GOVERNED_MOCK_POLICY_REQUIRED'using errcode='55000';end if;
 select processing_result into r from public.signature_provider_events where envelope_id=e.id and event_type='SENT'and signature_verified order by provider_occurred_at limit 1;
 if r is not null then return r||jsonb_build_object('replayed',true,'development_mock',true);end if;
 return public.run_mock_signature_provider(e.id,'SENT',null,'governed-dispatch:'||e.id::text,e.id)||jsonb_build_object('development_mock',true);
end$$;
revoke all on function public.dispatch_governed_signature_envelope_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.dispatch_governed_signature_envelope_v1(uuid)to service_role;
revoke all on function private.require_signature_policy_admin_v1(boolean)from public,anon,authenticated,service_role;
revoke all on function public.propose_signature_policy_v1(uuid,text,uuid,text,boolean,boolean,text,text,integer,text,uuid),public.decide_signature_policy_v1(uuid,text,boolean,text),public.disable_signature_policy_v1(uuid,text),public.list_signature_policy_governance_v1()from public,anon,authenticated,service_role;
grant execute on function public.propose_signature_policy_v1(uuid,text,uuid,text,boolean,boolean,text,text,integer,text,uuid),public.decide_signature_policy_v1(uuid,text,boolean,text),public.disable_signature_policy_v1(uuid,text),public.list_signature_policy_governance_v1()to authenticated;
notify pgrst,'reload schema';
commit;
