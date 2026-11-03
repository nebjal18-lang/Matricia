begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-scan-fixture-0022',configured_at=clock_timestamp()where singleton;

set local search_path=public,extensions;
select plan(48);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b2200000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p05-hard-owner@example.invalid','',now(),'{}','{}',now(),now()),
('b2200000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p05-hard-other@example.invalid','',now(),'{}','{}',now(),now()),
('b2200000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p05-hard-central@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b2210000-0000-0000-0000-000000000001','P05 Hardening SARL','P05 Hardening','PENDING','b2200000-0000-0000-0000-000000000001'),
('b2210000-0000-0000-0000-000000000002','P05 Other SARL','P05 Other','PENDING','b2200000-0000-0000-0000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values
('b2220000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','b2200000-0000-0000-0000-000000000001','ACTIVE',now()),
('b2220000-0000-0000-0000-000000000002','b2210000-0000-0000-0000-000000000002','b2200000-0000-0000-0000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code) values
('b2220000-0000-0000-0000-000000000001','CLIENT_OWNER'),
('b2220000-0000-0000-0000-000000000002','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code) values
('b2200000-0000-0000-0000-000000000003','COMPLIANCE_MANAGER');
insert into public.client_compliance_cases(id,organization_id,current_profile_version,status,created_by)
values('b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001',null,'PROFILE_IN_PROGRESS','b2200000-0000-0000-0000-000000000001');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)
values('b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001',1,
  '{"legal_form":"SARL","registered_address":{"line1":"1 rue Test"},"representative":{"first_name":"Amal"}}',
  '{}',1,'b2200000-0000-0000-0000-000000000001');
update public.client_compliance_cases set current_profile_version=1 where id='b2230000-0000-0000-0000-000000000001';

insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,created_by
) values
('b2240000-0000-0000-0000-000000000001','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','REGISTRATION_DOCUMENT',1,
 (select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),
 'RC-HARD-1','Tribunal',current_date-30,current_date+365,'hardening.pdf','pdf','application/pdf',128,repeat('a',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000001.pdf',
 'application/pdf',128,'PENDING_REVIEW',clock_timestamp(),'b2200000-0000-0000-0000-000000000001'),
('b2240000-0000-0000-0000-000000000002','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','TAX_DOCUMENT',1,
 (select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT' and status='ACTIVE'),
 'IF-EXPIRED','Tax',current_date-365,current_date-1,'expired.pdf','pdf','application/pdf',128,repeat('b',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000002.pdf',
 'application/pdf',128,'PENDING_REVIEW',clock_timestamp(),'b2200000-0000-0000-0000-000000000001'),
('b2240000-0000-0000-0000-000000000003','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','REPRESENTATIVE_AUTHORITY',1,
 (select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),
 'AUTH-UPLOAD','Notary',current_date-10,null,'authority.pdf','pdf','application/pdf',64,repeat('c',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000003.pdf',
 null,null,'UPLOAD_PENDING',null,'b2200000-0000-0000-0000-000000000001'),
('b2240000-0000-0000-0000-000000000004','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','TAX_DOCUMENT',2,
 (select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT' and status='ACTIVE'),
 'IF-CROSS','Tax',current_date-10,null,'cross.pdf','pdf','application/pdf',64,repeat('d',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000004.pdf',
 null,null,'UPLOAD_PENDING',null,'b2200000-0000-0000-0000-000000000001'),
('b2240000-0000-0000-0000-000000000005','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','TAX_DOCUMENT',3,
 (select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT' and status='ACTIVE'),
 'IF-QUAR','Tax',current_date-10,null,'quarantine.pdf','pdf','application/pdf',64,repeat('e',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000005.pdf',
 'application/pdf',64,'PENDING_REVIEW',clock_timestamp(),'b2200000-0000-0000-0000-000000000001'),
('b2240000-0000-0000-0000-000000000006','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','TAX_DOCUMENT',4,
 (select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT' and status='ACTIVE'),
 'IF-SEQUENCE','Tax',current_date-10,current_date+365,'sequence.pdf','pdf','application/pdf',64,repeat('f',64),
 'b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000006.pdf',
 'application/pdf',64,'PENDING_REVIEW',clock_timestamp(),'b2200000-0000-0000-0000-000000000001');
insert into storage.objects(bucket_id,name,metadata) values
('client-compliance','b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000005.pdf','{"mimetype":"application/pdf","size":64}');

create temporary table p05_hard_observed(key text primary key,value text not null);
grant select,insert on p05_hard_observed to authenticated;
grant select,insert on p05_hard_observed to service_role;

select ok(has_function_privilege('service_role','public.get_client_document_scan_job(uuid)','EXECUTE'),
  'trusted scanner service can execute the minimal scan-job RPC');
select ok(not has_function_privilege('authenticated','public.get_client_document_scan_job(uuid)','EXECUTE'),
  'authenticated humans cannot execute the scan-job RPC');
select ok(not has_function_privilege('anon','public.get_client_document_scan_job(uuid)','EXECUTE'),
  'anonymous actors cannot execute the scan-job RPC');
select ok(not has_table_privilege('service_role','public.client_compliance_documents','SELECT'),
  'scanner service receives no direct document-table SELECT privilege');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.role','authenticated',true);select * from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000001')$$,
  '42501',null,'authenticated scan-job lookup is denied');
reset role;
select throws_ok(
  $$set local role anon;select set_config('request.jwt.claim.role','anon',true);select * from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000001')$$,
  '42501',null,'anonymous scan-job lookup is denied');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into p05_hard_observed
select 'scan_job',to_jsonb(job)::text
from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000001') job;
insert into p05_hard_observed values('missing_scan_job',jsonb_build_object('count',(
  select count(*) from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000099')
))::text);
insert into p05_hard_observed values('upload_pending_scan_job',jsonb_build_object('count',(
  select count(*) from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000003')
))::text);
reset role;
select is((select value::jsonb->>'document_id' from p05_hard_observed where key='scan_job'),
  'b2240000-0000-0000-0000-000000000001','scanner service reads the requested finalized document job');
select is((select array_agg(key order by key) from jsonb_object_keys(
    (select value::jsonb from p05_hard_observed where key='scan_job')) key),
  array['compliance_case_id','declared_sha256','detected_mime_type','detected_size_bytes',
    'document_id','organization_id','status','storage_bucket','storage_object_path'],
  'scan-job RPC exposes only the nine fields required by the worker');
select is((select (value::jsonb->>'count')::bigint from p05_hard_observed where key='missing_scan_job'),
  0::bigint,'unknown document lookup returns a neutral empty result');
select is((select value::jsonb-'document_id' from p05_hard_observed where key='scan_job'),
  jsonb_build_object(
    'organization_id','b2210000-0000-0000-0000-000000000001',
    'compliance_case_id','b2230000-0000-0000-0000-000000000001',
    'status','PENDING_REVIEW','storage_bucket','client-compliance',
    'storage_object_path','b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000001.pdf',
    'declared_sha256',repeat('a',64),'detected_mime_type','application/pdf',
    'detected_size_bytes',128),
  'scan-job RPC returns the exact eight remaining worker fields');
select is((select (value::jsonb->>'count')::bigint from p05_hard_observed where key='upload_pending_scan_job'),
  0::bigint,'known UPLOAD_PENDING document is not exposed as a scan job');

select is((select count(*) from public.client_document_requirement_versions where status='ACTIVE' and required),2::bigint,
  'the active CLIENT requirement matrix is deterministic and versioned');
select throws_ok($$update public.client_document_policy_versions set max_size_bytes=1 where status='ACTIVE'$$,
  '55000','IMMUTABLE_RECORD','document policy versions cannot be rewritten');
select throws_ok($$update public.client_document_requirement_versions set required=false where status='ACTIVE'$$,
  '55000','IMMUTABLE_RECORD','document requirement versions cannot be rewritten');
select throws_ok($$insert into public.client_document_requirement_versions(organization_kind,library_code,document_type,version,required,status,effective_from) values('CLIENT',null,'REGISTRATION_DOCUMENT',1,true,'DRAFT',clock_timestamp())$$,
  '23505',null,'NULLS NOT DISTINCT prevents duplicate global requirement versions');
select throws_ok($$update public.client_compliance_documents set reviewed_by='b2200000-0000-0000-0000-000000000003' where id='b2240000-0000-0000-0000-000000000003'$$,
  '23514',null,'review metadata must remain a complete pair');

select ok(not has_function_privilege('authenticated','public.record_client_document_scan_result(uuid,text,text,text,text,text,bigint,jsonb,text,uuid)','EXECUTE'),
  'human compliance sessions cannot execute the trusted scanner RPC');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000003',true);select set_config('request.jwt.claims','{"sub":"b2200000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);select public.review_client_compliance_document('b2240000-0000-0000-0000-000000000001','VERIFIED',repeat('a',64),null,'Manual review','hard-review-no-scan')$$,
  '55000','CLEAN_DOCUMENT_SCAN_REQUIRED','VERIFIED is impossible before immutable CLEAN scan evidence');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p05_hard_observed values('scan',public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000001','CLEAN','DEMO_SCANNER','1.0',repeat('a',64),
  'application/pdf',128,'{}','hard-clean-scan-1')::text);
insert into p05_hard_observed values('scan_retry',public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000001','CLEAN','DEMO_SCANNER','1.0',repeat('a',64),
  'application/pdf',128,'{}','hard-clean-scan-1')::text);
select public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000002','CLEAN','DEMO_SCANNER','1.0',repeat('b',64),
  'application/pdf',128,'{}','hard-expired-scan-1');
select public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000006','CLEAN','DEMO_SCANNER','1.0',repeat('f',64),
  'application/pdf',64,'{}','hard-sequence-clean');
select public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000006','ERROR','DEMO_SCANNER','1.0',repeat('f',64),
  'application/pdf',64,'{}','hard-sequence-error');
select public.record_client_document_scan_result(
  'b2240000-0000-0000-0000-000000000005','INFECTED','DEMO_SCANNER','1.0',repeat('e',64),
  'application/pdf',64,'{}','hard-infected-scan-1');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"b2200000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p05_hard_observed values('review',public.review_client_compliance_document(
  'b2240000-0000-0000-0000-000000000001','VERIFIED',repeat('a',64),null,'Manual review','hard-review-clean-1')::text);
reset role;
select is((select value::jsonb->>'result' from p05_hard_observed where key='scan'),'CLEAN','structured scan records CLEAN');
select is((select value from p05_hard_observed where key='scan_retry'),(select value from p05_hard_observed where key='scan'),'scan retry is idempotent');
select is((select count(*) from private.client_document_scan_results where document_id='b2240000-0000-0000-0000-000000000001'),1::bigint,'scan retry creates one immutable result');
select is((select scan_status from public.client_compliance_documents where id='b2240000-0000-0000-0000-000000000006'),'ERROR','latest scan result becomes the current document state');
select is((select array_agg(sequence order by sequence) from private.client_document_scan_results where document_id='b2240000-0000-0000-0000-000000000006'),array[1,2],'scan results are strictly ordered per document');
select is((select status from public.client_compliance_documents where id='b2240000-0000-0000-0000-000000000005'),'QUARANTINED','trusted INFECTED scan quarantines the document');
select ok((select reviewed_by is null and reviewed_at is null from public.client_compliance_documents where id='b2240000-0000-0000-0000-000000000005'),'machine quarantine does not forge a human reviewer');
select is((select count(*) from public.audit_events where action='client.document.scan.recorded' and resource_id='b2240000-0000-0000-0000-000000000005'),1::bigint,'machine quarantine is audited once');
select is((select count(*) from public.event_outbox where event_type='ClientDocumentQuarantinedV1' and aggregate_id='b2240000-0000-0000-0000-000000000005'),1::bigint,'machine quarantine emits one durable event');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000003',true);select set_config('request.jwt.claims','{"sub":"b2200000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);select public.review_client_compliance_document('b2240000-0000-0000-0000-000000000006','VERIFIED',repeat('f',64),null,'Manual review','hard-review-stale-clean')$$,
  '55000','CLEAN_DOCUMENT_SCAN_REQUIRED','a stale CLEAN result cannot override a current ERROR scan');
reset role;
select throws_ok($$update private.client_document_scan_results set result='ERROR' where document_id='b2240000-0000-0000-0000-000000000001'$$,
  '55000','IMMUTABLE_RECORD','scan evidence is append-only');
select is((select status from public.client_compliance_documents where id='b2240000-0000-0000-0000-000000000001'),'VERIFIED','clean current document can be verified');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into p05_hard_observed
select 'verified_retry_job',to_jsonb(job)::text
from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000001') job;
insert into p05_hard_observed
select 'quarantined_retry_job',to_jsonb(job)::text
from public.get_client_document_scan_job('b2240000-0000-0000-0000-000000000005') job;
reset role;
select is((select value::jsonb->>'status' from p05_hard_observed where key='verified_retry_job'),
  'VERIFIED','idempotent worker retry can reload a VERIFIED document job');
select is((select value::jsonb->>'status' from p05_hard_observed where key='quarantined_retry_job'),
  'QUARANTINED','idempotent worker retry can reload a QUARANTINED document job');
select is((select source_document_id from public.client_compliance_evidence where source_document_id='b2240000-0000-0000-0000-000000000001'),'b2240000-0000-0000-0000-000000000001'::uuid,'compliance evidence retains its source document');
select is((select count(*) from public.audit_events where action in ('client.document.scan.recorded','client.document.reviewed') and resource_id='b2240000-0000-0000-0000-000000000001'),2::bigint,'scan and review are each audited once');
select is((select count(*) from public.event_outbox where event_type in ('ClientDocumentScanCleanV1','ClientDocumentVerifiedV1') and aggregate_id='b2240000-0000-0000-0000-000000000001'),2::bigint,'scan and review each emit one durable event');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000003',true);select set_config('request.jwt.claims','{"sub":"b2200000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);select public.review_client_compliance_document('b2240000-0000-0000-0000-000000000002','VERIFIED',repeat('b',64),null,'Manual review','hard-expired-review')$$,
  '55000','DOCUMENT_EXPIRED','an expired document cannot become VERIFIED');
reset role;

insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active) values
('b2210000-0000-0000-0000-000000000001','ICE','HARDICE001','VERIFIED',true),
('b2210000-0000-0000-0000-000000000001','IF','HARDIF001','VERIFIED',true),
('b2210000-0000-0000-0000-000000000001','RC','HARDRC001','VERIFIED',true);
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by
) values('b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001',
  'REPRESENTATIVE_AUTHORITY','legacy/authority.pdf',repeat('9',64),'VERIFIED',
  'b2200000-0000-0000-0000-000000000003',clock_timestamp(),'b2200000-0000-0000-0000-000000000001');
