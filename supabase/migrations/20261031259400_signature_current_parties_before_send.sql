begin;
-- Current identity/financial state authorizes a new send, never rewrites a completed native fact.
create function private.assert_signature_new_commitment_v1(p_envelope_id uuid,p_lock boolean default true)returns void language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;c public.contracts%rowtype;current_client jsonb;client_hash text;provider_hash text;begin
 select*into e from public.signature_envelopes where id=p_envelope_id;select*into c from public.contracts where id=e.contract_id;
 if e.id is null or c.id is null then raise exception'SIGNATURE_SOURCE_BINDING_MISMATCH'using errcode='23514';end if;
 if p_lock then perform private.lock_contract_financial_parties_v1(c.client_organization_id,c.provider_organization_id);end if;
 -- A volatile post-lock command sees any identity/hold committed before the lock was obtained.
 if not private.subscription_financially_clear(c.client_organization_id)then raise exception'CLIENT_FINANCIAL_HOLD_ACTIVE'using errcode='55000';end if;
 current_client:=private.current_client_contract_party_v1(c.client_organization_id);
 select legal_snapshot->>'verified_identity_hash'into client_hash from public.contract_parties where contract_version_id=e.contract_version_id and organization_id=c.client_organization_id and party_role='CLIENT';
 if current_client is null or client_hash is distinct from current_client->>'verified_identity_hash'then raise exception'SIGNATURE_CURRENT_CLIENT_IDENTITY_REQUIRED'using errcode='55000';end if;
 select legal_snapshot->>'verified_identity_hash'into provider_hash from public.contract_parties where contract_version_id=e.contract_version_id and organization_id=c.provider_organization_id and party_role='PROVIDER';
 if not private.provider_current_identity_is_verified_v1(c.provider_organization_id)or provider_hash is distinct from private.canonical_request_hash(private.provider_current_identity_snapshot_v1(c.provider_organization_id))then raise exception'SIGNATURE_CURRENT_PROVIDER_IDENTITY_REQUIRED'using errcode='55000';end if;
 if private.provider_has_overdue_matricia_invoice(c.provider_organization_id)then raise exception'PROVIDER_FINANCIAL_HOLD_ACTIVE'using errcode='55000';end if;
end$$;
revoke all on function private.assert_signature_new_commitment_v1(uuid,boolean)from public,anon,authenticated,service_role;
create or replace function private.assert_contract_signature_binding_v1(p_envelope_id uuid,p_completed boolean default false)returns private.contract_signature_bindings_v1 language plpgsql volatile security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;v public.contract_versions%rowtype;c public.contracts%rowtype;am public.contract_amendments%rowtype;b private.contract_signature_bindings_v1%rowtype;p private.contract_signature_policy_versions_v1%rowtype;cfg public.signature_provider_configs%rowtype;begin
 select*into e from public.signature_envelopes where id=p_envelope_id;select*into b from private.contract_signature_bindings_v1 where envelope_id=e.id;select*into p from private.contract_signature_policy_versions_v1 where id=b.policy_version_id;select*into cfg from public.signature_provider_configs where id=e.provider_config_id;
 perform private.require_signature_environment_v1(cfg.environment,e.provider_code);
 select*into v from public.contract_versions where id=e.contract_version_id;select*into c from public.contracts where id=e.contract_id;select*into am from public.contract_amendments where id=e.amendment_id;
 if b.envelope_id is null or p.provider_config_id is distinct from e.provider_config_id or p.environment is distinct from cfg.environment or p.approved_at>b.bound_at or b.bound_at>=p.valid_until or b.source_id is distinct from coalesce(e.amendment_id,v.id)or b.requested_level is distinct from e.requested_level or b.contract_version_id is distinct from v.id or b.contract_version_hash is distinct from v.content_hash or b.pdf_sha256 is distinct from e.document_set_hash or b.parties_hash is distinct from private.contract_signature_parties_hash_v1(v.id)or b.signers_hash is distinct from private.contract_signature_signers_hash_v1(e.id)or b.documents_hash is distinct from private.contract_signature_documents_hash_v1(e.id)or b.source_hash is distinct from(case when e.amendment_id is null then v.content_hash else am.content_hash end)or(b.source_kind='AMENDMENT')<>(e.amendment_id is not null)or(b.source_kind='AMENDMENT'and(am.contract_id is distinct from c.id or am.base_contract_version_id is distinct from v.id))or(not p_completed and b.source_kind='CONTRACT'and v.version<>c.current_version)or(not p_completed and b.source_kind='AMENDMENT'and v.version<>c.current_version and am.activated_contract_version_id is distinct from(select id from public.contract_versions where contract_id=c.id and version=c.current_version))then raise exception'SIGNATURE_SOURCE_BINDING_MISMATCH'using errcode='23514';end if;
 if cfg.provider_code='MATRICIA_DEV_MOCK'and not p.allow_development_mock then raise exception'SIGNATURE_DEVELOPMENT_PROVIDER_FORBIDDEN'using errcode='42501';end if;
 if not p_completed then
  if e.status='READY_FOR_SIGNATURE'then perform private.assert_signature_new_commitment_v1(e.id,true);end if;
  if (private.require_contract_signature_policy_v1(b.source_kind)).id is distinct from p.id then raise exception'SIGNATURE_POLICY_SCOPE_MISMATCH'using errcode='23514';end if;
  perform private.assert_contract_signature_parties_v1(e.id,clock_timestamp());
 end if;
 if p_completed and(e.status<>'SIGNED'or e.completed_at is null or e.achieved_level is distinct from e.requested_level or array_position(array['SIMPLE','ADVANCED','QUALIFIED'],e.achieved_level)<array_position(array['SIMPLE','ADVANCED','QUALIFIED'],p.minimum_level)or exists(select 1 from public.signature_signers where envelope_id=e.id and(status<>'SIGNED'or achieved_level is distinct from e.achieved_level)))then raise exception'SIGNATURE_COMPLETED_ENVELOPE_REQUIRED'using errcode='23514';end if;
 return b;
