begin;
set local search_path=public,extensions;
select plan(29);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='NON_CONTRACTUAL_TRANSACTIONAL_CHECKLIST_104'where singleton;

select has_table('public','mission_checklist_snapshots','mission checklist snapshot table exists');
select ok((select relrowsecurity from pg_class where oid='public.mission_checklist_snapshots'::regclass),'snapshot RLS is enabled');
select ok((select count(*)=1 from pg_policies where schemaname='public' and tablename='mission_checklist_snapshots' and policyname='mission_checklist_snapshots_party_read'),'snapshot has one restrictive party policy');
select ok(not has_table_privilege('anon','public.mission_checklist_snapshots','SELECT') and has_table_privilege('authenticated','public.mission_checklist_snapshots','SELECT'),'only authenticated receives snapshot SELECT');
select ok((select count(*)=2 from pg_trigger where tgname in('service_checklist_templates_immutable','mission_checklist_snapshots_immutable') and not tgisinternal),'template and snapshot records are immutable');
select ok((select p.prosecdef and p.proconfig::text like '%search_path=%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_mission'),'mission command remains security-definer with fixed search path');
select ok(has_function_privilege('authenticated','public.create_mission(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.create_mission(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)','EXECUTE') and not has_function_privilege('service_role','public.create_mission(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)','EXECUTE'),'mission command ACL remains least privilege');
select ok(exists(select 1 from pg_constraint where conname='contract_versions_service_version_snapshot_required' and conrelid='public.contract_versions'::regclass),'new contract versions must freeze a valid service version identifier');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fd100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mf024-client@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mf024-provider@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mf024-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fd110000-0000-4000-8000-000000000001','MF024 Client','MF024 Client','ACTIVE','fd100000-0000-4000-8000-000000000001'),
('fd110000-0000-4000-8000-000000000002','MF024 Provider','MF024 Provider','ACTIVE','fd100000-0000-4000-8000-000000000002'),
('fd110000-0000-4000-8000-000000000003','MF024 Outsider','MF024 Outsider','ACTIVE','fd100000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('fd120000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','ACTIVE'),
('fd120000-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000002','ACTIVE'),
('fd120000-0000-4000-8000-000000000003','fd110000-0000-4000-8000-000000000003','fd100000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('fd120000-0000-4000-8000-000000000001','CLIENT_OWNER'),
('fd120000-0000-4000-8000-000000000002','PROVIDER_OWNER'),
('fd120000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Self-contained two-service catalogue fixture for local databases where the
-- production catalogue bundle is deliberately absent.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('fd300000-0000-4000-8000-000000000001','MISSION_CHECK','mission-check','fd110000-0000-4000-8000-000000000001','PUBLISHED','fd100000-0000-4000-8000-000000000001');
insert into public.catalog_library_versions(id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('fd300000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','MISSION_CHECK','mission-check','Bibliothèque mission','مكتبة المهمة','Fixture mission','اختبار المهمة','check-square',1,'Fixture autonome',repeat('1',64),'APPROVED','fd100000-0000-4000-8000-000000000001',now(),repeat('2',64),1,'fd100000-0000-4000-8000-000000000001',now());update public.catalog_libraries set current_published_version_id='fd300000-0000-4000-8000-000000000002'where id='fd300000-0000-4000-8000-000000000001';
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('fd300000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001','MISSION_CAT','mission-cat','PUBLISHED','fd100000-0000-4000-8000-000000000001');
insert into public.catalog_category_versions(id,category_id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('fd300000-0000-4000-8000-000000000004','fd300000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','MISSION_CAT','mission-cat','Catégorie mission','فئة المهمة','Fixture catégorie','فئة اختبار',1,'Fixture autonome',repeat('3',64),'APPROVED','fd100000-0000-4000-8000-000000000001',now(),repeat('4',64),1,'fd100000-0000-4000-8000-000000000001',now());update public.catalog_categories set current_published_version_id='fd300000-0000-4000-8000-000000000004'where id='fd300000-0000-4000-8000-000000000003';
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('fd300000-0000-4000-8000-000000000005','fd300000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000003','MISSION_SUB','mission-sub','PUBLISHED','fd100000-0000-4000-8000-000000000001');
insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,version,status,category_id,code,slug,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values('fd300000-0000-4000-8000-000000000006','fd300000-0000-4000-8000-000000000005','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','fd300000-0000-4000-8000-000000000003','MISSION_SUB','mission-sub','Sous-catégorie mission','فئة فرعية','Fixture sous-catégorie','اختبار فرعي',1,'Fixture autonome',repeat('5',64),'APPROVED','fd100000-0000-4000-8000-000000000001',now(),repeat('6',64),1,'fd100000-0000-4000-8000-000000000001',now());update public.catalog_subcategories set current_published_version_id='fd300000-0000-4000-8000-000000000006'where id='fd300000-0000-4000-8000-000000000005';
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('fd300000-0000-4000-8000-000000000007','fd300000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000005','MISSION_A','mission-a','PUBLISHED','fd100000-0000-4000-8000-000000000001'),('fd300000-0000-4000-8000-000000000008','fd300000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000005','MISSION_B','mission-b','PUBLISHED','fd100000-0000-4000-8000-000000000001');
insert into public.catalog_service_versions(id,service_id,library_id,version,status,primary_subcategory_id,code,slug,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,created_by,published_at)values
('fd300000-0000-4000-8000-000000000009','fd300000-0000-4000-8000-000000000007','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','fd300000-0000-4000-8000-000000000005','MISSION_A','mission-a','Mission A','المهمة أ','Service mission A','خدمة المهمة أ','Service mission principal','خدمة المهمة الرئيسية','CONSULTING','jour','يوم',1,'Fixture autonome',repeat('7',64),'APPROVED','fd100000-0000-4000-8000-000000000001',now(),repeat('8',64),1,'fd100000-0000-4000-8000-000000000001',now()),
('fd300000-0000-4000-8000-000000000010','fd300000-0000-4000-8000-000000000008','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','fd300000-0000-4000-8000-000000000005','MISSION_B','mission-b','Mission B','المهمة ب','Service mission B','خدمة المهمة ب','Service mission secondaire','خدمة المهمة الثانوية','CONSULTING','jour','يوم',2,'Fixture autonome',repeat('9',64),'APPROVED','fd100000-0000-4000-8000-000000000001',now(),repeat('a',64),1,'fd100000-0000-4000-8000-000000000001',now());
update public.catalog_services set current_published_version_id=case id when'fd300000-0000-4000-8000-000000000007'then'fd300000-0000-4000-8000-000000000009'::uuid else'fd300000-0000-4000-8000-000000000010'::uuid end where id in('fd300000-0000-4000-8000-000000000007','fd300000-0000-4000-8000-000000000008');

create temporary table mf024_catalog as
select s.id service_id,s.library_id,s.current_published_version_id service_version_id
from public.catalog_services s
where s.id='fd300000-0000-4000-8000-000000000007'and s.status='PUBLISHED' and s.current_published_version_id is not null
order by s.id limit 1;
select ok((select count(*)=1 from mf024_catalog),'one published service version is available for the isolated fixture');

insert into public.service_checklist_templates(id,service_version_id,version,items,content_hash,created_by,publication_status,published_at,published_by)
select 'fd130000-0000-4000-8000-000000000001',service_version_id,1,
  '[{"key":"PREPARE","label_fr":"Préparer la mission","label_ar":"إعداد المهمة","instructions_fr":"Préparer les éléments nécessaires","instructions_ar":"إعداد العناصر اللازمة","proof_required":false,"proof_types":[]},{"key":"VERIFY","label_fr":"Vérifier la preuve","label_ar":"التحقق من الدليل","instructions_fr":"Vérifier le document transmis","instructions_ar":"التحقق من الوثيقة المرسلة","proof_required":true,"proof_types":["DOCUMENT"]}]'::jsonb,
  repeat('a',64),'fd100000-0000-4000-8000-000000000001','PUBLISHED',clock_timestamp(),'fd100000-0000-4000-8000-000000000001' from mf024_catalog;

create temporary table mf024_other_catalog as
select s.id service_id,s.current_published_version_id service_version_id from public.catalog_services s,mf024_catalog selected
where s.id='fd300000-0000-4000-8000-000000000008'and s.status='PUBLISHED' and s.current_published_version_id is not null and s.id<>selected.service_id order by s.id limit 1;
insert into public.service_checklist_templates(id,service_version_id,version,items,content_hash,created_by,publication_status,published_at,published_by)
select 'fd130000-0000-4000-8000-000000000002',service_version_id,1,
  '[{"key":"OTHER","label_fr":"Autre service","label_ar":"خدمة أخرى","instructions_fr":"Exécuter la checklist de l’autre service","instructions_ar":"تنفيذ قائمة تحقق الخدمة الأخرى","proof_required":false,"proof_types":[]}]'::jsonb,
  repeat('d',64),'fd100000-0000-4000-8000-000000000001','PUBLISHED',clock_timestamp(),'fd100000-0000-4000-8000-000000000001' from mf024_other_catalog;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fd100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mf024-reviewer-a@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mf024-reviewer-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('fd100000-0000-4000-8000-000000000004','SUPER_ADMIN'),('fd100000-0000-4000-8000-000000000005','SUPER_ADMIN');
-- Current identity fixtures retain real checks; only upstream review records are seeded.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-identity-signature-fixture',configured_at=clock_timestamp()where singleton;
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('fd110000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','fd100000-0000-4000-8000-000000000002');
insert into public.provider_match_profiles(provider_organization_id,region_codes)values('fd110000-0000-4000-8000-000000000002',array['CASABLANCA']);

select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select public.decide_provider_company('fd110000-0000-4000-8000-000000000002','VERIFIED','SIGNED',null,'TEST independent synthetic company review','TEST-ANCHOR',1,'TEST-0104-company-review');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fd110000-0000-4000-8000-000000000002','ICE','997104000000002'),('fd110000-0000-4000-8000-000000000002','IF','99710402'),('fd110000-0000-4000-8000-000000000002','RC','TEST-104-PROVIDER');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='fd100000-0000-4000-8000-000000000004';org uuid:='fd110000-0000-4000-8000-000000000002';begin
 foreach kind in array array['LEGAL','FISCAL','INSURANCE']loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  u:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',u->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  d:=public.record_provider_document_version(org,kind,'ANCHOR_'||kind,jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+365)::text,'storage_object_path',u->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic identity evidence for quote test','anchor-doc-'||kind);
  select id into job from public.provider_document_scan_jobs where document_version_id=(d->>'document_version_id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform public.record_provider_document_scan_result(job,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'anchor-scan-'||kind);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);perform public.review_provider_document((d->>'document_version_id')::uuid,'VERIFIED','Synthetic reviewer decision','TEST-ANCHOR','anchor-review-'||kind);
 end loop;
 context:=public.get_provider_identity_review_context_v1(org);
 perform public.revalidate_provider_identity_v1(org,(context->>'organization_row_version')::integer,(context->>'profile_row_version')::integer,context->>'identity_hash',(context->>'company_decision_id')::uuid,'Synthetic current identity review before publication',extensions.gen_random_uuid());
end$$;
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('fd110000-0000-4000-8000-000000000001','ICE','997104000000001','VERIFIED'),('fd110000-0000-4000-8000-000000000001','IF','99710401','VERIFIED'),('fd110000-0000-4000-8000-000000000001','RC','TEST104','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','VERIFIED',1,'fd100000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99710401","rc_number":"TEST104","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"MF024 Client","display_name":"MF024 Client","country_code":"MA","identifiers":{"ICE":"997104000000001","IF":"99710401","RC":"TEST104"}}',1,'fd100000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001',1,now()-interval'1 day','fd100000-0000-4000-8000-000000000004','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('fd411000-0000-0000-0000-000000000001','fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'fd110000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'fd100000-0000-4000-8000-000000000004',clock_timestamp(),'fd100000-0000-4000-8000-000000000001'),
('fd411000-0000-0000-0000-000000000002','fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'fd110000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'fd100000-0000-4000-8000-000000000004',clock_timestamp(),'fd100000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('fd412000-0000-0000-0000-000000000001','fd411000-0000-0000-0000-000000000001','fd110000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','fd413000-0000-0000-0000-000000000001'),
('fd412000-0000-0000-0000-000000000002','fd411000-0000-0000-0000-000000000002','fd110000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','fd413000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'fd411000-0000-0000-0000-000000000001' then 'fd412000-0000-0000-0000-000000000001'::uuid
  else 'fd412000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('fd411000-0000-0000-0000-000000000001','fd411000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','fd100000-0000-4000-8000-000000000004',clock_timestamp(),'fd100000-0000-4000-8000-000000000001','fd411000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('fd410000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','fd100000-0000-4000-8000-000000000004',clock_timestamp(),'fd100000-0000-4000-8000-000000000001','fd411000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');



insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)
select 'fd140000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001',library_id,service_id,'CONTRACT_PENDING','fd100000-0000-4000-8000-000000000001' from mf024_catalog;
-- The signed service is the exact published version frozen by the RFQ request.
-- All upstream FKs and invitation/selected-quote guards stay enabled.
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)
select 'fd160000-0000-4000-8000-000000000001','fd140000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001',c.library_id,1,'Demande synthétique de checklist','NORMAL','MAD',jsonb_build_object('region_code','CASABLANCA','service_version_id',c.service_version_id),true,v.content_hash,repeat('1',64),'TEST immutable RFQ source',repeat('2',64),'fd100000-0000-4000-8000-000000000001'
from mf024_catalog c join public.catalog_service_versions v on v.id=c.service_version_id;
update public.service_requests set current_version_id='fd160000-0000-4000-8000-000000000001'where id='fd140000-0000-4000-8000-000000000001';



-- Native service request, reviewed qualification and declared capacity make the
-- invitation eligible from versioned evidence; match booleans are not authority.
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by)values('fd510000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000001','TEST.0104.V1','DRAFT',repeat('e',64),'fd100000-0000-4000-8000-000000000004');
insert into public.questionnaires(id,library_id,code,status,created_by)values('fd510000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001','TEST_PROVIDER_0104','DRAFT','fd100000-0000-4000-8000-000000000004');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by)values('fd510000-0000-4000-8000-000000000003','fd510000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire synthétique fournisseur','استبيان مقدم خدمة للاختبار','Source historique de recette','مصدر تاريخي للاختبار','PROVIDER','1.0.0','TEST-0104',repeat('f',64),'TEST source de qualification','fd100000-0000-4000-8000-000000000004');
do $$declare requested jsonb;begin
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 requested:=public.request_provider_service('fd110000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000007','TEST-0104-service-request');
 insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)values('fd510000-0000-4000-8000-000000000004','fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000003','PROVIDER','fr-MA','SUBMITTED',clock_timestamp(),'{}',repeat('1',64));
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_provider_qualification((requested->>'qualification_id')::uuid,'APPROVED','fd510000-0000-4000-8000-000000000004',8000,'[{"key":"IDENTITY","passed":true}]','[]','TEST independent synthetic qualification','TEST-0104',clock_timestamp()+interval'1 year',1,'TEST-0104-qualification');
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.declare_provider_capacity('fd110000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000007','AVAILABLE',5,2,'TEST provider capacity declaration','TEST-0104-capacity');
end$$;
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)
values('fd170000-0000-4000-8000-000000000001','fd140000-0000-4000-8000-000000000001','fd160000-0000-4000-8000-000000000001','MATCH-V1','COMPLETED',1,'fd100000-0000-4000-8000-000000000001',clock_timestamp());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)
values('fd171000-0000-4000-8000-000000000001','fd170000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,invited_count,opened_by)
values('fd150000-0000-4000-8000-000000000001','fd140000-0000-4000-8000-000000000001','fd160000-0000-4000-8000-000000000001','fd170000-0000-4000-8000-000000000001','OPEN',clock_timestamp()+interval'1 day',1,'fd100000-0000-4000-8000-000000000001');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)
values('fd190000-0000-4000-8000-000000000001','fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','fd171000-0000-4000-8000-000000000001','ACCEPTED',clock_timestamp());
-- Resolve the quote/version cycle in FK order, then select the exact version.
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)
values('fd180000-0000-4000-8000-000000000001','fd150000-0000-4000-8000-000000000001','fd190000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT','fd100000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,created_by,submitted_at)
values('fd200000-0000-4000-8000-000000000001','fd180000-0000-4000-8000-000000000001','fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002',1,'SUBMITTED','MF024 quote','MAD','Mission checklist','["Livrable"]','Garantie','Correction','2026-10-01',10,'2027-01-01',10000,2000,12000,0,'{}',repeat('b',64),'fd100000-0000-4000-8000-000000000001',clock_timestamp());
update public.quotes set status='SELECTED',current_version_id='fd200000-0000-4000-8000-000000000001',selected_version_id='fd200000-0000-4000-8000-000000000001'where id='fd180000-0000-4000-8000-000000000001';
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)
values('fd210000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT',1,'fd100000-0000-4000-8000-000000000001');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select 'fd220000-0000-4000-8000-000000000001','fd210000-0000-4000-8000-000000000001',1,'fd200000-0000-4000-8000-000000000001',jsonb_build_object('service_version_id',service_version_id),jsonb_build_object('quote_version_id','fd200000-0000-4000-8000-000000000001'),'{}'::jsonb,12000,'MAD','{}'::jsonb,repeat('c',64),'MF024 contract','fd100000-0000-4000-8000-000000000001' from mf024_catalog;
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)
values('fd210000-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT',1,'fd100000-0000-4000-8000-000000000001');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select 'fd220000-0000-4000-8000-000000000002','fd210000-0000-4000-8000-000000000002',1,'fd200000-0000-4000-8000-000000000001',jsonb_build_object('service_version_id',service_version_id),jsonb_build_object('quote_version_id','fd200000-0000-4000-8000-000000000001'),'{}'::jsonb,12000,'MAD','{}'::jsonb,repeat('e',64),'Spoofed service contract','fd100000-0000-4000-8000-000000000001' from mf024_other_catalog;

