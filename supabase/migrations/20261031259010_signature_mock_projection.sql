begin;
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