end$$;
create or replace function private.freeze_contract_signature_binding_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
declare e public.signature_envelopes%rowtype;v public.contract_versions%rowtype;am public.contract_amendments%rowtype;p private.contract_signature_policy_versions_v1%rowtype;a private.contract_signature_source_artifacts_v1%rowtype;kind text;source uuid;hash text;parties text;begin
 if new.status<>'READY_FOR_SIGNATURE'or old.status='READY_FOR_SIGNATURE'then return new;end if;
 select*into e from public.signature_envelopes where id=new.id;select*into v from public.contract_versions where id=e.contract_version_id;select*into am from public.contract_amendments where id=e.amendment_id;
 kind:=case when e.amendment_id is null then'CONTRACT'else'AMENDMENT'end;source:=coalesce(e.amendment_id,v.id);hash:=case when e.amendment_id is null then v.content_hash else am.content_hash end;
 perform private.assert_signature_new_commitment_v1(e.id,true);
 p:=private.require_contract_signature_policy_v1(kind);
 if e.provider_config_id<>p.provider_config_id or array_position(array['SIMPLE','ADVANCED','QUALIFIED'],e.requested_level)<array_position(array['SIMPLE','ADVANCED','QUALIFIED'],p.minimum_level)or(e.amendment_id is not null and(am.contract_id<>e.contract_id or am.base_contract_version_id<>v.id or am.status not in('DRAFT','PENDING_SIGNATURE')))then raise exception'SIGNATURE_POLICY_SCOPE_MISMATCH'using errcode='23514';end if;
 perform private.assert_contract_signature_parties_v1(e.id,clock_timestamp());parties:=private.contract_signature_parties_hash_v1(v.id);
 if(select count(*)from public.signature_documents where envelope_id=e.id)<>1 or not exists(select 1 from public.signature_documents where envelope_id=e.id and document_type=kind and contract_version_id=v.id and exact_version=case when kind='CONTRACT'then v.version else am.amendment_number end and sha256=e.document_set_hash)then raise exception'SIGNATURE_EXACT_DOCUMENT_REQUIRED'using errcode='23514';end if;
 select*into a from private.contract_signature_source_artifacts_v1 where source_kind=kind and source_id=source and contract_version_id=v.id and source_hash=hash and parties_hash=parties and pdf_sha256=e.document_set_hash and storage_path=(select storage_path from public.signature_documents where envelope_id=e.id)and verified_at<=clock_timestamp()and exists(select 1 from storage.objects o join storage.buckets bucket on bucket.id=o.bucket_id where o.id=storage_object_id and o.name=storage_path and not bucket.public);
 if a.id is null and not p.allow_development_mock then raise exception'SIGNATURE_DOCUMENT_ARCHIVE_REQUIRED'using errcode='55000';end if;
 insert into private.contract_signature_bindings_v1(envelope_id,policy_version_id,contract_version_id,contract_version_hash,requested_level,source_kind,source_id,source_hash,parties_hash,signers_hash,documents_hash,pdf_sha256,source_artifact_id)values(e.id,p.id,v.id,v.content_hash,e.requested_level,kind,source,hash,parties,private.contract_signature_signers_hash_v1(e.id),private.contract_signature_documents_hash_v1(e.id),e.document_set_hash,a.id);
 return new;
