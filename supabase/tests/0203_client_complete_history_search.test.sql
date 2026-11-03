begin;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2030000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','history203@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2030000-0000-4000-8000-000000000001','History 203','History 203','ACTIVE','a2030000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2030000-0000-4000-8000-000000000001','b2030000-0000-4000-8000-000000000001','a2030000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2030000-0000-4000-8000-000000000001','CLIENT_OWNER');
-- Synthetic catalogue/compliance foreign keys isolate history pagination from upstream setup.
set local session_replication_role=replica;
insert into public.service_requests(id,client_organization_id,library_id,service_id,current_version_id,status,created_by,created_at)
select format('d2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2030000-0000-4000-8000-000000000001','d2030000-0000-4000-9000-000000000001','d2030000-0000-4000-9000-000000000002',format('e2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'DRAFT','a2030000-0000-4000-8000-000000000001','2020-01-01'::timestamptz+i*interval'1 second'from generate_series(1,501)i;
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,required_quote_data,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select format('e2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,format('d2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2030000-0000-4000-8000-000000000001','d2030000-0000-4000-9000-000000000001',1,'Besoin historique-'||lpad(i::text,4,'0'),'NORMAL','{}',repeat('a',64),repeat('a',64),'Test historique',repeat('a',64),'a2030000-0000-4000-8000-000000000001'from generate_series(1,501)i;
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,status,uploaded_at,reviewed_by,reviewed_at,created_by,created_at,scan_status,current_scan_result_id,scanned_at)
select format('f2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,format('f2032000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2030000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',i,'f2030000-0000-4000-9000-000000000002','RC-'||i,'Fixture officielle','2020-01-01',case when i=1 then'2021-01-01'::date else null end,'document-historique-'||lpad(i::text,4,'0')||'.pdf','pdf','application/pdf',100,repeat('a',64),repeat('b',32)||'/'||lpad(i::text,12,'0')||'.pdf','VERIFIED',now(),'a2030000-0000-4000-8000-000000000001',now(),'a2030000-0000-4000-8000-000000000001','2020-01-01'::timestamptz+i*interval'1 second','CLEAN',format('a2031000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,now()from generate_series(1,1001)i;
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,scanner_principal,correlation_id)
select format('a2031000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,format('f2030000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2030000-0000-4000-8000-000000000001',1,'CLEAN','TEST_SCANNER','test-v1',repeat('a',64),'application/pdf',100,'SUPABASE_SERVICE_ROLE','f2030000-0000-4000-9000-000000000003'from generate_series(1,1001)i;
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,status,created_by)
values('f2030000-0000-4000-8000-000000001002','f2030000-0000-4000-9000-000000000001','b2030000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1002,'f2030000-0000-4000-9000-000000000002','RC-PENDING','Fixture officielle','2020-01-01','pending-special.pdf','pdf','application/pdf',100,repeat('a',64),repeat('c',32)||'/pending.pdf','UPLOAD_PENDING','a2030000-0000-4000-8000-000000000001');
set local session_replication_role=origin;
select set_config('request.jwt.claims','{"sub":"a2030000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is(public.count_client_request_results('b2030000-0000-4000-8000-000000000001'),501::bigint,'request total is exhaustive beyond 500');
select is(public.count_client_request_results('b2030000-0000-4000-8000-000000000001','historique-0001'),1::bigint,'search counts the oldest request beyond the legacy cap');
select is((public.list_client_request_page('b2030000-0000-4000-8000-000000000001','historique-0001')->0->>'id'),'d2030000-0000-4000-8000-000000000001','server search finds the oldest request');
select is(jsonb_array_length(public.list_client_request_page('b2030000-0000-4000-8000-000000000001','','',26)),1,'last request page remains reachable');
select is((public.list_client_request_page('b2030000-0000-4000-8000-000000000001','d2030000-0000-4000-8000-000000000001')->0->>'id'),'d2030000-0000-4000-8000-000000000001','request ID lookup uses the full history');
select is((public.list_client_document_page('b2030000-0000-4000-8000-000000000001')->>'total'),'1001','document total is exhaustive beyond the old wire cap');
select is((public.list_client_document_page('b2030000-0000-4000-8000-000000000001')->>'expired_count'),'1','expiry checks include an expired oldest document');
select is((public.list_client_document_page('b2030000-0000-4000-8000-000000000001','historique-0002')->'documents'->0->>'id'),'f2030000-0000-4000-8000-000000000002','document search finds an old file beyond 1000');
select is(jsonb_array_length(public.list_client_document_page('b2030000-0000-4000-8000-000000000001','',41)->'documents'),1,'last document page remains reachable');
select is((public.authorize_client_bound_document('f2030000-0000-4000-8000-000000000002')->>'document_id'),'f2030000-0000-4000-8000-000000000002','an old CLEAN document is authorized directly by ID');
select is((public.list_client_document_page('b2030000-0000-4000-8000-000000000001','pending-special')->>'total'),'0','pending documents cannot enter verified-only reuse choices');
select is((public.list_client_document_page('b2030000-0000-4000-8000-000000000001','pending-special',1,true)->'documents'->0->>'scan_status'),'PENDING','vault lists pending scan state without granting download');
select throws_ok($$select public.authorize_client_bound_document('f2030000-0000-4000-8000-000000001002')$$,'42501','CLIENT_DOCUMENT_DENIED','pending scan metadata does not grant access');
select throws_ok($$select public.list_client_document_page('b2030000-0000-4000-8000-000000000002')$$,'42501','CLIENT_VAULT_DENIED','explicit foreign scope cannot fall back');
select * from finish();
rollback;
