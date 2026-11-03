begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
-- Synthetic bound actors and historical verified-document metadata. This SQL
-- contract does not certify physical Storage bytes or a remote antivirus scan.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select('a3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','review329-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)i;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)select('f3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'aal2',now(),now()from generate_series(1,5)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3290000-0000-4000-8000-000000000001','TEST Measurement329 A','TEST Measurement329 A','ACTIVE','a3290000-0000-4000-8000-000000000001'),
('b3290000-0000-4000-8000-000000000002','TEST Measurement329 B','TEST Measurement329 B','ACTIVE','a3290000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)select('c3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()from generate_series(1,2)i;
insert into public.organization_member_roles(membership_id,role_code)select('c3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'CLIENT_OWNER'from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values
('a3290000-0000-4000-8000-000000000003','FINANCE_MANAGER'),
('a3290000-0000-4000-8000-000000000004','COMPLIANCE_MANAGER'),
('a3290000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values
('d3290000-0000-4000-8000-000000000001','b3290000-0000-4000-8000-000000000001','VERIFIED',1,'a3290000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values
('d3290000-0000-4000-8000-000000000001','b3290000-0000-4000-8000-000000000001',1,'{}','{}',1,'a3290000-0000-4000-8000-000000000001');
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by)values
('d3291000-0000-4000-8000-000000000001','d3290000-0000-4000-8000-000000000001','b3290000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT'and status='ACTIVE'),'TEST-RC329','TEST tribunal',current_date-30,current_date+365,'proof329.pdf','pdf','application/pdf',128,repeat('a',64),'b3290000-0000-4000-8000-000000000001/test329/proof.pdf','application/pdf',128,'VERIFIED',now(),'a3290000-0000-4000-8000-000000000003',now(),'a3290000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id)values
('d3292000-0000-4000-8000-000000000001','d3291000-0000-4000-8000-000000000001','b3290000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','d3293000-0000-4000-8000-000000000001');
update public.client_compliance_documents set current_scan_result_id='d3292000-0000-4000-8000-000000000001',scan_status='CLEAN',scanned_at=now()where id='d3291000-0000-4000-8000-000000000001';
create temporary table review329(k text primary key,v jsonb);grant all on review329 to authenticated;
create function pg_temp.actor329(i integer,p_aal text default'aal2')returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','a3290000-0000-4000-8000-'||lpad(i::text,12,'0'),true);perform set_config('request.jwt.claims',jsonb_build_object('sub','a3290000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal',p_aal,'session_id','f3290000-0000-4000-8000-'||lpad(i::text,12,'0'))::text,true);end$$;
select ok(not has_function_privilege('authenticated','private.client_measurement_read_v1(uuid)','execute'),'review predicate is not a browser RPC');
select ok(not has_function_privilege('authenticated','private.client_measurement_evidence_v1(uuid,uuid)','execute'),'browser cannot request a raw evidence fingerprint');
select ok(not has_function_privilege('anon','public.list_client_measurement_context_v1(uuid)','execute'),'anonymous cannot inspect measurement choices');
set local role authenticated;
select pg_temp.actor329(1);
select is(public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001')->>'organization_id','b3290000-0000-4000-8000-000000000001','Client keeps their own measurement context');
select pg_temp.actor329(2);
select throws_ok($$select public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001')$$,'42501','CLIENT_MEASUREMENT_CONTEXT_DENIED','ordinary foreign Client is refused');
select throws_ok($$select public.capture_client_baseline_with_document_v1('b3290000-0000-4000-8000-000000000001','ORGANIZATION','b3290000-0000-4000-8000-000000000001','ANNUAL_COST',100,'JPY',current_date-30,current_date,'INVOICE','TEST-329-INVOICE','d3291000-0000-4000-8000-000000000001','TEST_329','test329-foreign-baseline')$$,'42501','CLIENT_MEASUREMENT_EVIDENCE_DENIED','ordinary Client cannot bind another organization document');
select pg_temp.actor329(3);
insert into review329 values('finance-context',public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001'));
select is((select v->'documents'->0->>'id'from review329 where k='finance-context'),'d3291000-0000-4000-8000-000000000001','AAL2 Finance reviewer can select the verified document');
select throws_ok($$select public.create_client_site('b3290000-0000-4000-8000-000000000001','TEST329_FINANCE','Test finance','اختبار المالية','{}','Test review access only','test329-finance-site')$$,'42501','CLIENT_SITE_CREATE_DENIED','Finance read authority does not grant portfolio management');
select pg_temp.actor329(3,'aal1');
select throws_ok($$select public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001')$$,'42501','CLIENT_MEASUREMENT_CONTEXT_DENIED','Finance reviewer must step up before reading private choices');
select pg_temp.actor329(4);
insert into review329 values('compliance-context',public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001'));
select is((select v->'documents'->0->>'label'from review329 where k='compliance-context'),'proof329.pdf','AAL2 Compliance reviewer can inspect document choices');
select throws_ok($$select public.create_client_site('b3290000-0000-4000-8000-000000000001','TEST329_COMPLIANCE','Test conformité','اختبار الامتثال','{}','Test review access only','test329-compliance-site')$$,'42501','CLIENT_SITE_CREATE_DENIED','Compliance review does not grant portfolio writes');
select pg_temp.actor329(4,'aal1');
select throws_ok($$select public.list_client_measurement_context_v1('b3290000-0000-4000-8000-000000000001')$$,'42501','CLIENT_MEASUREMENT_CONTEXT_DENIED','Compliance reviewer also needs AAL2');
select pg_temp.actor329(5);
select throws_ok($$select public.capture_client_baseline_with_document_v1('b3290000-0000-4000-8000-000000000001','ORGANIZATION','b3290000-0000-4000-8000-000000000001','ANNUAL_COST',100,'JPY',current_date-30,current_date,'INVOICE','TEST-329-INVOICE','d3291000-0000-4000-8000-000000000001','TEST_329','test329-auditor-baseline')$$,'42501','BASELINE_SUBMISSION_DENIED','read-only audit access cannot submit a baseline');
-- Exercise the real document-binding wrapper, not only its permission predicate.
select pg_temp.actor329(2);
insert into review329 values('link',public.create_referral_link('b3290000-0000-4000-8000-000000000002','TEST0329_LINK','CLIENT','TEST_329_REVIEW',now()+interval'30 days',10,'test329-create-link'));
select pg_temp.actor329(1);
insert into review329 values('claim',public.claim_client_referral_v1('TEST0329_LINK','b3290000-0000-4000-8000-000000000001',true,'test329-claim'));
insert into review329 values('profile',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review329 where k='claim'),'PROFILE_STARTED','d3291000-0000-4000-8000-000000000001',1,'test329-profile'));
select pg_temp.actor329(3);
insert into review329 values('verification',public.advance_client_referral_with_document_v1((select(v->>'referral_conversion_id')::uuid from review329 where k='claim'),'VERIFIED','d3291000-0000-4000-8000-000000000001',2,'test329-finance-verification'));
reset role;
select is((select conversion_stage from public.referral_conversions where id=(select(v->>'referral_conversion_id')::uuid from review329 where k='claim')),'VERIFIED','Finance reviewer completes the genuine canonical verification transition');
select is((select evidence_hash from public.referral_conversion_events where referral_conversion_id=(select(v->>'referral_conversion_id')::uuid from review329 where k='claim')and to_stage='VERIFIED'),repeat('a',64),'review transition uses the exact server-side document fingerprint');
select is((select count(*)::integer from public.client_sites where organization_id='b3290000-0000-4000-8000-000000000001'),0,'reviewer and auditor refusals left no portfolio write');
select *from finish();
rollback;
