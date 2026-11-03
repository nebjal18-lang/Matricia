begin;
-- A current identity attestation is bound to the current three reviewed CLEAN
-- versions; pending/replaced/expired evidence cannot revive an old attestation.
do $$declare definition text;begin
 select pg_get_functiondef('private.provider_current_identity_is_verified_v1(uuid)'::regprocedure)into definition;
 if strpos(definition,'and h.id=')=0 then raise exception'PROVIDER_CURRENT_DOCUMENT_BINDING_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'and h.id=','and private.provider_current_identity_documents_v1(p_org)is not null and h.document_version_ids=private.provider_current_identity_documents_v1(p_org)and h.id=');execute definition;
end$$;
-- The identity-review API already carries expected_profile_row_version.
-- Serialize insertion/review of the three identity kinds against that same
-- profile row so its CAS also binds the exact evidence visible to the reviewer.
create function private.bump_provider_identity_evidence_context_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from public.provider_document_families where id=new.family_id and provider_organization_id=new.provider_organization_id and document_kind in('LEGAL','FISCAL','INSURANCE'))then
  update public.provider_profiles set row_version=row_version+1,updated_at=clock_timestamp()where provider_organization_id=new.provider_organization_id;
 end if;
 return new;
end$$;
revoke all on function private.bump_provider_identity_evidence_context_v1()from public,anon,authenticated,service_role;
create trigger provider_identity_evidence_context_version after insert on public.provider_document_versions for each row execute function private.bump_provider_identity_evidence_context_v1();
commit;