end$$;
create or replace function private.contract_signature_readiness_v1(p_contract_id uuid,p_amendment_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare c public.contracts%rowtype;v public.contract_versions%rowtype;am public.contract_amendments%rowtype;e public.signature_envelopes%rowtype;p private.contract_signature_policy_versions_v1%rowtype;env text;kind text;source uuid;hash text;result jsonb;begin
 select*into c from public.contracts where id=p_contract_id;
 if auth.uid()is null or c.id is null or not private.contract_party_access(c.id,auth.uid())then raise exception'SIGNATURE_READINESS_DENIED'using errcode='42501';end if;
 if p_amendment_id is not null then select*into am from public.contract_amendments where id=p_amendment_id and contract_id=c.id;if am.id is null then raise exception'SIGNATURE_READINESS_DENIED'using errcode='42501';end if;end if;
 select environment into env from private.admin_execution_environment_v1 where singleton;kind:=case when am.id is null then'CONTRACT'else'AMENDMENT'end;
 select*into v from public.contract_versions where contract_id=c.id and(case when am.id is null then version=c.current_version else id=am.base_contract_version_id end);
 source:=coalesce(am.id,v.id);hash:=case when am.id is null then v.content_hash else am.content_hash end;
 result:=jsonb_build_object('contract_id',c.id,'amendment_id',am.id,'environment',env,'ready',false,'development_mock',false,'provider_code',null);
 if v.id is null then return result||jsonb_build_object('status','BLOCKED','reason','CONTRACT_VERSION_REQUIRED');end if;
 select*into e from public.signature_envelopes q where q.contract_id=c.id and q.status='SIGNED'and(case when am.id is null then(q.amendment_id is null and q.contract_version_id=v.id)or exists(select 1 from public.contract_amendments prior where prior.id=q.amendment_id and prior.activated_contract_version_id=v.id)else q.amendment_id=am.id end)order by envelope_version desc limit 1;
 if e.id is not null then
  result:=result||jsonb_build_object('development_mock',e.provider_code='MATRICIA_DEV_MOCK','provider_code',e.provider_code);
  begin perform private.require_completed_contract_signature_v1(e.id);return result||jsonb_build_object('status','SIGNED','reason','SIGNATURE_EVIDENCE_VERIFIED','envelope_id',e.id,'requested_level',e.requested_level);
  exception when others then return result||jsonb_build_object('status','BLOCKED','reason','SIGNATURE_LEGACY_PROOF_UNVERIFIED');end;
 end if;
 if(am.id is null and c.status in('ACTIVE','AMENDED','COMPLETED'))or(am.id is not null and am.status='ACTIVE')then return result||jsonb_build_object('status','BLOCKED','reason','SIGNATURE_LEGACY_PROOF_UNVERIFIED');end if;
 begin p:=private.require_contract_signature_policy_v1(kind);exception when sqlstate'55000'or sqlstate'42501'then return result||jsonb_build_object('status','NOT_CONFIGURED','reason','SIGNATURE_PROVIDER_NOT_CONFIGURED');end;
 if not p.allow_development_mock and not exists(select 1 from private.contract_signature_source_artifacts_v1 where source_kind=kind and source_id=source and contract_version_id=v.id and source_hash=hash and parties_hash=private.contract_signature_parties_hash_v1(v.id))then return result||jsonb_build_object('status','DOCUMENT_ARCHIVE_REQUIRED','reason','SIGNATURE_DOCUMENT_ARCHIVE_REQUIRED','requested_level',p.minimum_level);end if;
 select*into e from public.signature_envelopes where contract_id=c.id and contract_version_id=v.id and amendment_id is not distinct from am.id and status in('DRAFT','READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED')order by envelope_version desc limit 1;
 if e.id is null then return result||jsonb_build_object('status','ENVELOPE_REQUIRED','reason','SIGNATURE_ENVELOPE_REQUIRED','requested_level',p.minimum_level);end if;
 result:=result||jsonb_build_object('envelope_id',e.id,'requested_level',e.requested_level,'development_mock',e.provider_code='MATRICIA_DEV_MOCK','provider_code',e.provider_code);
 if e.provider_config_id<>p.provider_config_id or array_position(array['SIMPLE','ADVANCED','QUALIFIED'],e.requested_level)<array_position(array['SIMPLE','ADVANCED','QUALIFIED'],p.minimum_level)then return result||jsonb_build_object('status','BLOCKED','reason','SIGNATURE_POLICY_SCOPE_MISMATCH');end if;
 begin perform private.assert_contract_signature_parties_v1(e.id,statement_timestamp());if e.status<>'DRAFT'then perform private.assert_contract_signature_binding_v1(e.id,false);end if;exception when others then return result||jsonb_build_object('status','AUTHORITIES_REQUIRED','reason','SIGNER_AUTHORITY_REQUIRED');end;
 if e.status in('SENT','PARTIALLY_SIGNED')or(am.id is null and c.status='PENDING_SIGNATURE')or(am.id is not null and am.status='PENDING_SIGNATURE')then return result||jsonb_build_object('status','AWAITING_PROVIDER','reason','SIGNATURE_PROVIDER_PENDING');end if;
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(c.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then return result||jsonb_build_object('status','BLOCKED','reason','SIGNATURE_CLIENT_AAL2_SUBMISSION_REQUIRED');end if;
 return result||jsonb_build_object('status','READY_TO_SUBMIT','ready',true,'reason','SIGNATURE_PREREQUISITES_VERIFIED');
end$$;

notify pgrst,'reload schema';
commit;