update public.client_compliance_cases set status='UNDER_REVIEW'
where id='b2230000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.client_compliance_cases set status='VERIFIED',verified_at=clock_timestamp(),activated_at=clock_timestamp() where id='b2230000-0000-0000-0000-000000000001'$$,
  '55000','VERIFIED_COMPLIANCE_EVIDENCE_REQUIRED','legacy unscanned evidence cannot satisfy the final compliance gate');

set local role authenticated;
select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000001',true);
insert into storage.objects(bucket_id,name,metadata) values('client-compliance','b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000003.pdf','{"mimetype":"application/pdf","size":64}');
insert into p05_hard_observed values('owner_storage',(select count(*)::text from storage.objects where name like 'b2210000-0000-0000-0000-000000000001/%'));
reset role;
select ok((select value::bigint from p05_hard_observed where key='owner_storage')>=1,'owner can insert and read a reserved private object');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000002',true);insert into storage.objects(bucket_id,name,metadata) values('client-compliance','b2210000-0000-0000-0000-000000000001/b2230000-0000-0000-0000-000000000001/b2240000-0000-0000-0000-000000000004.pdf','{"mimetype":"application/pdf","size":64}')$$,
  '42501',null,'another tenant cannot fill a reserved Storage path');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000002',true);
insert into p05_hard_observed values('other_storage',(select count(*)::text from storage.objects where name like 'b2210000-0000-0000-0000-000000000001/%'));
reset role;
select is((select value::bigint from p05_hard_observed where key='other_storage'),0::bigint,'Storage SELECT denies cross-tenant access');
set local role authenticated;
select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000001',true);
insert into p05_hard_observed values('quarantined_storage',(select count(*)::text from storage.objects where name like '%b2240000-0000-0000-0000-000000000005.pdf'));
reset role;
select is((select value::bigint from p05_hard_observed where key='quarantined_storage'),0::bigint,'owner cannot read a quarantined object');
set local role authenticated;
select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000001',true);
update storage.objects set metadata='{"mimetype":"application/pdf","size":999}'
where name like '%b2240000-0000-0000-0000-000000000003.pdf';
reset role;
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000001',true);delete from storage.objects where name like '%b2240000-0000-0000-0000-000000000003.pdf'$$,
  '42501','Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'direct Storage deletion is denied and must use the guarded Storage API');
