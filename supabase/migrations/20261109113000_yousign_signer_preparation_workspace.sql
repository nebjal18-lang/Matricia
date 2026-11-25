begin;
-- Human-only preparation projections. Never expose another signer's identity,
-- a storage path, provider reference, credential or legal-policy mutation.
create function private.my_yousign_preparation_signer_v1(p_envelope_id uuid)
returns public.signature_signers language plpgsql stable security definer
set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();s public.signature_signers%rowtype;
begin
 if actor is null or auth.role() is distinct from 'authenticated' or not private.current_auth_session_active_v1() then
  raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';
 end if;
 select signer.* into s from public.signature_signers signer
 join public.signature_envelopes e on e.id=signer.envelope_id
 join public.contracts c on c.id=e.contract_id
 where e.id=p_envelope_id and e.provider_code='YOUSIGN' and signer.signer_user_id=actor
 and signer.organization_id in(c.client_organization_id,c.provider_organization_id)
 and private.is_active_org_member(signer.organization_id,actor)
 and private.contract_party_access(c.id,actor)
 and exists(select 1 from public.contract_parties p where p.contract_version_id=e.contract_version_id and p.organization_id=signer.organization_id)
 order by signer.signing_order limit 1;
 if s.id is null then raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';end if;
 return s;
end$$;

create function public.get_my_yousign_preparation_v1(p_envelope_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,private as $$
declare s public.signature_signers%rowtype;e public.signature_envelopes%rowtype;
 i private.yousign_signer_inputs_v1%rowtype;docs jsonb;can_configure boolean;
begin
 s:=private.my_yousign_preparation_signer_v1(p_envelope_id);
 select * into e from public.signature_envelopes where id=s.envelope_id;
 select * into i from private.yousign_signer_inputs_v1 where signer_id=s.id and configured_by=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'sha256',d.sha256,'fileName',d.file_name,
  'contractVersionId',d.contract_version_id,'locale',a.locale) order by d.sort_order),'[]'::jsonb) into docs
 from public.signature_documents d
 join private.contract_signature_source_artifacts_v1 a on a.contract_version_id=d.contract_version_id
  and a.pdf_sha256=d.sha256 and a.storage_path=d.storage_path
  and a.source_kind=case when e.amendment_id is null then 'CONTRACT' else 'AMENDMENT' end
  and a.source_id=coalesce(e.amendment_id,e.contract_version_id)
  and a.parties_hash=private.contract_signature_parties_hash_v1(e.contract_version_id)
  and a.source_hash=case when e.amendment_id is null then (select content_hash from public.contract_versions where id=e.contract_version_id)
    else (select content_hash from public.contract_amendments where id=e.amendment_id) end
  and a.locale in('fr','ar') and a.render_version='SIGNATURE_SOURCE_PDF_V1'
  and a.verification_reference='HTTP_READBACK_SHA256_V1'
 where d.envelope_id=e.id and exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id
  where o.id=a.storage_object_id and o.bucket_id='signature-source-documents' and not b.public
   and o.name=a.storage_path and o.metadata->>'mimetype'='application/pdf' and o.metadata->>'size'=a.size_bytes::text);
 if jsonb_array_length(docs)=0 or jsonb_array_length(docs)<>(select count(*) from public.signature_documents where envelope_id=e.id) then
  raise exception 'YOUSIGN_PREPARATION_DOCUMENT_REQUIRED' using errcode='55000';
 end if;
 can_configure:=e.status in('DRAFT','READY_FOR_SIGNATURE')
  and exists(select 1 from auth.users u where u.id=s.signer_user_id and u.email_confirmed_at is not null
   and s.email_hash=encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex'))
  and not exists(select 1 from private.yousign_dispatch_operations_v1 where envelope_id=e.id)
  and not exists(select 1 from private.yousign_requests_v1 where envelope_id=e.id)
  and exists(select 1 from public.contracts c join public.contract_versions v on v.contract_id=c.id
   where c.id=e.contract_id and v.id=e.contract_version_id and v.version=c.current_version);
 return jsonb_build_object('envelopeId',e.id,'signerId',s.id,'contractId',e.contract_id,'amendmentId',e.amendment_id,
  'status',e.status,'canConfigure',can_configure,'firstName',coalesce(i.first_name,''),'lastName',coalesce(i.last_name,''),
  'locale',coalesce(i.locale,'fr'),'fields',coalesce(i.fields,'[]'::jsonb),'documents',docs);
end$$;

create function public.get_my_yousign_preparation_for_signer_v1(p_signer_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,private as $$
declare envelope_id uuid;workspace jsonb;
begin
 if auth.uid() is null or auth.role() is distinct from 'authenticated' or not private.current_auth_session_active_v1() then
  raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';
 end if;
 select s.envelope_id into envelope_id from public.signature_signers s where s.id=p_signer_id and s.signer_user_id=auth.uid();
 if envelope_id is null then raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';end if;
 workspace:=public.get_my_yousign_preparation_v1(envelope_id);
 if workspace->>'signerId' is distinct from p_signer_id::text then raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';end if;
 return workspace;
end$$;

create function public.get_my_yousign_preparations_v1()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or auth.role() is distinct from 'authenticated' or not private.current_auth_session_active_v1() then
  raise exception 'YOUSIGN_PREPARATION_DENIED' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('envelopeId',x.id,'contractId',x.contract_id,'amendmentId',x.amendment_id,
  'status',x.status,'configured',x.configured,'canConfigure',x.can_configure) order by x.created_at desc,x.id),'[]'::jsonb) into result
 from(select e.id,e.contract_id,e.amendment_id,e.status,e.created_at,
  exists(select 1 from private.yousign_signer_inputs_v1 i where i.signer_id=s.id and i.configured_by=actor) as configured,
  e.status in('DRAFT','READY_FOR_SIGNATURE')
   and exists(select 1 from auth.users u where u.id=s.signer_user_id and u.email_confirmed_at is not null
    and s.email_hash=encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex'))
   and not exists(select 1 from private.yousign_dispatch_operations_v1 where envelope_id=e.id)
   and not exists(select 1 from private.yousign_requests_v1 where envelope_id=e.id)
   and v.version=c.current_version as can_configure
 from public.signature_signers s join public.signature_envelopes e on e.id=s.envelope_id
 join public.contracts c on c.id=e.contract_id join public.contract_versions v on v.id=e.contract_version_id
 where s.signer_user_id=actor and e.provider_code='YOUSIGN' and e.status in('DRAFT','READY_FOR_SIGNATURE','SENT','PARTIALLY_SIGNED')
  and s.organization_id in(c.client_organization_id,c.provider_organization_id)
  and private.is_active_org_member(s.organization_id,actor) and private.contract_party_access(c.id,actor)
  and exists(select 1 from public.contract_parties p where p.contract_version_id=e.contract_version_id and p.organization_id=s.organization_id)
 order by e.created_at desc,e.id limit 50)x;
 return result;
end$$;

revoke all on function private.my_yousign_preparation_signer_v1(uuid),public.get_my_yousign_preparation_v1(uuid),public.get_my_yousign_preparation_for_signer_v1(uuid),public.get_my_yousign_preparations_v1() from public,anon,authenticated,service_role;
grant execute on function public.get_my_yousign_preparation_v1(uuid),public.get_my_yousign_preparation_for_signer_v1(uuid),public.get_my_yousign_preparations_v1() to authenticated;
commit;