-- A third independently sealed draft supports invalid-mapping attempts without
-- colliding with the already-created mission's one-mission-per-contract rule.
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)values('fd210000-0000-4000-8000-000000000003','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT',1,'fd100000-0000-4000-8000-000000000001');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select 'fd220000-0000-4000-8000-000000000003','fd210000-0000-4000-8000-000000000003',1,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,repeat('f',64),'Milestone mapping source','fd100000-0000-4000-8000-000000000001'from public.contract_versions where id='fd220000-0000-4000-8000-000000000001';
-- Parties freeze the same canonical identities that the native signature command verifies.
insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)
select v.id,c.client_organization_id,'CLIENT',private.current_client_contract_party_v1(c.client_organization_id)from public.contract_versions v join public.contracts c on c.id=v.contract_id where c.id in('fd210000-0000-4000-8000-000000000001','fd210000-0000-4000-8000-000000000002','fd210000-0000-4000-8000-000000000003')
union all
select v.id,c.provider_organization_id,'PROVIDER',private.provider_current_identity_snapshot_v1(c.provider_organization_id)||jsonb_build_object('verified_identity_hash',private.canonical_request_hash(private.provider_current_identity_snapshot_v1(c.provider_organization_id)))from public.contract_versions v join public.contracts c on c.id=v.contract_id where c.id in('fd210000-0000-4000-8000-000000000001','fd210000-0000-4000-8000-000000000002','fd210000-0000-4000-8000-000000000003');

