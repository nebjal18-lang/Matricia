begin;
alter function public.authorize_client_dispute_attachment_v1(uuid)rename to authorize_client_dispute_attachment_legacy_0442;
revoke all on function public.authorize_client_dispute_attachment_legacy_0442(uuid)from public,anon,authenticated,service_role;
create function public.authorize_client_dispute_attachment_v1(p_evidence_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare e public.dispute_evidence%rowtype;d public.provider_document_versions%rowtype;p public.delivery_proofs%rowtype;bucket text;path text;file_name text;mime text;size text;source_hash text;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.dispute_evidence_access(p_evidence_id)then raise exception 'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
 select * into e from public.dispute_evidence where id=p_evidence_id;
 if e.evidence_type='DOCUMENT'and e.metadata->>'source_document_id'is not null then return public.authorize_client_dispute_attachment_legacy_0442(p_evidence_id);end if;
 if e.evidence_type='DOCUMENT'and e.metadata->>'source_provider_document_id'is not null then
  select v.* into d from public.provider_document_versions v join public.dispute_cases c on c.id=e.dispute_case_id
  where v.id=(e.metadata->>'source_provider_document_id')::uuid and v.provider_organization_id=c.provider_organization_id and v.provider_organization_id=e.submitted_by_organization_id and v.status='VERIFIED'
  and v.storage_object_path=e.storage_path and v.content_hash=e.evidence_hash and private.provider_document_is_clean(v.storage_object_path,v.content_hash);
  if d.id is null then raise exception 'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
  bucket:='provider-qualification';path:=d.storage_object_path;mime:=d.metadata->>'declared_mime_type';size:=d.metadata->>'declared_size_bytes';source_hash:=d.content_hash;
  file_name:='document-'||d.id::text||case mime when'application/pdf'then'.pdf'when'image/png'then'.png'when'image/jpeg'then'.jpg'else''end;
 elsif e.evidence_type='DELIVERY_PROOF'and e.metadata->>'source_delivery_proof_id'is not null then
  select proof.* into p from public.delivery_proofs proof join public.delivery_versions v on v.id=proof.delivery_version_id join public.deliverables dl on dl.id=v.deliverable_id join public.dispute_cases c on c.id=e.dispute_case_id
  where proof.id=(e.metadata->>'source_delivery_proof_id')::uuid and dl.mission_id=c.mission_id and proof.storage_path=e.storage_path and proof.evidence_hash=e.evidence_hash and proof.scan_status='CLEAN'
  and exists(select 1 from private.delivery_proof_scan_results s where s.id=proof.current_scan_result_id and s.proof_id=proof.id and s.result='CLEAN'and s.computed_sha256=proof.evidence_hash);
  if p.id is null or p.storage_path is null then raise exception 'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
  bucket:=p.storage_bucket;path:=p.storage_path;source_hash:=p.evidence_hash;
  select o.metadata->>'mimetype',o.metadata->>'size'into mime,size from storage.objects o where o.bucket_id=bucket and o.name=path;
  file_name:='livraison-'||p.id::text||case mime when'application/pdf'then'.pdf'when'image/png'then'.png'when'image/jpeg'then'.jpg'else''end;
 else raise exception 'DISPUTE_EVIDENCE_DENIED'using errcode='42501';end if;
 if bucket not in('provider-qualification','delivery-proofs')or mime not in('application/pdf','image/png','image/jpeg')or mime is null or coalesce(size,'')!~'^[1-9][0-9]{0,8}$'or size::bigint>10485760 then raise exception 'DISPUTE_EVIDENCE_UNAVAILABLE'using errcode='55000';end if;
 return jsonb_build_object('evidence_id',e.id,'bucket',bucket,'object_path',path,'file_name',file_name,'mime_type',mime,'size_bytes',size,'sha256',source_hash);
end$$;
revoke all on function public.authorize_client_dispute_attachment_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.authorize_client_dispute_attachment_v1(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
