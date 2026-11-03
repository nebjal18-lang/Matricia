begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3410000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-owner@example.invalid','',now(),'{}','{}',now(),now()),
('a3410000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-outsider@example.invalid','',now(),'{}','{}',now(),now()),
('a3410000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-session-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3410000-0000-4000-8000-000000000001','P06 Session Tenant A','P06 Session A','ACTIVE','a3410000-0000-4000-8000-000000000001'),
('b3410000-0000-4000-8000-000000000002','P06 Session Tenant B','P06 Session B','ACTIVE','a3410000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','a3410000-0000-4000-8000-000000000001','ACTIVE',now()),
('c3410000-0000-4000-8000-000000000002','b3410000-0000-4000-8000-000000000002','a3410000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c3410000-0000-4000-8000-000000000001','CLIENT_OWNER'),
('c3410000-0000-4000-8000-000000000002','CLIENT_OWNER');
-- Published test-only quota and activated trial, required by the real start command.
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b3410000-0000-4000-8000-000000000001','ICE','997245000000001','VERIFIED'),('b3410000-0000-4000-8000-000000000001','IF','99724501','VERIFIED'),('b3410000-0000-4000-8000-000000000001','RC','TEST245','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','VERIFIED',1,'a3410000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99724501","rc_number":"TEST245","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Payment 245 SARL","display_name":"Payment 245 SARL","country_code":"MA","identifiers":{"ICE":"997245000000001","IF":"99724501","RC":"TEST245"}}',1,'a3410000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001',1,now()-interval'1 day','a3410000-0000-4000-8000-000000000003','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f3411000-0000-0000-0000-000000000001','f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b3410000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3410000-0000-4000-8000-000000000003',clock_timestamp(),'a3410000-0000-4000-8000-000000000001'),
('f3411000-0000-0000-0000-000000000002','f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b3410000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3410000-0000-4000-8000-000000000003',clock_timestamp(),'a3410000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f3412000-0000-0000-0000-000000000001','f3411000-0000-0000-0000-000000000001','b3410000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3413000-0000-0000-0000-000000000001'),
('f3412000-0000-0000-0000-000000000002','f3411000-0000-0000-0000-000000000002','b3410000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3413000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f3411000-0000-0000-0000-000000000001' then 'f3412000-0000-0000-0000-000000000001'::uuid
  else 'f3412000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f3411000-0000-0000-0000-000000000001','f3411000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a3410000-0000-4000-8000-000000000003',clock_timestamp(),'a3410000-0000-4000-8000-000000000001','f3411000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f3410000-0000-4000-8000-000000000001','b3410000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a3410000-0000-4000-8000-000000000003',clock_timestamp(),'a3410000-0000-4000-8000-000000000001','f3411000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('f3410000-0000-4000-8000-000000000002','b3410000-0000-4000-8000-000000000001','f3410000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'1 day',now()+interval'29 days','a3410000-0000-4000-8000-000000000003');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0341_DIAGNOSTICS',1,'ACTIVE',true,10,'{"resource":"DIAGNOSTICS"}',now()-interval'1 day',repeat('9',64),'a3410000-0000-4000-8000-000000000003');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0341_SITES',1,'ACTIVE',true,1,'{"resource":"SITES"}',now()-interval'1 day',repeat('8',64),'a3410000-0000-4000-8000-000000000003');

