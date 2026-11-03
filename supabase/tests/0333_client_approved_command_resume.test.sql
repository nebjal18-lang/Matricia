begin;
set local search_path=public,extensions;
select no_plan();

select ok((select count(*)=5 and bool_and(p.prosecdef and p.proconfig::text like'%search_path=%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname=any(array['client_invoice_belongs_to','client_typed_reference_valid','enforce_client_task_assignee_tenant','enforce_client_cost_allocation_reference','enforce_client_calendar_source'])),'reference and assignee guards are hardened');
select ok((select count(*)=4 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname in('client_projects','client_project_tasks','client_cost_allocations','client_calendar_events')and t.tgname in('client_project_state_machine','client_task_assignee_tenant_guard','client_cost_allocation_reference_guard','client_calendar_source_guard')and not t.tgisinternal),'four integrity triggers are installed');
select ok((select pg_get_functiondef(p.oid)like'%CLIENT_TASK_ASSIGNEE_OUTSIDE_TENANT%'and pg_get_functiondef(p.oid)like'%is_active_org_member%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='enforce_client_task_assignee_tenant'),'assignee guard requires active same-tenant membership');
select ok((select pg_get_functiondef(p.oid)like'%DRAFT%PLANNED%CANCELLED%'and pg_get_functiondef(p.oid)like'%ACTIVE%ON_HOLD%COMPLETED%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='enforce_client_project_state_transition'),'project state machine is explicit');
select ok((select pg_get_functiondef(p.oid)like'%PROJECT_TASK%'and pg_get_functiondef(p.oid)like'%MISSION_MILESTONE%'and pg_get_functiondef(p.oid)like'%DOCUMENT%'and pg_get_functiondef(p.oid)like'%RFQ%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='client_typed_reference_valid'),'typed reference resolver covers supported client objects');
select ok((select pg_get_functiondef(p.oid)like'%not exists%'and pg_get_functiondef(p.oid)like'%client_organization_id<>p_organization_id%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='client_invoice_belongs_to'),'mixed-client provider invoices fail closed');
select ok((select pg_get_functiondef(p.oid)like'%source_type not in%'and pg_get_functiondef(p.oid)like'%client_typed_reference_valid%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='enforce_client_calendar_source'),'calendar source whitelist fails closed');
select ok(not has_function_privilege('authenticated','private.client_typed_reference_valid(uuid,text,uuid,uuid)','EXECUTE'),'reference resolver is not client-callable');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('f7000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p70-owner-a@example.invalid','',now(),'{}','{}',now(),now()),
('f7000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p70-owner-b@example.invalid','',now(),'{}','{}',now(),now()),
('f7000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p70-inactive@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('f7010000-0000-0000-0000-000000000001','P70 Client A SARL','P70 Client A','ACTIVE','f7000000-0000-0000-0000-000000000001'),
('f7010000-0000-0000-0000-000000000002','P70 Client B SARL','P70 Client B','ACTIVE','f7000000-0000-0000-0000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('f7020000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001','f7000000-0000-0000-0000-000000000001','ACTIVE',now()),
('f7020000-0000-0000-0000-000000000002','f7010000-0000-0000-0000-000000000002','f7000000-0000-0000-0000-000000000002','ACTIVE',now()),
('f7020000-0000-0000-0000-000000000003','f7010000-0000-0000-0000-000000000001','f7000000-0000-0000-0000-000000000003','SUSPENDED',null);
insert into public.organization_member_roles(membership_id,role_code)values
('f7020000-0000-0000-0000-000000000001','CLIENT_OWNER'),
('f7020000-0000-0000-0000-000000000002','CLIENT_OWNER'),
('f7020000-0000-0000-0000-000000000003','CLIENT_MEMBER');
-- Rollback-only verified identities, scanned-document metadata and trial quotas.
-- Historical SQL fixtures, not a claim of real Storage scanning or onboarding E2E.
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('f7010000-0000-0000-0000-000000000001','ICE','997070000000001','VERIFIED'),('f7010000-0000-0000-0000-000000000001','IF','99707001','VERIFIED'),('f7010000-0000-0000-0000-000000000001','RC','TEST70_1','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','VERIFIED',1,'f7000000-0000-0000-0000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001',1,'{"legal_form":"SARL","if_number":"99707001","rc_number":"TEST70_1","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"P70 Client A SARL","display_name":"P70 Client A SARL","country_code":"MA","identifiers":{"ICE":"997070000000001","IF":"99707001","RC":"TEST70_1"}}',1,'f7000000-0000-0000-0000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001',1,now()-interval'1 day','f7000000-0000-0000-0000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f7111000-0000-0000-0000-000000000001','f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'f7010000-0000-0000-0000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f7000000-0000-0000-0000-000000000002',clock_timestamp(),'f7000000-0000-0000-0000-000000000001'),
('f7111000-0000-0000-0000-000000000002','f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'f7010000-0000-0000-0000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f7000000-0000-0000-0000-000000000002',clock_timestamp(),'f7000000-0000-0000-0000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f7112000-0000-0000-0000-000000000001','f7111000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f7113000-0000-0000-0000-000000000001'),
('f7112000-0000-0000-0000-000000000002','f7111000-0000-0000-0000-000000000002','f7010000-0000-0000-0000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f7113000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f7111000-0000-0000-0000-000000000001' then 'f7112000-0000-0000-0000-000000000001'::uuid
  else 'f7112000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f7111000-0000-0000-0000-000000000001','f7111000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','f7000000-0000-0000-0000-000000000002',clock_timestamp(),'f7000000-0000-0000-0000-000000000001','f7111000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f7110000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','f7000000-0000-0000-0000-000000000002',clock_timestamp(),'f7000000-0000-0000-0000-000000000001','f7111000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('f7110000-0000-4000-8000-000000000002','f7010000-0000-0000-0000-000000000001','f7110000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'1 day',now()+interval'29 days','f7000000-0000-0000-0000-000000000002');

insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('f7010000-0000-0000-0000-000000000002','ICE','997070000000002','VERIFIED'),('f7010000-0000-0000-0000-000000000002','IF','99707002','VERIFIED'),('f7010000-0000-0000-0000-000000000002','RC','TEST70_2','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002','VERIFIED',1,'f7000000-0000-0000-0000-000000000002',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002',1,'{"legal_form":"SARL","if_number":"99707002","rc_number":"TEST70_2","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"P70 Client B SARL","display_name":"P70 Client B SARL","country_code":"MA","identifiers":{"ICE":"997070000000002","IF":"99707002","RC":"TEST70_2"}}',1,'f7000000-0000-0000-0000-000000000002');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002',1,now()-interval'1 day','f7000000-0000-0000-0000-000000000001','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f7121000-0000-0000-0000-000000000001','f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'f7010000-0000-0000-0000-000000000002/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f7000000-0000-0000-0000-000000000001',clock_timestamp(),'f7000000-0000-0000-0000-000000000002'),
('f7121000-0000-0000-0000-000000000002','f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'f7010000-0000-0000-0000-000000000002/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f7000000-0000-0000-0000-000000000001',clock_timestamp(),'f7000000-0000-0000-0000-000000000002');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f7122000-0000-0000-0000-000000000001','f7121000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000002',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f7123000-0000-0000-0000-000000000001'),
('f7122000-0000-0000-0000-000000000002','f7121000-0000-0000-0000-000000000002','f7010000-0000-0000-0000-000000000002',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f7123000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f7121000-0000-0000-0000-000000000001' then 'f7122000-0000-0000-0000-000000000001'::uuid
  else 'f7122000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f7121000-0000-0000-0000-000000000001','f7121000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','f7000000-0000-0000-0000-000000000001',clock_timestamp(),'f7000000-0000-0000-0000-000000000002','f7121000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f7120000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000002','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','f7000000-0000-0000-0000-000000000001',clock_timestamp(),'f7000000-0000-0000-0000-000000000002','f7121000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('f7120000-0000-4000-8000-000000000002','f7010000-0000-0000-0000-000000000002','f7120000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'1 day',now()+interval'29 days','f7000000-0000-0000-0000-000000000001');

insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0070_PROJECTS',1,'ACTIVE',true,10,'{"resource":"PROJECTS"}',now()-interval'1 day',repeat('8',64),'f7000000-0000-0000-0000-000000000002');
insert into public.client_projects(id,organization_id,project_code,status,created_by)values
('f7030000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001','P70_A','DRAFT','f7000000-0000-0000-0000-000000000001'),
('f7030000-0000-0000-0000-000000000002','f7010000-0000-0000-0000-000000000002','P70_B','DRAFT','f7000000-0000-0000-0000-000000000002');
insert into public.client_annual_budgets(id,organization_id,fiscal_year,currency,project_id,status,created_by)values
('f7040000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001',2027,'MAD','f7030000-0000-0000-0000-000000000001','APPROVED','f7000000-0000-0000-0000-000000000001');
insert into public.client_annual_budget_versions(id,budget_id,organization_id,version,amount_minor,approved_amount_minor,rationale,content_hash,created_by)values
('f7050000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001',1,100000,100000,'Budget approuvé P70',repeat('a',64),'f7000000-0000-0000-0000-000000000001');
insert into public.client_cost_centers(id,organization_id,code,created_by)values
('f7060000-0000-0000-0000-000000000001','f7010000-0000-0000-0000-000000000001','P70_CC','f7000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);

select ok(public.save_client_project_task('f7030000-0000-0000-0000-000000000001','TASK_ALLOW','TASK','PENDING',now()+interval'1 day','f7000000-0000-0000-0000-000000000001','Tâche permise','مهمة مسموحة',null,null,'[]','Création contrôlée',0,'p70-task-allow')->>'outcome'='CLIENT_PROJECT_TASK_SAVED','active same-tenant assignee is allowed');
select throws_ok($$select public.save_client_project_task('f7030000-0000-0000-0000-000000000001','TASK_CROSS','TASK','PENDING',now()+interval'1 day','f7000000-0000-0000-0000-000000000002','Tâche interdite','مهمة مرفوضة',null,null,'[]','Test inter organisation',0,'p70-task-cross')$$,'23514','CLIENT_TASK_ASSIGNEE_OUTSIDE_TENANT','cross-tenant assignee is denied');
select throws_ok($$select public.save_client_project_task('f7030000-0000-0000-0000-000000000001','TASK_INACTIVE','TASK','PENDING',now()+interval'1 day','f7000000-0000-0000-0000-000000000003','Tâche inactive','مهمة غير نشطة',null,null,'[]','Test membre suspendu',0,'p70-task-inactive')$$,'23514','CLIENT_TASK_ASSIGNEE_OUTSIDE_TENANT','inactive same-tenant assignee is denied');
select throws_ok($$select public.save_client_project_version('f7030000-0000-0000-0000-000000000001',2,null,'ACTIVE','Projet A','المشروع أ','Description projet A','وصف المشروع أ','[]','{}',null,null,'Transition directe interdite','p70-project-bad')$$,'55000','INVALID_CLIENT_PROJECT_TRANSITION','DRAFT to ACTIVE is denied');
select ok(public.save_client_project_version('f7030000-0000-0000-0000-000000000001',2,null,'PLANNED','Projet A','المشروع أ','Description projet A','وصف المشروع أ','[]','{}',null,null,'Planification permise','p70-project-plan')->>'outcome'='CLIENT_PROJECT_VERSION_SAVED','DRAFT to PLANNED is allowed');
select ok(public.record_client_cost_allocation('f7010000-0000-0000-0000-000000000001','f7060000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001','f7030000-0000-0000-0000-000000000001','COMMITMENT',1000,'PROJECT','f7030000-0000-0000-0000-000000000001',repeat('b',64),'p70-alloc-allow')->>'outcome'='CLIENT_COST_ALLOCATED','same-tenant project allocation is allowed');
select throws_ok($$select public.record_client_cost_allocation('f7010000-0000-0000-0000-000000000001','f7060000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001',null,'COMMITMENT',1000,'PROJECT','f7030000-0000-0000-0000-000000000002',repeat('c',64),'p70-alloc-cross')$$,'23514','CLIENT_COST_REFERENCE_OUTSIDE_TENANT_OR_INVALID','cross-tenant allocation reference is denied');
select throws_ok($$select public.record_client_cost_allocation('f7010000-0000-0000-0000-000000000001','f7060000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001',null,'COMMITMENT',1000,'MANUAL','f7030000-0000-0000-0000-000000000001',repeat('d',64),'p70-alloc-manual')$$,'23514','CLIENT_COST_REFERENCE_OUTSIDE_TENANT_OR_INVALID','manual allocation rejects an untyped identifier');
select ok(public.schedule_client_calendar_event('f7010000-0000-0000-0000-000000000001','f7030000-0000-0000-0000-000000000001','PROJECT_DEADLINE','Échéance projet','موعد المشروع',now()+interval'2 days',null,'PROJECT','f7030000-0000-0000-0000-000000000001','p70-cal-allow')->>'outcome'='CLIENT_CALENDAR_EVENT_SCHEDULED','same-tenant calendar source is allowed');
select throws_ok($$select public.schedule_client_calendar_event('f7010000-0000-0000-0000-000000000001',null,'PROJECT_DEADLINE','Échéance externe','موعد خارجي',now()+interval'2 days',null,'PROJECT','f7030000-0000-0000-0000-000000000002','p70-cal-cross')$$,'23514','CLIENT_CALENDAR_SOURCE_OUTSIDE_TENANT_OR_INVALID','cross-tenant calendar source is denied');
select throws_ok($$select public.schedule_client_calendar_event('f7010000-0000-0000-0000-000000000001',null,'CUSTOM','Source inconnue','مصدر مجهول',now()+interval'2 days',null,'UNKNOWN','f7030000-0000-0000-0000-000000000001','p70-cal-unknown')$$,'23514','CLIENT_CALENDAR_SOURCE_OUTSIDE_TENANT_OR_INVALID','unknown calendar source type is denied');
select ok(public.schedule_client_calendar_event('f7010000-0000-0000-0000-000000000001',null,'CUSTOM','Événement manuel','حدث يدوي',now()+interval'3 days',null,null,null,'p70-cal-manual')->>'outcome'='CLIENT_CALENDAR_EVENT_SCHEDULED','calendar event without source remains allowed');

select ok((select count(*)=1 from public.client_project_tasks where project_id='f7030000-0000-0000-0000-000000000001'),'denied assignee writes leave no partial task');
select ok((select status='PLANNED'and current_version=2 from public.client_projects where id='f7030000-0000-0000-0000-000000000001'),'only the authorized project transition persists');
select ok((select count(*)=1 from public.client_cost_allocations where organization_id='f7010000-0000-0000-0000-000000000001'),'denied allocation references leave no partial ledger entry');
select ok((select count(*)=2 from public.client_calendar_events where organization_id='f7010000-0000-0000-0000-000000000001'),'only valid sourced and manual calendar events persist');
select ok((select count(*)=5 from public.audit_events where organization_id='f7010000-0000-0000-0000-000000000001'and action in('client.project_task.saved','client.project.version_saved','client.cost.allocated','client.calendar_event.scheduled')),'allowed commands emit audit evidence');


-- A real typed allocation waits, then resumes with the immutable saved command.
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,quota_value,configuration,effective_from,content_hash,created_by)values('TEST_0333_USERS',1,'ACTIVE',true,10,'{"resource":"USERS"}',now()-interval'1 day',repeat('6',64),'f7000000-0000-0000-0000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('f7330000-0000-4000-8000-000000000001','f7010000-0000-0000-0000-000000000001','f7000000-0000-0000-0000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('f7330000-0000-4000-8000-000000000001','CLIENT_ADMIN');
create temp table p333(k text primary key,v jsonb);
insert into p333 values('policy',public.propose_client_approval_policy_v1('f7010000-0000-0000-0000-000000000001','COST_ALLOCATION',1,array['CLIENT_OWNER','CLIENT_ADMIN'],1,'MAD',null,now()-interval'1 minute','TEST Client saved-command approval policy','client333-policy'));
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.activate_business_approval_policy((select(v->>'policy_version_id')::uuid from p333 where k='policy'),(select v->>'content_hash'from p333 where k='policy'),'client333-activate');
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000001',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p333 values('pending',public.record_client_typed_cost_allocation('f7010000-0000-0000-0000-000000000001','f7060000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001','f7030000-0000-0000-0000-000000000001','COMMITMENT',1000,'PROJECT','f7030000-0000-0000-0000-000000000001',repeat('e',64),'client333-allocation'));
select is((select v->>'outcome'from p333 where k='pending'),'CLIENT_APPROVAL_REQUIRED','native allocation creates an approval instead of a financial effect');
select is((select count(*)::integer from public.client_cost_allocations where organization_id='f7010000-0000-0000-0000-000000000001'),1,'pending approval leaves the allocation ledger untouched');
select is((select count(*)::integer from private.client_approval_commands_v1 where organization_id='f7010000-0000-0000-0000-000000000001'),1,'exact authorized command and original key are retained');
select ok((select not can_resume and not completed from public.list_my_client_approval_command_states_v1('f7010000-0000-0000-0000-000000000001',array[(select(v->>'approval_request_id')::uuid from p333 where k='pending')])),'pending operation is not presented as executable');
select throws_ok($$select public.execute_client_approved_commitment_v1((select(v->>'approval_request_id')::uuid from p333 where k='pending'),1)$$,'40001','CLIENT_APPROVAL_NOT_APPROVED_OR_CHANGED','a pending command cannot be resumed');
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_business_approval((select(v->>'approval_request_id')::uuid from p333 where k='pending'),1,'APPROVE','TEST independent execution approval','client333-approve');
select throws_ok($$select public.execute_client_approved_commitment_v1((select(v->>'approval_request_id')::uuid from p333 where k='pending'),2)$$,'42501','CLIENT_APPROVAL_RESUME_DENIED','the approver cannot execute by impersonating the original requester');
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000001',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p333 values('executed',public.execute_client_approved_commitment_v1((select(v->>'approval_request_id')::uuid from p333 where k='pending'),2));
select ok((select not can_resume and completed from public.list_my_client_approval_command_states_v1('f7010000-0000-0000-0000-000000000001',array[(select(v->>'approval_request_id')::uuid from p333 where k='pending')])),'completed operation is shown as completed without a second execution action');
select is((select v->>'outcome'from p333 where k='executed'),'CLIENT_TYPED_COST_ALLOCATED','requester resumes the canonical allocation without re-entering its fields');
select is(public.execute_client_approved_commitment_v1((select(v->>'approval_request_id')::uuid from p333 where k='pending'),2),(select v from p333 where k='executed'),'replay returns the persisted completed effect');
select is((select count(*)::integer from public.client_cost_allocations where organization_id='f7010000-0000-0000-0000-000000000001'),2,'replay produces no duplicate allocation');
select is((select count(*)::integer from private.client_approval_command_executions_v1),1,'one immutable execution fact records the completed command');
select ok(not has_function_privilege('authenticated','private.save_client_approval_command_v1(uuid,text,jsonb,text,uuid)','execute'),'browser cannot forge a saved operation');
insert into p333 values('pending-2',public.record_client_typed_cost_allocation('f7010000-0000-0000-0000-000000000001','f7060000-0000-0000-0000-000000000001','f7040000-0000-0000-0000-000000000001','f7030000-0000-0000-0000-000000000001','COMMITMENT',2000,'PROJECT','f7030000-0000-0000-0000-000000000001',repeat('f',64),'client333-allocation-2'));
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_business_approval((select(v->>'approval_request_id')::uuid from p333 where k='pending-2'),1,'REJECT','TEST independent refusal','client333-reject');
select set_config('request.jwt.claim.sub','f7000000-0000-0000-0000-000000000001',true);select set_config('request.jwt.claims','{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.execute_client_approved_commitment_v1((select(v->>'approval_request_id')::uuid from p333 where k='pending-2'),2)$$,'40001','CLIENT_APPROVAL_NOT_APPROVED_OR_CHANGED','a rejected operation cannot be resurrected');
select is((select count(*)::integer from public.client_cost_allocations where organization_id='f7010000-0000-0000-0000-000000000001'),2,'refusal leaves no financial effect');

select * from finish();
rollback;