-- Transaction-only DEV simulation of the actual native provider, not a legal
-- signature assertion or a bypass of the current-version signature helper.
insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at)
select 'DEVELOPMENT','CONTRACT',1,id,'SIMPLE',true,false,false,'NON_CONTRACTUAL_SQL_FIXTURE_104','TRANSACTION_ONLY_DEV_ADAPTER_104','fd100000-0000-4000-8000-000000000004','fd100000-0000-4000-8000-000000000005',clock_timestamp()-interval'1 second'from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT';
do $$declare source record;envelope uuid;client_signer uuid;provider_signer uuid;begin
 for source in select id,contract_id from public.contract_versions where id in('fd220000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000002','fd220000-0000-4000-8000-000000000003')order by id loop
  perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
  envelope:=(public.create_signature_envelope(source.contract_id,source.id,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','noncontractual-checklist104.pdf','transaction-only/checklist104.pdf',repeat('b',64),'checklist104-envelope-'||source.id)->>'envelope_id')::uuid;
  client_signer:=(public.add_signature_signer(envelope,'fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest('mf024-client@example.invalid','sha256'),'hex'),1,'checklist104-client-'||source.id)->>'signer_id')::uuid;
  perform public.authorize_signature_signer(client_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/client104.pdf',repeat('c',64),'checklist104-client-authority-'||source.id);
  provider_signer:=(public.add_signature_signer(envelope,'fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000002','PROVIDER_OWNER',encode(extensions.digest('mf024-provider@example.invalid','sha256'),'hex'),2,'checklist104-provider-'||source.id)->>'signer_id')::uuid;
  perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
  perform public.authorize_signature_signer(provider_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/provider104.pdf',repeat('d',64),'checklist104-provider-authority-'||source.id);
  perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
  perform public.submit_contract_for_signature(source.contract_id,1,'checklist104-submit-'||source.id);
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.run_mock_signature_provider(envelope,'SENT',null,'checklist104-sent-'||source.id);perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',client_signer,'checklist104-client-signed-'||source.id);perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',provider_signer,'checklist104-provider-signed-'||source.id);
 end loop;
end$$;
select ok(private.contract_version_signature_effective_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001'),'current contract has real sealed native DEV-mock proof');
select ok(private.contract_version_signature_effective_v1('fd210000-0000-4000-8000-000000000002','fd220000-0000-4000-8000-000000000002'),'spoofed-source test also has proof so signature guard cannot mask service denial');

create temporary table mf024_observed(key text primary key,value text);
grant insert,select on table mf024_observed to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
create temporary table mf024_result as
select public.create_mission(
  'fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',
  '[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1,"due_at":"2026-11-01T12:00:00Z","validation_required":true}]',
  '[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير","proof_required":true}]',
  '[{"deliverable_key":"D1","criterion_key":"QUALITY"}]',
  'mf024-mission-create','fd230000-0000-4000-8000-000000000001'
) response;
insert into mf024_observed values
('version',(select response->>'checklist_template_version' from mf024_result)),
('snapshots',(select count(*)::text from public.mission_checklist_snapshots)),
('items',(select count(*)::text from public.mission_checklist_items)),
('exact',(select (items='[{"key":"PREPARE","label_fr":"Préparer la mission","label_ar":"إعداد المهمة","instructions_fr":"Préparer les éléments nécessaires","instructions_ar":"إعداد العناصر اللازمة","proof_required":false,"proof_types":[]},{"key":"VERIFY","label_fr":"Vérifier la preuve","label_ar":"التحقق من الدليل","instructions_fr":"Vérifier le document transmis","instructions_ar":"التحقق من الوثيقة المرسلة","proof_required":true,"proof_types":["DOCUMENT"]}]'::jsonb and template_content_hash=repeat('a',64))::text from public.mission_checklist_snapshots));
reset role;
insert into mf024_observed values
('audits',(select count(*)::text from public.audit_events where action='mission.checklist_snapshotted')),
('outbox',(select count(*)::text from public.event_outbox where event_type='MissionChecklistSnapshottedV1'));
select ok(exists(select 1 from public.deliverables d join public.mission_milestones milestone on milestone.id=d.milestone_id and milestone.mission_id=d.mission_id where d.mission_id=(select(response->>'mission_id')::uuid from mf024_result)and d.deliverable_key='D1'and milestone.milestone_key='M1'),'create_mission itself links D1 to its sole M1 milestone');
select ok((select value='1' from mf024_observed where key='version'),'mission response exposes the frozen checklist version');
select ok((select value='1' from mf024_observed where key='snapshots'),'client sees one immutable checklist snapshot');
select ok((select value='2' from mf024_observed where key='items'),'every versioned template item is copied to the mission');
select ok((select value='true' from mf024_observed where key='exact'),'snapshot preserves exact bilingual content and hash');
select ok((select value='1' from mf024_observed where key='audits'),'snapshot emits one audit event');
select ok((select value='1' from mf024_observed where key='outbox'),'snapshot emits one Outbox event');
select throws_ok($$select public.create_mission('fd210000-0000-4000-8000-000000000002','fd220000-0000-4000-8000-000000000002','[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1}]','[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير"}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mf024-spoofed-service','fd230000-0000-4000-8000-000000000002')$$,'22023','CONTRACT_SERVICE_SOURCE_DIVERGENCE','signed contract snapshot cannot substitute another service for the immutable RFQ source');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.create_mission(
  'fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',
  '[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1,"due_at":"2026-11-01T12:00:00Z","validation_required":true}]',
  '[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير","proof_required":true}]',
  '[{"deliverable_key":"D1","criterion_key":"QUALITY"}]',
  'mf024-mission-create','fd230000-0000-4000-8000-000000000001'
);
insert into mf024_observed values('replay-snapshots',(select count(*)::text from public.mission_checklist_snapshots));

select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into mf024_observed values
('outsider-snapshots',(select count(*)::text from public.mission_checklist_snapshots)),
('outsider-items',(select count(*)::text from public.mission_checklist_items));

reset role;
insert into mf024_observed values('replay-audits',(select count(*)::text from public.audit_events where action='mission.checklist_snapshotted'));
select ok((select value='1' from mf024_observed where key='replay-snapshots') and (select value='1' from mf024_observed where key='replay-audits'),'idempotent replay creates no duplicate snapshot or audit');
select ok((select value='0' from mf024_observed where key='outsider-snapshots'),'unrelated tenant cannot read the checklist snapshot');
select ok((select value='0' from mf024_observed where key='outsider-items'),'unrelated tenant cannot read mission checklist items');
select throws_ok($$update public.mission_checklist_snapshots set template_version=2 where id=(select id from public.mission_checklist_snapshots limit 1)$$,'55000','IMMUTABLE_CONTRACT_RECORD','snapshot cannot be mutated');

-- Public create_mission must resolve new milestone keys in the same command.
-- Keep pgTAP under the test owner; JWT claims still drive the public command.
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.create_mission('fd210000-0000-4000-8000-000000000003','fd220000-0000-4000-8000-000000000003','[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1}]','[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير","milestone_key":"MISSING"}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mf024-unknown-milestone')$$,'22023','DELIVERABLE_MILESTONE_SCOPE_DENIED','unknown milestone key is denied by actual creation');
select throws_ok($$select public.create_mission('fd210000-0000-4000-8000-000000000003','fd220000-0000-4000-8000-000000000003','[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1}]',jsonb_build_array(jsonb_build_object('key','D1','label_fr','Rapport','label_ar','تقرير','milestone_id',(select id from public.mission_milestones where mission_id=(select(response->>'mission_id')::uuid from mf024_result)and milestone_key='M1'))),'[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mf024-foreign-milestone')$$,'22023','DELIVERABLE_MILESTONE_SCOPE_DENIED','another mission UUID is denied even for the same authorized client');
select throws_ok($$select public.create_mission('fd210000-0000-4000-8000-000000000003','fd220000-0000-4000-8000-000000000003','[{"key":"M1","title_fr":"Préparation","title_ar":"التحضير","sort_order":1},{"key":"M2","title_fr":"Livraison","title_ar":"التسليم","sort_order":2}]','[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير"}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mf024-ambiguous-milestone')$$,'22023','DELIVERABLE_MILESTONE_KEY_REQUIRED','multiple milestones require an explicit deliverable key');
set local role authenticated;
create temporary table mf024_more_result as select public.create_mission('fd210000-0000-4000-8000-000000000003','fd220000-0000-4000-8000-000000000003','[{"key":"M1","title_fr":"Préparation","title_ar":"التحضير","sort_order":1},{"key":"M2","title_fr":"Livraison","title_ar":"التسليم","sort_order":2}]','[{"key":"D1","label_fr":"Rapport","label_ar":"تقرير","milestone_key":"M2"}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mf024-explicit-milestone')response;
reset role;
select ok(exists(select 1 from public.deliverables d join public.mission_milestones milestone on milestone.id=d.milestone_id and milestone.mission_id=d.mission_id where d.mission_id=(select(response->>'mission_id')::uuid from mf024_more_result)and d.deliverable_key='D1'and milestone.milestone_key='M2'),'explicit key M2 binds to the newly created M2 without any UPDATE repair');
reset role;
select throws_ok($$insert into public.deliverables(mission_id,milestone_id,deliverable_key,label_fr,label_ar)select(new_m.response->>'mission_id')::uuid,old_m.id,'WRONG_FK','Rapport','تقرير'from mf024_more_result new_m cross join public.mission_milestones old_m where old_m.mission_id=(select(response->>'mission_id')::uuid from mf024_result)and old_m.milestone_key='M1'$$,'23503',null,'composite FK prevents a deliverable from storing a foreign milestone');
select throws_ok($$update public.mission_checklist_items set milestone_id=(select id from public.mission_milestones where mission_id=(select(response->>'mission_id')::uuid from mf024_result)and milestone_key='M1')where mission_id=(select(response->>'mission_id')::uuid from mf024_more_result)and item_key='PREPARE'$$,'23503',null,'composite FK prevents checklist items from storing a foreign milestone');
select * from finish();
rollback;