-- ROLLBACK_ONLY_ASSERTIONS: the concurrency harness reuses only the synthetic
-- setup above in its explicitly owned no-network database, never an app URL.
create temporary table audit341(k text primary key,v jsonb);
select set_config('request.jwt.claim.sub','a3410000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a3410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.create_client_site('b3410000-0000-4000-8000-000000000001','AUDIT341_SITE','Site de test concurrent','موقع اختبار متزامن','{"country":"MA","city":"TEST"}','TEST only actual site command','audit341-first-site')->>'outcome','CLIENT_SITE_CREATED','actual authorized site command remains functional');
select throws_ok($$select public.create_client_site('b3410000-0000-4000-8000-000000000001','AUDIT341_OTHER','Autre site de test','موقع اختبار آخر','{"country":"MA","city":"TEST"}','TEST only exact published quota','audit341-over-quota')$$,'54000','SUBSCRIPTION_QUOTA_EXCEEDED','quota remains enforced by canonical admission after the lock fix');
select throws_ok($$select public.create_client_site('b3410000-0000-4000-8000-000000000002','AUDIT341_FOREIGN','Site étranger test','موقع مؤسسة أخرى','{"country":"MA","city":"TEST"}','TEST only foreign organization denial','audit341-foreign')$$,'42501','CLIENT_SITE_CREATE_DENIED','foreign organization authorization is preserved');
reset role;
insert into audit341 values('original', (select jsonb_build_object('id',id::text,'hash',event_hash)from public.audit_events where organization_id='b3410000-0000-4000-8000-000000000001'order by id desc limit 1));
-- Model an identity allocated by a delayed writer before a later writer seals.
insert into audit341 values('low',jsonb_build_object('id',nextval(pg_get_serial_sequence('public.audit_events','id')::regclass)::text));
insert into audit341 values('high',jsonb_build_object('id',nextval(pg_get_serial_sequence('public.audit_events','id')::regclass)::text));
insert into public.audit_events(id,organization_id,actor_user_id,actor_type,action,resource_type,correlation_id,metadata,event_hash)overriding system value values((select(v->>'id')::bigint from audit341 where k='high'),'b3410000-0000-4000-8000-000000000001','a3410000-0000-4000-8000-000000000001','USER','audit341.high_first','test_audit','d3410000-0000-4000-8000-000000000001','{"position":1}',repeat('f',64));
insert into public.audit_events(id,organization_id,actor_user_id,actor_type,action,resource_type,correlation_id,metadata,event_hash)overriding system value values((select(v->>'id')::bigint from audit341 where k='low'),'b3410000-0000-4000-8000-000000000001','a3410000-0000-4000-8000-000000000001','USER','audit341.delayed_low','test_audit','d3410000-0000-4000-8000-000000000002','{"position":2}',repeat('f',64));
insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,correlation_id,metadata,event_hash)values('b3410000-0000-4000-8000-000000000001','a3410000-0000-4000-8000-000000000001','USER','audit341.final','test_audit','d3410000-0000-4000-8000-000000000003','{"position":3}',repeat('f',64));
select is((select previous_hash from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000003'),(select event_hash from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000002'),'next event links the delayed writer instead of skipping its lower preallocated identity');
select ok((select id from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000002')>(select id from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000001'),'final identities follow actual serialized sealing order');
select ok(not exists(select 1 from(select previous_hash,lag(event_hash)over(order by id)prior_hash from public.audit_events where organization_id='b3410000-0000-4000-8000-000000000001')chain where previous_hash is distinct from prior_hash),'all organization events form one linear chain');
select ok((select bool_and(event_hash=encode(extensions.digest(convert_to(jsonb_build_object('previous_hash',coalesce(previous_hash,''),'organization_id',organization_id,'actor_user_id',actor_user_id,'actor_type',actor_type,'action',action,'resource_type',resource_type,'resource_id',resource_id,'correlation_id',correlation_id,'occurred_at',occurred_at,'request_ip',request_ip,'user_agent',user_agent,'metadata',metadata)::text,'UTF8'),'sha256'),'hex'))from public.audit_events where organization_id='b3410000-0000-4000-8000-000000000001'),'the canonical hash still covers every original sealed field');
select is((select event_hash from public.audit_events where id=(select(v->>'id')::bigint from audit341 where k='original')),(select v->>'hash'from audit341 where k='original'),'existing audit identity and content are preserved');
create table private.audit341_reference(audit_id bigint references public.audit_events(id));
insert into private.audit341_reference select(v->>'id')::bigint from audit341 where k='original';
select is((select count(*)from private.audit341_reference),1::bigint,'references to earlier audit identities remain valid');
select throws_ok($$update public.audit_events set metadata='{"tamper":true}'where organization_id='b3410000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_RECORD','audit UPDATE protection remains active');
select throws_ok($$delete from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000003'$$,'55000','IMMUTABLE_RECORD','audit DELETE protection remains active');
insert into public.audit_events(actor_type,action,resource_type,correlation_id,metadata,event_hash)values('SYSTEM','audit341.platform_first','test_audit','d3410000-0000-4000-8000-000000000004','{}',repeat('f',64)),('SYSTEM','audit341.platform_second','test_audit','d3410000-0000-4000-8000-000000000005','{}',repeat('f',64));
select is((select previous_hash from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000005'),(select event_hash from public.audit_events where correlation_id='d3410000-0000-4000-8000-000000000004'),'platform advisory serialization and canonical linkage remain intact');
select is((select count(*)from public.client_sites where organization_id='b3410000-0000-4000-8000-000000000001'),1::bigint,'failed quota request creates no second site');
select is((select count(*)from public.event_outbox where organization_id='b3410000-0000-4000-8000-000000000001'and event_type='ClientSiteCreatedV1'),1::bigint,'only the accepted operation emits its outbox event');
select*from finish();rollback;
