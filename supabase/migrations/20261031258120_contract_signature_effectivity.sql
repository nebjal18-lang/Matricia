begin;
-- Admission of a new contractual effect, not a reclassification of historic obligations or archives.
-- Completed evidence is checked under its frozen policy; current policy/authority revocation is not retroactive.
create index contract_amendments_activated_version_lookup on public.contract_amendments(activated_contract_version_id)where activated_contract_version_id is not null;
create function private.contract_version_signature_effective_v1(p_contract_id uuid,p_contract_version_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare env text;c public.contracts%rowtype;v public.contract_versions%rowtype;base public.contract_versions%rowtype;am public.contract_amendments%rowtype;e public.signature_envelopes%rowtype;ep public.signature_evidence_packages%rowtype;begin
 select environment into env from private.admin_execution_environment_v1 where singleton;if env is null then return false;end if;
 select*into c from public.contracts where id=p_contract_id;select*into v from public.contract_versions where id=p_contract_version_id and contract_id=c.id;
 if c.id is null or v.id is null or c.status not in('ACTIVE','AMENDED')or v.version<>c.current_version then return false;end if;
 loop
  select*into e from public.signature_envelopes where contract_id=c.id and contract_version_id=v.id and amendment_id is null and status='SIGNED'order by completed_at,envelope_version limit 1;
  if e.id is not null then exit;end if;
  select*into am from public.contract_amendments where contract_id=c.id and activated_contract_version_id=v.id and status='ACTIVE';
  select*into base from public.contract_versions where id=am.base_contract_version_id and contract_id=c.id and version=v.version-1;
  if am.id is null or base.id is null then return false;end if;
  select*into e from public.signature_envelopes where contract_id=c.id and contract_version_id=base.id and amendment_id=am.id and status='SIGNED'order by completed_at,envelope_version limit 1;
  if e.id is null or(e.provider_code='MATRICIA_DEV_MOCK'and env not in('DEVELOPMENT','STAGING'))then return false;end if;
  ep:=private.require_completed_contract_signature_v1(e.id);
  if(select count(*)from public.contract_amendment_signatures signed where signed.amendment_id=am.id and signed.organization_id in(c.client_organization_id,c.provider_organization_id)and signed.amendment_hash=am.content_hash and signed.proof->>'envelope_id'=e.id::text and signed.proof->>'evidence_hash'=ep.final_hash and exists(select 1 from public.signature_signers signer where signer.envelope_id=e.id and signer.organization_id=signed.organization_id and signer.signer_user_id=signed.signer_user_id and signer.signer_role=signed.signer_role))<>2 then return false;end if;
  v:=base;
 end loop;
 select*into e from public.signature_envelopes where contract_id=c.id and contract_version_id=v.id and amendment_id is null and status='SIGNED'order by completed_at,envelope_version limit 1;
 if e.id is null or(e.provider_code='MATRICIA_DEV_MOCK'and env not in('DEVELOPMENT','STAGING'))then return false;end if;
 ep:=private.require_completed_contract_signature_v1(e.id);
 return(select count(*)from public.contract_signatures signed where signed.contract_id=c.id and signed.contract_version_id=v.id and signed.organization_id in(c.client_organization_id,c.provider_organization_id)and signed.contract_hash=v.content_hash and signed.proof->>'envelope_id'=e.id::text and signed.proof->>'evidence_hash'=ep.final_hash and exists(select 1 from public.signature_signers signer where signer.envelope_id=e.id and signer.organization_id=signed.organization_id and signer.signer_user_id=signed.signer_user_id and signer.signer_role=signed.signer_role))=2;
exception when others then return false;
end$$;
revoke all on function private.contract_version_signature_effective_v1(uuid,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