reset role;
select is((select metadata->>'size' from storage.objects where name like '%b2240000-0000-0000-0000-000000000003.pdf'),'64','RLS prevents owner overwrite');
select is((select count(*) from storage.objects where name like '%b2240000-0000-0000-0000-000000000003.pdf'),1::bigint,'RLS prevents owner deletion');
select ok(not has_function_privilege('anon','public.record_client_document_scan_result(uuid,text,text,text,text,text,bigint,jsonb,text,uuid)','EXECUTE'),'anonymous scan execution is denied');

insert into public.client_administrative_anomalies(id,compliance_case_id,organization_id,anomaly_code,field_path,severity,blocking,client_message_fr,client_message_ar,detected_by)
values('b2250000-0000-0000-0000-000000000001','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','MANUAL_REVIEW_REQUIRED','profile','CRITICAL',true,'Question requise','السؤال مطلوب','COMPLIANCE_REVIEWER');
insert into public.client_compliance_questions(id,compliance_case_id,organization_id,anomaly_id,question_text_fr,question_text_ar,due_at,created_by)
values('b2260000-0000-0000-0000-000000000001','b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','b2250000-0000-0000-0000-000000000001','Veuillez clarifier.','يرجى التوضيح.',clock_timestamp()+interval '1 day','b2200000-0000-0000-0000-000000000003');
select throws_ok(
  $$set local role authenticated;select set_config('request.jwt.claim.sub','b2200000-0000-0000-0000-000000000002',true);select public.respond_client_compliance_question('b2260000-0000-0000-0000-000000000001','Réponse interdite','hard-cross-response')$$,
  'P0002','QUESTION_NOT_FOUND','cross-tenant SECURITY DEFINER response is non-enumerating');
reset role;
select ok(not has_table_privilege('authenticated','public.client_compliance_questions','INSERT'),'questions remain RPC-only');
select throws_ok(
  $$insert into public.client_compliance_questions(compliance_case_id,organization_id,anomaly_id,question_text_fr,question_text_ar,expected_document_type,due_at,created_by) values('b2230000-0000-0000-0000-000000000001','b2210000-0000-0000-0000-000000000001','b2250000-0000-0000-0000-000000000001','Type invalide','نوع غير صالح','EXECUTABLE',clock_timestamp()+interval '1 day','b2200000-0000-0000-0000-000000000003')$$,
  '23514',null,'question document types are constrained to the versioned domain');

select * from finish();
rollback;
