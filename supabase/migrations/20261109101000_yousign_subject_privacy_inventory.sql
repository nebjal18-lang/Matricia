begin;
-- Native signature metadata is a verified-signatory source. Provider files
-- remain untrusted review candidates; no antivirus or disclosure is inferred.
create or replace function private.dsr_all_collect_file_sources_v1(p_request_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.data_subject_requests%rowtype;subject_user uuid;spec record;entries jsonb:='[]';part jsonb;unknown jsonb;avatar text;begin
 select*into d from public.data_subject_requests where id=p_request_id;subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.verified_at is null or d.request_type not in('ACCESS','PORTABILITY')or subject_user is null then raise exception'DSR_VERIFIED_SUBJECT_REQUIRED'using errcode='42501';end if;
 for spec in select*from(values
('private.yousign_native_artifacts_v1','private.yousign_native_artifacts_v1 r join public.signature_envelopes envelope on envelope.id=r.envelope_id join public.contracts contract on contract.id=envelope.contract_id join public.signature_signers signer on signer.envelope_id=envelope.id join storage.objects object on object.id=r.storage_object_id','envelope.provider_code=''YOUSIGN'' and $1 in(contract.client_organization_id,contract.provider_organization_id) and signer.organization_id=$1 and signer.signer_user_id=$2 and (r.kind=''SIGNED_PDF'' or (r.kind=''AUDIT_JSON'' and exists(select 1 from private.yousign_signer_references_v1 own where own.envelope_id=r.envelope_id and own.signer_id=signer.id and own.provider_signer_id=r.provider_reference)))','r.envelope_id::text||'':''||r.kind||'':''||r.provider_reference::text','''signature-provider-evidence''','r.storage_path','r.sha256','case when object.metadata->>''size''~''^[0-9]{1,15}$'' then(object.metadata->>''size'')::bigint end','case r.kind when ''SIGNED_PDF'' then ''application/pdf'' else ''application/json'' end','lower(r.kind)||''-''||r.provider_reference::text||case r.kind when ''SIGNED_PDF'' then ''.pdf'' else ''.json'' end','UNTRUSTED'),
('public.finance_cost_document_uploads_v1','public.finance_cost_document_uploads_v1 r','r.organization_id=$1','r.id::text','r.storage_bucket','r.storage_path','r.sha256','r.size_bytes','r.mime_type','r.file_name','FINANCE_COST_DOCUMENT'),
('public.client_compliance_documents','public.client_compliance_documents r','r.organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.declared_sha256','r.declared_size_bytes','r.detected_mime_type','r.original_file_name','CLIENT_DOCUMENT'),
('public.provider_document_versions','public.provider_document_versions r','r.provider_organization_id=$1','r.id::text','''provider-qualification''','r.storage_object_path','r.content_hash','null','null','null','PROVIDER_DOCUMENT'),
('public.provider_document_upload_reservations','public.provider_document_upload_reservations r','r.provider_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','null','r.declared_size_bytes','r.declared_mime_type','null','UNTRUSTED'),
('public.provider_document_scan_jobs','public.provider_document_scan_jobs r','r.provider_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.declared_sha256','null','r.declared_mime_type','null','PROVIDER_SCAN_JOB'),
('public.provider_payment_proof_uploads','public.provider_payment_proof_uploads r','r.provider_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.declared_sha256','r.declared_size_bytes','r.declared_mime_type','r.original_file_name','PAYMENT_UPLOAD'),
('public.provider_payment_proofs','public.provider_payment_proofs r','r.provider_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.sha256','r.size_bytes','r.mime_type','r.original_file_name','PAYMENT_PROOF'),
('public.provider_payable_event_proofs','public.provider_payable_event_proofs r','r.provider_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.sha256','r.size_bytes','r.mime_type','r.original_file_name','PAYABLE_PROOF'),
('public.delivery_proofs','public.delivery_proofs r join public.delivery_versions v on v.id=r.delivery_version_id join public.deliverables dv on dv.id=v.deliverable_id join public.missions m on m.id=dv.mission_id','($1 in(m.client_organization_id,m.provider_organization_id))','r.id::text','r.storage_bucket','r.storage_path','r.evidence_hash','null','null','null','DELIVERY_PROOF'),
('public.internal_message_attachment_uploads','public.internal_message_attachment_uploads r join public.internal_message_drafts dr on dr.id=r.draft_id','dr.sender_organization_id=$1','r.id::text','r.storage_bucket','r.storage_path','r.expected_sha256','r.size_bytes','r.media_type','r.original_file_name','MESSAGE_UPLOAD'),
('public.internal_message_attachments','public.internal_message_attachments r join public.internal_messages m on m.id=r.message_id','m.sender_organization_id=$1','r.id::text','r.storage_bucket','r.storage_object_path','r.sha256','r.size_bytes','r.mime_type','r.original_file_name','MESSAGE_ATTACHMENT'),
('public.provider_billing_document_artifacts','public.provider_billing_document_artifacts r','r.provider_organization_id=$1','r.id::text','''provider-billing''','r.storage_path','r.pdf_sha256','null','''application/pdf''','null','PROVIDER_PDF'),
('public.client_commercial_document_artifacts','public.client_commercial_document_artifacts r join public.client_commercial_documents doc on doc.id=r.document_id','doc.organization_id=$1','r.document_id::text||'':''||r.locale','''client-billing-documents''','r.storage_path','r.pdf_sha256','r.size_bytes','''application/pdf''','null','CLIENT_PDF'),
('private.contract_signature_source_artifacts_v1','private.contract_signature_source_artifacts_v1 r join public.contract_versions v on v.id=r.contract_version_id join public.contracts c on c.id=v.contract_id','$1 in(c.client_organization_id,c.provider_organization_id)','r.id::text','''signature-source-documents''','r.storage_path','r.pdf_sha256','r.size_bytes','''application/pdf''','null','CONTRACT_PDF'),
('public.signature_documents','public.signature_documents r join public.contract_versions v on v.id=r.contract_version_id join public.contracts c on c.id=v.contract_id','$1 in(c.client_organization_id,c.provider_organization_id)','r.id::text','''signature-source-documents''','r.storage_path','r.sha256','null','r.mime_type','r.file_name','SIGNATURE_DOCUMENT'),
('public.signature_signer_authorities','public.signature_signer_authorities r','r.organization_id=$1','r.id::text','null','r.evidence_storage_path','r.evidence_sha256','null','null','null','UNTRUSTED'),
('public.dispute_evidence','public.dispute_evidence r join public.dispute_cases c on c.id=r.dispute_case_id','$1 in(c.client_organization_id,c.provider_organization_id)','r.id::text','null','r.storage_path','r.evidence_hash','null','null','null','UNTRUSTED'),
('public.brand_assets','public.brand_assets r','r.organization_id=$1','r.id::text','null','r.storage_path','r.content_hash','null','null','null','UNTRUSTED'),
('public.social_media_assets','public.social_media_assets r','r.organization_id=$1','r.id::text','null','r.storage_path','r.sha256','r.byte_length','r.media_type','null','UNTRUSTED'),
('public.organization_export_artifacts','public.organization_export_artifacts r','r.organization_id=$1','r.id::text','null','r.storage_reference','r.sha256','r.size_bytes','null','null','UNTRUSTED'),
('public.privacy_notices','public.privacy_notices r','r.organization_id=$1','r.id::text','null','r.storage_reference','r.content_hash','null','null','null','UNTRUSTED'),
('public.data_subject_requests','public.data_subject_requests r','r.organization_id=$1 and r.subject_reference_hash=(select subject_reference_hash from public.data_subject_requests where id=$3)','r.id::text','null','r.export_storage_reference','null','null','null','null','UNTRUSTED'),
('public.admin_external_validation_evidence_versions','public.admin_external_validation_evidence_versions r','r.submitted_by=$2','r.id::text','null','r.storage_reference','r.evidence_sha256','null','null','null','UNTRUSTED'),
('private.signature_native_cancellation_attestations_v1','private.signature_native_cancellation_attestations_v1 r join public.signature_envelopes e on e.id=r.envelope_id join public.contracts c on c.id=e.contract_id join storage.objects obj on obj.id=r.storage_object_id','$1 in(c.client_organization_id,c.provider_organization_id)','r.envelope_id::text','obj.bucket_id','obj.name','r.certificate_sha256','null','null','null','UNTRUSTED'),
('private.franchise_mandate_signature_proofs_v1:pdf','private.franchise_mandate_signature_proofs_v1 r join storage.objects obj on obj.id=r.pdf_storage_object_id','$1 in(r.issuer_organization_id,r.operator_organization_id)','r.id::text','obj.bucket_id','obj.name','r.pdf_sha256','null','null','null','UNTRUSTED'),
('private.franchise_mandate_signature_proofs_v1:evidence','private.franchise_mandate_signature_proofs_v1 r join storage.objects obj on obj.id=r.evidence_storage_object_id','$1 in(r.issuer_organization_id,r.operator_organization_id)','r.id::text','obj.bucket_id','obj.name','null','null','null','null','UNTRUSTED'),
('public.dsr_redacted_file_uploads_v1','public.dsr_redacted_file_uploads_v1 r join public.data_subject_requests req on req.id=r.request_id','r.organization_id=$1 and req.subject_reference_hash=(select subject_reference_hash from public.data_subject_requests where id=$3)','r.id::text','r.storage_bucket','r.storage_path','r.expected_sha256','r.size_bytes','r.mime_type','r.file_name','DSR_REDACTED'))registry(source_type,from_sql,scope_sql,id_sql,bucket_sql,path_sql,sha_sql,size_sql,mime_sql,name_sql,trust_kind)loop
  execute format('select coalesce(jsonb_agg(private.dsr_file_candidate_v1(%L,%s,to_jsonb(r),%s,%s,%s,%s,%s,%s,%L)order by %s),''[]''::jsonb)from %s where(%s)and(%s)is not null',spec.source_type,spec.id_sql,spec.bucket_sql,spec.path_sql,spec.sha_sql,spec.size_sql,spec.mime_sql,spec.name_sql,spec.trust_kind,spec.id_sql,spec.from_sql,spec.scope_sql,spec.path_sql)into part using d.organization_id,subject_user,d.id;
  entries:=entries||part;
 end loop;
 -- Earlier private JSON responses are actual files owned by this subject, not just metadata.
 select coalesce(jsonb_agg(private.dsr_file_candidate_v1('public.dsr_private_responses_v1',r.id::text,to_jsonb(r),null,r.id::text,r.sha256,octet_length(r.response_json)::bigint,'application/json','privacy-response-'||r.id::text||'.json','INLINE_DSR_RESPONSE')order by r.id),'[]')into part from public.dsr_private_responses_v1 r join public.data_subject_requests request on request.id=r.request_id where request.organization_id=d.organization_id and r.subject_user_id=subject_user;
 entries:=entries||part;
 -- Unbound delivery uploads remain personal-file candidates when their actual
 -- owner and deliverable both establish this subject/organization scope.
 select coalesce(jsonb_agg(private.dsr_file_candidate_v1('storage.delivery_orphan',o.id::text,to_jsonb(o),o.bucket_id,o.name,null,null,null,'Unbound personal delivery upload','UNTRUSTED')order by o.id),'[]')into part from storage.objects o join public.deliverables deliverable on deliverable.id::text=split_part(o.name,'/',2)join public.missions mission on mission.id=deliverable.mission_id where o.bucket_id='delivery-proofs'and o.owner_id=subject_user::text and split_part(o.name,'/',1)=subject_user::text and d.organization_id in(mission.client_organization_id,mission.provider_organization_id)and not exists(select 1 from public.delivery_proofs proof where proof.storage_bucket=o.bucket_id and proof.storage_path=o.name);
 entries:=entries||part;
 -- A reservation, scan projection and reviewed document may reference the same
 -- physical object. Keep one byte-delivery slot with its complete captured lineage.
 with original as(select entry,coalesce(entry->>'storage_object_id',entry->>'id')physical from jsonb_array_elements(entries)entry),ranked as(select*,row_number()over(partition by physical order by case entry->>'trust_kind'when'PROVIDER_DOCUMENT'then 1 when'PAYMENT_PROOF'then 1 when'PAYABLE_PROOF'then 1 when'MESSAGE_ATTACHMENT'then 1 when'UNTRUSTED'then 9 else 2 end,entry->>'id')priority from original),grouped as(select physical,jsonb_agg(jsonb_build_object('source_type',entry->>'source_type','source_id',entry->>'source_id','source_hash',entry->>'source_hash')order by entry->>'id')aliases from original group by physical)
 select coalesce(jsonb_agg(r.entry||jsonb_build_object('id',private.canonical_request_hash(jsonb_build_object('physical_source',r.physical)),'primary_source_hash',r.entry->>'source_hash','source_aliases',g.aliases,'source_hash',private.canonical_request_hash(jsonb_build_object('primary_source_hash',r.entry->>'source_hash','aliases',g.aliases)))order by r.physical),'[]')into entries from ranked r join grouped g using(physical)where r.priority=1;
 -- Account avatar references are candidates only for the verified subject.
 select coalesce(nullif(raw_user_meta_data->>'avatar_url',''),nullif(raw_user_meta_data->>'picture',''))into avatar from auth.users where id=subject_user;
 if avatar is not null then entries:=entries||jsonb_build_array(private.dsr_file_candidate_v1('auth.users.avatar',subject_user::text,jsonb_build_object('user_id',subject_user,'avatar_reference_hash',private.canonical_request_hash(to_jsonb(avatar))),null,avatar,null,null,null,'Account avatar reference','UNTRUSTED'));end if;
 -- New Storage reference families must be added explicitly before claiming complete coverage.
 select coalesce(jsonb_agg(family order by family),'[]')into unknown from(select distinct c.table_schema||'.'||c.table_name family from information_schema.columns c where c.table_schema in('public','private')and c.column_name in('storage_path','storage_object_path','storage_reference','export_storage_reference','evidence_storage_path','storage_object_id','pdf_storage_object_id','evidence_storage_object_id')and c.data_type in('text','uuid')and c.table_name not in('provider_document_scan_jobs')and(c.table_schema||'.'||c.table_name)<>all(array[
'private.yousign_native_artifacts_v1','private.contract_signature_source_artifacts_v1','private.franchise_mandate_signature_proofs_v1','private.signature_native_cancellation_attestations_v1','public.admin_external_validation_evidence_versions','public.brand_assets','public.client_commercial_document_artifacts','public.client_compliance_documents','public.data_subject_requests','public.delivery_proofs','public.dispute_evidence','public.dsr_redacted_file_uploads_v1','public.internal_message_attachment_uploads','public.internal_message_attachments','public.organization_export_artifacts','public.privacy_notices','public.provider_billing_document_artifacts','public.provider_document_scan_jobs','public.provider_document_upload_reservations','public.provider_document_versions','public.provider_payable_event_proofs','public.provider_payment_proof_uploads','public.provider_payment_proofs','public.finance_cost_document_uploads_v1','public.signature_documents','public.signature_signer_authorities','public.social_media_assets']))families;
 if jsonb_array_length(entries)>10000 or octet_length(entries::text)>12582912 then raise exception'DSR_FILE_CAPTURE_TOO_LARGE'using errcode='54000';end if;
 return jsonb_build_object('collector_version',1,'entries',entries,'hash',private.canonical_request_hash(entries),'coverage_complete',jsonb_array_length(unknown)=0,'uncovered_families',unknown);
end$$;

-- The existing curated rowset already contains personally signed contracts.
-- Extend that reviewed source rather than pretending an envelope's creator is
-- every signatory or following organization membership to unrelated records.
alter function private.dsr_subject_financial_rows_v2(uuid) rename to dsr_subject_financial_rows_before_yousign_v2;
create function private.dsr_subject_financial_rows_v2(p_request_id uuid)
returns table(source text,record_id text,record jsonb) language plpgsql stable security definer
set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare d public.data_subject_requests%rowtype;subject_user uuid;begin
 if not private.dsr_response_staff_v1() then raise exception 'DSR_RESPONSE_STAFF_REQUIRED' using errcode='42501';end if;
 select * into d from public.data_subject_requests where id=p_request_id;
 subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.status<>'IN_REVIEW' or d.verified_at is null or d.request_type not in ('ACCESS','PORTABILITY') or subject_user is null then raise exception 'PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED' using errcode='42501';end if;
 return query select * from private.dsr_subject_financial_rows_before_yousign_v2(d.id);
 return query with own_signers as (
  select s.id signer_id,s.envelope_id from public.signature_signers s
  join public.signature_envelopes e on e.id=s.envelope_id
  join public.contracts c on c.id=e.contract_id
  where s.signer_user_id=subject_user and s.organization_id=d.organization_id
   and d.organization_id in(c.client_organization_id,c.provider_organization_id)
   and e.provider_code='YOUSIGN'
 ), native_rows as (
  select 'YOUSIGN_SIGNER_INPUT'::text source,i.signer_id::text record_id,
   jsonb_build_object('source','YOUSIGN_SIGNER_INPUT','id',i.signer_id,'envelope_id',s.envelope_id,'signer_id',i.signer_id,'first_name',i.first_name,'last_name',i.last_name,'locale',i.locale,'signature_fields',i.fields,'configured_at',i.configured_at) record
  from private.yousign_signer_inputs_v1 i join own_signers s on s.signer_id=i.signer_id
  union all
  select 'YOUSIGN_REQUEST',r.envelope_id::text,
   jsonb_build_object('source','YOUSIGN_REQUEST','id',r.envelope_id,'envelope_id',r.envelope_id,'provider_request_id',r.provider_request_id,'created_at',r.created_at)
  from private.yousign_requests_v1 r where exists(select 1 from own_signers s where s.envelope_id=r.envelope_id)
  union all
  select 'YOUSIGN_DISPATCH',o.envelope_id::text||':'||o.operation,
   jsonb_build_object('source','YOUSIGN_DISPATCH','id',o.envelope_id::text||':'||o.operation,'envelope_id',o.envelope_id,'operation',o.operation,'outcome',o.outcome,'updated_at',o.updated_at)
  from private.yousign_dispatch_operations_v1 o where exists(select 1 from own_signers s where s.envelope_id=o.envelope_id)
  union all
  select 'YOUSIGN_DOCUMENT_REFERENCE',r.envelope_id::text||':'||r.source_sha256,
   jsonb_build_object('source','YOUSIGN_DOCUMENT_REFERENCE','id',r.envelope_id::text||':'||r.source_sha256,'envelope_id',r.envelope_id,'source_sha256',r.source_sha256,'provider_document_id',r.provider_document_id)
  from private.yousign_document_references_v1 r where exists(select 1 from own_signers s where s.envelope_id=r.envelope_id)
  union all
  select 'YOUSIGN_SIGNER_REFERENCE',r.signer_id::text,
   jsonb_build_object('source','YOUSIGN_SIGNER_REFERENCE','id',r.signer_id,'envelope_id',r.envelope_id,'signer_id',r.signer_id,'provider_signer_id',r.provider_signer_id)
  from private.yousign_signer_references_v1 r join own_signers s on s.envelope_id=r.envelope_id and s.signer_id=r.signer_id
  union all
  select 'YOUSIGN_NATIVE_ARTIFACT',a.envelope_id::text||':'||a.kind||':'||a.provider_reference::text,
   jsonb_build_object('source','YOUSIGN_NATIVE_ARTIFACT','id',a.envelope_id::text||':'||a.kind||':'||a.provider_reference::text,'envelope_id',a.envelope_id,'artifact_kind',a.kind,'artifact_sha256',a.sha256,'created_at',a.created_at)
  from private.yousign_native_artifacts_v1 a where exists(select 1 from own_signers s where s.envelope_id=a.envelope_id
   and (a.kind='SIGNED_PDF' or(a.kind='AUDIT_JSON' and exists(select 1 from private.yousign_signer_references_v1 own where own.envelope_id=s.envelope_id and own.signer_id=s.signer_id and own.provider_signer_id=a.provider_reference))))
  union all
  select 'YOUSIGN_EVIDENCE_BINDING',b.evidence_package_id::text,
   jsonb_build_object('source','YOUSIGN_EVIDENCE_BINDING','id',b.evidence_package_id,'envelope_id',b.envelope_id,'evidence_package_id',b.evidence_package_id,'adapter_evidence_hash',b.adapter_evidence_hash,'artifact_manifest_hash',b.artifact_manifest_hash,'created_at',b.created_at)
  from private.yousign_native_evidence_bindings_v1 b where exists(select 1 from own_signers s where s.envelope_id=b.envelope_id)
 ) select r.source,r.record_id,r.record from native_rows r order by r.source,r.record_id;
end$$;

alter function private.dsr_all_financial_source_v1() rename to dsr_all_financial_source_before_yousign_v1;
create function private.dsr_all_financial_source_v1() returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select original||jsonb_build_object('builtin_kind','PERSONALLY_AUTHORED_OR_SIGNED_FINANCIAL_AND_SIGNATURE_RECORDS',
  'columns',(original->'columns')||(select jsonb_agg(jsonb_build_object('name',f,'type',case f when 'signature_fields' then 'jsonb' else 'text' end,'exportable',true,'security_secret',false,'references_user',false) order by f)
   from unnest(array['first_name','last_name','locale','signature_fields','configured_at','envelope_id','provider_request_id','provider_document_id','provider_signer_id','signer_id','operation','outcome','updated_at','source_sha256','artifact_kind','artifact_sha256','artifact_manifest_hash','adapter_evidence_hash','evidence_package_id'])f
   where not exists(select 1 from jsonb_array_elements(original->'columns')c where c->>'name'=f)))
 from(select private.dsr_all_financial_source_before_yousign_v1()original)old;
$$;

-- Every native physical source remains visible to the technical/legal inventory.
-- Raw manifests, object paths and operation keys are not silently exported.
-- The curated source is proposed metadata only: existing approved inventories
-- become stale through the extractor/catalog hash and require independent review.
revoke all on function private.dsr_subject_financial_rows_before_yousign_v2(uuid),private.dsr_subject_financial_rows_v2(uuid),private.dsr_all_financial_source_before_yousign_v1(),private.dsr_all_financial_source_v1(),private.dsr_all_collect_file_sources_v1(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

