begin;
set local search_path=public,extensions;
select no_plan();
-- TEST ONLY canonical contract fixture shared with Provider delivery; no guards are disabled.
grant usage on schema extensions to authenticated,service_role;
-- Rollback-only historical catalogue/identity/qualification prerequisites from0104.
-- Public native mission/dispute commands are exercised; no externalsignature/AVclaim.
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
create temporary table accept338(k text primary key,v jsonb);grant select,insert on accept338 to authenticated;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into accept338 values('policy',public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_ACCEPT338','version',1,'library_id','fd300000-0000-4000-8000-000000000001','service_id','fd300000-0000-4000-8000-000000000007','country_code','MA','title_fr','Clauses de recette uniquement','title_ar','بنود اختبار فقط','clauses',jsonb_build_object('fr','Texte synthétique de test uniquement, sans valeur de signature légale.','ar','نص اصطناعي للاختبار فقط دون توقيع قانوني.','dispute_policy',jsonb_build_object('version','TEST-338','response_hours',48,'urgent_response_hours',8,'correction_business_days',3,'review_business_days',5,'appeal_hours',72)),'valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-ACCEPTANCE338'),'accept338-template'));
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from accept338 where k='policy'),true,'Approbation indépendante synthétique de recette','accept338-policy-approve');
-- Resolve the quote/version cycle in FK order, then select the exact version.
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)
values('fd180000-0000-4000-8000-000000000001','fd150000-0000-4000-8000-000000000001','fd190000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT','fd100000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,created_by,submitted_at)
values('fd200000-0000-4000-8000-000000000001','fd180000-0000-4000-8000-000000000001','fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002',1,'SUBMITTED','MF024 quote','MAD','Mission checklist','["Livrable"]','Garantie','Correction','2026-10-01',10,'2027-01-01',10000,2000,12000,0,'{}',repeat('b',64),'fd100000-0000-4000-8000-000000000001',clock_timestamp());
update public.quotes set status='SELECTED',current_version_id='fd200000-0000-4000-8000-000000000001',selected_version_id='fd200000-0000-4000-8000-000000000001'where id='fd180000-0000-4000-8000-000000000001';
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by)
values('fd210000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','DRAFT',1,'fd100000-0000-4000-8000-000000000001');
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select 'fd220000-0000-4000-8000-000000000001','fd210000-0000-4000-8000-000000000001',1,'fd200000-0000-4000-8000-000000000001',jsonb_build_object('service_version_id',service_version_id),jsonb_build_object('quote_version_id','fd200000-0000-4000-8000-000000000001'),(select p.data->'clauses'||jsonb_build_object('template_policy_version_id',p.id,'template_code',p.code,'template_version',p.version,'template_content_hash',p.content_hash,'approval_reference',p.approval_reference)from public.contract_policy_versions_v1 p where p.id=(select(v->>'policy_version_id')::uuid from accept338 where k='policy')),12000,'MAD','{"basis_points":1000,"version":"TEST347-SIGNED-COMMISSION"}'::jsonb,repeat('c',64),'MF024 contract','fd100000-0000-4000-8000-000000000001' from mf024_catalog;
insert into public.contract_items(contract_version_id,item_key,item_type,label_fr,label_ar,details,sort_order)values
('fd220000-0000-4000-8000-000000000001','SIGNED_REPORT','DELIVERABLE','Rapport contractuel figé','تقرير تعاقدي ثابت','{"source_deliverable":"Le texte libre signé reste en français."}',1);
insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)values
('fd220000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','CLIENT',private.current_client_contract_party_v1('fd110000-0000-4000-8000-000000000001')),
('fd220000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','PROVIDER',private.provider_current_identity_snapshot_v1('fd110000-0000-4000-8000-000000000002')||jsonb_build_object('verified_identity_hash',private.canonical_request_hash(private.provider_current_identity_snapshot_v1('fd110000-0000-4000-8000-000000000002'))));
create function pg_temp.prepare_governed_mock_policy_v1(p_issuer_org uuid,p_policy_proposer uuid,p_policy_reviewer uuid,p_key text)returns jsonb language plpgsql as $$declare cfg uuid;proposal jsonb;begin
 select id into cfg from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment=(select environment from private.admin_execution_environment_v1 where singleton)and status='ACTIVE'order by version desc limit 1;
 perform set_config('request.jwt.claim.sub',p_policy_proposer::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_policy_proposer,'role','authenticated','aal','aal2')::text,true);
 proposal:=public.propose_signature_policy_v1(p_issuer_org,'CONTRACT',cfg,'SIMPLE',false,false,'DEV-NON-CONTRACTUAL-FIXTURE','DEV-INSTALLED-MOCK',1,'Transactional noncontractual protocol fixture',md5('policy:'||p_key)::uuid);
 perform set_config('request.jwt.claim.sub',p_policy_reviewer::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_policy_reviewer,'role','authenticated','aal','aal2')::text,true);
 perform public.decide_signature_policy_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'Independent review of noncontractual test policy');
 return proposal;
end$$;
-- Transactional pgTAP fixture only. No function/configuration survives ROLLBACK.
-- Requires explicit trusted DEVELOPMENT/STAGING, an actual DRAFT contract, two verified
-- party writers, current verified Client/Provider identities and two platform policy reviewers.
-- This exercises the real governed SIMPLE mock SDK, never a legal signature or real AV.
create function pg_temp.complete_governed_mock_contract_v1(p_contract_id uuid,p_client_signer uuid,p_provider_signer uuid,p_policy_proposer uuid,p_policy_reviewer uuid,p_key text)returns jsonb language plpgsql as $$
declare c public.contracts%rowtype;v public.contract_versions%rowtype;client_party jsonb;provider_party jsonb;proposal jsonb;envelope jsonb;s_client uuid;s_provider uuid;role_client text;role_provider text;cfg uuid;result jsonb;begin
 if(select environment from private.admin_execution_environment_v1 where singleton)not in('DEVELOPMENT','STAGING')then raise exception'TEST_EXPLICIT_NONPRODUCTION_REQUIRED';end if;
 select*into c from public.contracts where id=p_contract_id;select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 if c.id is null or c.status<>'DRAFT'or v.id is null then raise exception'TEST_ACTUAL_DRAFT_REQUIRED';end if;
 client_party:=private.current_client_contract_party_v1(c.client_organization_id);
 if client_party is null or not private.provider_current_identity_is_verified_v1(c.provider_organization_id)then raise exception'TEST_CURRENT_VERIFIED_IDENTITIES_REQUIRED';end if;
 provider_party:=private.provider_current_identity_snapshot_v1(c.provider_organization_id);
 provider_party:=provider_party||jsonb_build_object('schema_version',1,'verified_identity_hash',private.canonical_request_hash(provider_party),'registered_address','Synthetic provider fixture address');
 insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)select v.id,c.client_organization_id,'CLIENT',client_party where not exists(select 1 from public.contract_parties where contract_version_id=v.id and party_role='CLIENT');
 insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)select v.id,c.provider_organization_id,'PROVIDER',provider_party where not exists(select 1 from public.contract_parties where contract_version_id=v.id and party_role='PROVIDER');
 select id into cfg from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment=(select environment from private.admin_execution_environment_v1 where singleton)and status='ACTIVE'order by version desc limit 1;
 if (private.require_contract_signature_policy_v1('CONTRACT')).governance_proposal_id is null then raise exception'TEST_GOVERNED_POLICY_REQUIRED';end if;
 select role_code into role_client from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=c.client_organization_id and m.user_id=p_client_signer and m.status='ACTIVE'and r.role_code in('CLIENT_OWNER','CLIENT_ADMIN')order by r.role_code limit 1;
 select role_code into role_provider from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=c.provider_organization_id and m.user_id=p_provider_signer and m.status='ACTIVE'and r.role_code in('PROVIDER_OWNER','PROVIDER_MANAGER')order by r.role_code limit 1;
 perform set_config('request.jwt.claim.sub',p_client_signer::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_client_signer,'role','authenticated','aal','aal2')::text,true);
 envelope:=public.create_signature_envelope(c.id,v.id,'MATRICIA_DEV_MOCK',(select environment from private.admin_execution_environment_v1 where singleton),'SIMPLE','noncontractual-test.pdf','test-signatures/'||p_key||'.pdf',repeat('d',64),'fixture-envelope:'||p_key);
 s_client:=(public.add_signature_signer((envelope->>'envelope_id')::uuid,c.client_organization_id,p_client_signer,role_client,(select encode(extensions.digest(lower(btrim(email)),'sha256'),'hex')from auth.users where id=p_client_signer),1,'fixture-client:'||p_key)->>'signer_id')::uuid;
 s_provider:=(public.add_signature_signer((envelope->>'envelope_id')::uuid,c.provider_organization_id,p_provider_signer,role_provider,(select encode(extensions.digest(lower(btrim(email)),'sha256'),'hex')from auth.users where id=p_provider_signer),2,'fixture-provider:'||p_key)->>'signer_id')::uuid;
 perform public.authorize_signature_signer(s_client,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],v.price_minor,v.currency,current_date-1,current_date+1,'test-authorities/client.pdf',repeat('c',64),'fixture-client-authority:'||p_key);
 perform set_config('request.jwt.claim.sub',p_provider_signer::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_provider_signer,'role','authenticated','aal','aal2')::text,true);
 perform public.authorize_signature_signer(s_provider,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],v.price_minor,v.currency,current_date-1,current_date+1,'test-authorities/provider.pdf',repeat('b',64),'fixture-provider-authority:'||p_key);
 perform set_config('request.jwt.claim.sub',p_client_signer::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_client_signer,'role','authenticated','aal','aal2')::text,true);
 perform public.submit_contract_for_signature(c.id,c.row_version,'fixture-submit:'||p_key);
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.run_mock_signature_provider((envelope->>'envelope_id')::uuid,'SENT',null,'fixture-sent:'||p_key);
 perform public.run_mock_signature_provider((envelope->>'envelope_id')::uuid,'SIGNER_SIGNED',s_client,'fixture-client-signed:'||p_key);
 result:=public.run_mock_signature_provider((envelope->>'envelope_id')::uuid,'SIGNER_SIGNED',s_provider,'fixture-provider-signed:'||p_key);
 if not private.contract_version_signature_effective_v1(c.id,v.id)then raise exception'TEST_COMPLETED_SOURCE_NOT_EFFECTIVE_IN_DEVELOPMENT';end if;
 return result||jsonb_build_object('development_mock',true,'mode','NON_CONTRACTUAL_DEMO');
end$$;
select pg_temp.prepare_governed_mock_policy_v1('fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000004','fd100000-0000-4000-8000-000000000005','accept338');
select pg_temp.complete_governed_mock_contract_v1('fd210000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000004','fd100000-0000-4000-8000-000000000005','accept338');
select ok(private.contract_version_signature_effective_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001'),'contract is sealed by real native governed DEV-mock flow, not forged signature validation');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into accept338 values('preparation',public.get_client_mission_preparation_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001'));
select is((select v#>>'{deliverables,0,key}'from accept338 where k='preparation'),'SIGNED_REPORT','Client preparation uses signed deliverable key');
select is((select v#>>'{deliverables,0,label_fr}'from accept338 where k='preparation'),'Rapport contractuel figé','signed deliverable label is preserved');
select is((select v#>>'{deliverables,0,source_description}'from accept338 where k='preparation'),'Le texte libre signé reste en français.','user-authored source is preserved verbatim');
select is((select v#>>'{criteria,1,key}'from accept338 where k='preparation'),'VERIFY','criteria come from frozen governed checklist');
create function pg_temp.mission338(p_hash text,p_key text,p_deliverable text default'SIGNED_REPORT',p_criterion text default'VERIFY',p_owner uuid default'fd110000-0000-4000-8000-000000000002')returns jsonb language sql as $$select public.create_client_prepared_mission_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',p_hash,jsonb_build_array(jsonb_build_object('deliverable_key',p_deliverable,'due_at',(current_date+14)::text||'T12:00:00Z','owner_organization_id',p_owner,'criterion_keys',jsonb_build_array(p_criterion))),p_key)$$;
select throws_ok($$select pg_temp.mission338(repeat('0',64),'accept338-stale')$$,'40001','MISSION_CHECKLIST_CHANGED','stale checklist hash is refused before writing');
select throws_ok($$select pg_temp.mission338((select v->>'template_hash'from accept338 where k='preparation'),'accept338-invented-deliverable','INVENTED')$$,'22023','INVALID_MISSION_ASSIGNMENT_SCOPE','Client cannot invent a signed deliverable');
select throws_ok($$select pg_temp.mission338((select v->>'template_hash'from accept338 where k='preparation'),'accept338-invented-criterion','SIGNED_REPORT','INVENTED')$$,'22023','MISSION_CRITERION_OUTSIDE_CHECKLIST','Client cannot invent checklist criterion');
select throws_ok($$select pg_temp.mission338((select v->>'template_hash'from accept338 where k='preparation'),'accept338-foreign-owner','SIGNED_REPORT','VERIFY','fd110000-0000-4000-8000-000000000003')$$,'22023','INVALID_MISSION_ASSIGNMENT_SCOPE','responsibility cannot be assigned outside contract parties');
insert into accept338 values('mission',pg_temp.mission338((select v->>'template_hash'from accept338 where k='preparation'),'accept338-mission'));
insert into accept338 values('mission-replay',pg_temp.mission338((select v->>'template_hash'from accept338 where k='preparation'),'accept338-mission'));
select is((select v from accept338 where k='mission'),(select v from accept338 where k='mission-replay'),'mission replay has exact stable response');
reset role;
select is((select count(*)::integer from public.missions where contract_id='fd210000-0000-4000-8000-000000000001'),1,'native mission command creates only one mission');
select ok(exists(select 1 from public.deliverables d join public.mission_milestones m on m.id=d.milestone_id and m.mission_id=d.mission_id where d.mission_id=(select(v->>'mission_id')::uuid from accept338 where k='mission')and d.deliverable_key='SIGNED_REPORT'and d.label_fr='Rapport contractuel figé'and m.owner_organization_id='fd110000-0000-4000-8000-000000000002'),'real mission preserves signed label, party responsibility and own milestone link');
select is((select criterion_key from public.acceptance_checklists where mission_id=(select(v->>'mission_id')::uuid from accept338 where k='mission')),'VERIFY','actual acceptance uses chosen governed criterion');
select is((select items from public.mission_checklist_snapshots where mission_id=(select(v->>'mission_id')::uuid from accept338 where k='mission')),(select items from public.service_checklist_templates where id='fd130000-0000-4000-8000-000000000001'),'mission freezes exact bilingual checklist items');
reset role;

-- A separate test audit organization keeps fiscal reviewers independent from both
-- contract parties and uses the actual versioned tax approval commands.
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{}',true);
insert into public.organizations(id,legal_name,display_name,status,created_by)values('f347a000-0000-4000-8000-000000000001','TEST347 Audit','TEST347 Audit','ACTIVE','fd100000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status)values('f347a100-0000-4000-8000-000000000001','f347a000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000004','ACTIVE'),('f347a100-0000-4000-8000-000000000002','f347a000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000005','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('f347a100-0000-4000-8000-000000000001','CLIENT_OWNER'),('f347a100-0000-4000-8000-000000000002','CLIENT_OWNER');
create temporary table monthly347(k text primary key,v jsonb);grant select,insert on monthly347 to authenticated,service_role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
do $$declare t record;begin for t in select id,row_version from public.tax_rule_versions where jurisdiction_code='MA'and category_code='PROVIDER_COMMISSION'and status='ACTIVE'loop perform public.decide_morocco_tax_rule('f347a000-0000-4000-8000-000000000001',t.id,'RETIRE','DEMO','TEST347-NOT-A-REAL-TAX-APPROVAL','TEST ONLY replace the demo tax version transactionally',t.row_version,'test347-retire-'||t.id);end loop;end$$;
insert into monthly347 values('tax',public.propose_morocco_tax_rule('f347a000-0000-4000-8000-000000000001','PROVIDER_COMMISSION','VAT',2000,100,'{"environment_class":"NON_PRODUCTION_DEMO"}','TEST ONLY synthetic fiscal rule, not professional advice',current_date-90,null,'TEST ONLY native tax approval prerequisite','test347-propose-tax'));
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_morocco_tax_rule('f347a000-0000-4000-8000-000000000001',(v->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST ONLY ROLLBACK validation reference','TEST ONLY independent synthetic fiscal validation',1,'test347-approve-tax')from monthly347 where k='tax';
reset role;
-- Three independent files/receipts from the same completed contractual source.
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
do $$declare n integer;r jsonb;begin for n in 1..3 loop r:=public.begin_provider_receipt_proof_upload('fd110000-0000-4000-8000-000000000002','TEST347-receipt-'||n||'.pdf','application/pdf',20,encode(extensions.digest('TEST347 receipt '||n,'sha256'),'hex'),'test347-upload-receipt-'||n);insert into monthly347 values('upload-'||n,r);end loop;end$$;
reset role;
insert into storage.objects(bucket_id,name,metadata)select 'provider-qualification',v->>'storage_object_path','{"mimetype":"application/pdf","size":20}'from monthly347 where k like'upload-%';
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
do $$declare n integer;begin for n in 1..3 loop perform public.record_provider_payment_proof_scan_result((select(v->>'upload_id')::uuid from monthly347 where k='upload-'||n),'CLEAN','SQL_TEST_SCANNER','test-only',encode(extensions.digest('TEST347 receipt '||n,'sha256'),'hex'),'test347-scan-receipt-'||n);end loop;end$$;
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
do $$declare n integer;r jsonb;begin for n in 1..3 loop
 r:=public.save_my_provider_billing_intent('fd110000-0000-4000-8000-000000000002','PAYABLE',jsonb_build_object('missionId',(select v->>'mission_id'from accept338 where k='mission'),'eventType','CLIENT_RECEIPT_CONFIRMED','paymentMethod','BANK_TRANSFER','occurredOn',(current_date-40)::text,'currency','MAD','grossAmountMinor','10000','clientReceiptReference','TEST347-RECEIPT-'||n,'proofHash',encode(extensions.digest('TEST347 receipt '||n,'sha256'),'hex')),('f347f000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
 insert into monthly347 values('declaration-'||n,public.finalize_my_provider_billing_intent((r->>'intent_id')::uuid));
 end loop;end$$;
select is((select count(*)from public.provider_payable_events where provider_organization_id='fd110000-0000-4000-8000-000000000002'),0::bigint,'Provider receipt declarations do not accrue unconfirmed commission');
reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f347dd00-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','test347-conflicted-member@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('f347dd10-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','f347dd00-0000-4000-8000-000000000001','ACTIVE'),('f347dd10-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000002','f347dd00-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('f347dd10-0000-4000-8000-000000000001','CLIENT_OWNER'),('f347dd10-0000-4000-8000-000000000002','PROVIDER_ACCOUNTING'),('fd120000-0000-4000-8000-000000000001','PROVIDER_OWNER');
select set_config('request.jwt.claim.sub','f347dd00-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"f347dd00-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select ok((select bool_and(not(x->>'can_client_confirm')::boolean)from jsonb_array_elements(public.get_client_provider_receipts_v1('fd110000-0000-4000-8000-000000000001')->'declarations')x),'Client projection explicitly refuses confirmation by another Provider member');
select throws_ok($$select public.confirm_provider_receipt_declaration_v1((select(v->>'declaration_id')::uuid from monthly347 where k='declaration-1'),true,'TEST ONLY conflicted cross-party confirmer')$$,'42501','CLIENT_RECEIPT_CONFIRMATION_DENIED','another Provider member with Client role cannot auto-confirm the counterparty receipt');
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_reminders_v1(100);
reset role;
select is((select count(*)from public.notification_instances where recipient_user_id='f347dd00-0000-4000-8000-000000000001'and deduplication_key like'provider-receipt-confirm:%'),0::bigint,'receipt reminders never solicit a conflicted Provider member');
select is((select count(*)from public.notification_instances where recipient_user_id='fd100000-0000-4000-8000-000000000001'and deduplication_key like'provider-receipt-confirm:%'),3::bigint,'receipt reminders target the genuine independent Client');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select is((select count(*)from jsonb_array_elements(public.get_client_provider_receipts_v1('fd110000-0000-4000-8000-000000000001')->'declarations')x where(x->>'can_client_confirm')::boolean),3::bigint,'legitimate Client gets the three scoped confirmable declarations');
select throws_ok($$select public.get_client_provider_receipts_v1('fd110000-0000-4000-8000-000000000002')$$,'42501','CLIENT_RECEIPTS_SCOPE_DENIED','Client receipt projection refuses a known foreign organization');
select public.confirm_provider_receipt_declaration_v1((v->>'declaration_id')::uuid,true,'TEST ONLY client confirms the actual receipt source')from monthly347 where k like'declaration-%';
select throws_ok($$select public.confirm_provider_receipt_declaration_v1((select(v->>'declaration_id')::uuid from monthly347 where k='declaration-1'),false,'Contradictory immutable Client decision')$$,'22000','DECISION_ALREADY_RECORDED','Client contradictory confirmation is a conflict');
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into monthly347 select replace(k,'declaration-','payable-'),public.review_provider_financial_declaration_v1((v->>'declaration_id')::uuid,true,'TEST ONLY independent Finance reviews receipt confirmation')from monthly347 where k like'declaration-%';
select is((select count(*)from public.provider_payable_events where provider_organization_id='fd110000-0000-4000-8000-000000000002'),3::bigint,'confirmed and independently reviewed receipts create exact accruals');
reset role;
insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values
('f347b000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','TEST347_AR','TEST ONLY receivable','ASSET','MAD'),
('f347b000-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000002','TEST347_REV','TEST ONLY revenue','REVENUE','MAD'),
('f347b000-0000-4000-8000-000000000003','fd110000-0000-4000-8000-000000000002','TEST347_TAX','TEST ONLY tax','LIABILITY','MAD');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into monthly347 values('recipient-context',public.get_provider_billing_recipient_review_context_v1('fd110000-0000-4000-8000-000000000002'));
insert into monthly347 values('recipient-review',public.request_provider_billing_recipient_review_v1('fd220000-0000-4000-8000-000000000001',repeat('c',64),'{"legal_name":"MF024 Provider","country_code":"MA","registered_address":"Synthetic provider fixture address","identifiers":{"ICE":"997104000000002","IF":"99710402","RC":"TEST-104-PROVIDER"}}',(select (doc->>'id')::uuid from monthly347 ctx cross join lateral jsonb_array_elements(ctx.v->'documents')doc where ctx.k='recipient-context'and doc->>'code'='ANCHOR_LEGAL'limit 1),'TEST ONLY historical recipient independently evidenced','f347d000-0000-4000-8000-000000000001'));
insert into monthly347 values('recipient-context-after',public.get_provider_billing_recipient_review_context_v1('fd110000-0000-4000-8000-000000000002'));
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_provider_billing_recipient_review_v1((select(v->>'review_id')::uuid from monthly347 where k='recipient-review'),(select review->>'content_hash'from monthly347 ctx cross join lateral jsonb_array_elements(ctx.v->'reviews')review where ctx.k='recipient-context-after'and review->>'id'=(select v->>'review_id'from monthly347 where k='recipient-review')),true,'TEST ONLY independent evidence-backed recipient confirmation');
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into monthly347 values('closing-policy',to_jsonb(public.propose_provider_closing_policy_v1('fd110000-0000-4000-8000-000000000002','MAD','f347b000-0000-4000-8000-000000000001','f347b000-0000-4000-8000-000000000002','f347b000-0000-4000-8000-000000000003',7,3,current_date,'TEST ONLY approved monthly rule')));
insert into monthly347 values('issuer',public.create_client_billing_policy_v1(jsonb_build_object('series_key','TEST347_PROVIDER_FISCAL','version',1,'currency','MAD','tax_rate_bps',2000,'tax_label_fr','TVA synthétique','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','TEST ONLY Issuer','legal_form','TEST','address','TEST ONLY synthetic issuer address','ice','997347000000001','if_number','99734701','rc_number','TEST347','contact_email','finance347@example.invalid'),'invoice_prefix','TEST347I','credit_prefix','TEST347C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-90)::text,'service_label_fr','Commission de recette uniquement','service_label_ar','عمولة اختبار فقط','approval_reference','TEST ONLY NOT REAL LEGAL APPROVAL'),'test347-create-issuer'));
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_provider_closing_policy_v1((v#>>'{}')::uuid,true,'TEST ONLY independent monthly policy approval')from monthly347 where k='closing-policy';
select public.approve_client_billing_policy_v1((v->>'policy_id')::uuid,true,'TEST ONLY independent synthetic issuer approval','test347-approve-issuer')from monthly347 where k='issuer';
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
reset role;
select diag((select coalesce(jsonb_agg(jsonb_build_object('reason_code',reason_code,'source_id',source_id)),'[]')::text from public.provider_billing_exceptions_v1));
select is((select count(*)from public.provider_pre_statement_lines_v1 pl join public.provider_billing_periods_v1 p on p.id=pl.period_id where p.provider_organization_id='fd110000-0000-4000-8000-000000000002'),3::bigint,'monthly scheduler freezes every eligible commission line');
select is((select count(*)from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002'),0::bigint,'contradictory window precedes invoice emission');
-- Historical immutable period fixture models an elapsed window, with the exact
-- native snapshots generated above. No clock or trigger is altered.
insert into public.provider_billing_periods_v1(id,policy_id,provider_organization_id,currency,period_end,generated_at,dispute_until)select 'f347c000-0000-4000-8000-000000000001',(v#>>'{}')::uuid,'fd110000-0000-4000-8000-000000000002','MAD',(date_trunc('month',current_date)::date-interval'1 month')::date-1,clock_timestamp()-interval'10 days',clock_timestamp()-interval'7 days'from monthly347 where k='closing-policy';
insert into public.provider_pre_statement_lines_v1(period_id,payable_event_id,source_snapshot)select 'f347c000-0000-4000-8000-000000000001',pl.payable_event_id,pl.source_snapshot from public.provider_pre_statement_lines_v1 pl join public.provider_billing_periods_v1 p on p.id=pl.period_id where p.provider_organization_id='fd110000-0000-4000-8000-000000000002'and p.id<>'f347c000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.dispute_provider_billing_line_v1((select id from public.provider_billing_periods_v1 where provider_organization_id='fd110000-0000-4000-8000-000000000002'and id<>'f347c000-0000-4000-8000-000000000001'),(select(v->>'payable_event_id')::uuid from monthly347 where k='payable-2'),'TEST ONLY line-specific commission dispute');
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.issue_provider_statement('fd110000-0000-4000-8000-000000000002','BYPASS-WINDOW',current_date-60,current_date,'MAD','test347-manual-statement')$$,'42501',null,'independent Finance cannot bypass a contested period through a legacy statement ABI');
select ok(not has_function_privilege('authenticated','public.issue_provider_grouped_statements_v1(uuid,text,date,date,character,text,uuid,uuid)','EXECUTE'),'grouped ordinary issuance is not an alternate runtime authority');
select throws_ok($$select public.issue_provider_grouped_statements_v1('fd110000-0000-4000-8000-000000000002','BYPASS-GROUPED',current_date-60,current_date,'MAD',repeat('f',64),'f347fc00-0000-4000-8000-000000000001')$$,'42501',null,'independent Finance cannot bypass a contested period with grouped statements');
select throws_ok($$select public.issue_provider_invoice(null,'AUTO',current_date,current_date+7,'f347b000-0000-4000-8000-000000000001','f347b000-0000-4000-8000-000000000002','f347b000-0000-4000-8000-000000000003','test347-manual-invoice')$$,'42501',null,'legacy invoice ABI cannot manufacture a contradictory-period invoice');
select public.resolve_provider_billing_line_v1(id,false,'TEST ONLY independently upheld line contestation')from public.provider_billing_line_disputes_v1 where payable_event_id=(select(v->>'payable_event_id')::uuid from monthly347 where k='payable-2');
select public.resolve_provider_billing_line_v1(id,false,'Same persisted resolution replay')from public.provider_billing_line_disputes_v1 where payable_event_id=(select(v->>'payable_event_id')::uuid from monthly347 where k='payable-2');
select throws_ok($$select public.resolve_provider_billing_line_v1(id,true,'Contradictory immutable resolution')from public.provider_billing_line_disputes_v1 where payable_event_id=(select(v->>'payable_event_id')::uuid from monthly347 where k='payable-2')$$,'22000','DECISION_ALREADY_RECORDED','opposite line decision cannot report a false success');
select is((select count(*)from public.audit_events where action='provider.billing.dispute.resolved'),1::bigint,'resolution replay and conflict create no false additional audit');
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
select public.run_provider_billing_scheduler_v1(100);
reset role;

select is((select count(*)from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002'),1::bigint,'elapsed clean lines produce exactly one invoice on repeated scheduler calls');
select is((select count(*)from public.provider_statement_lines l join public.provider_statements s on s.id=l.statement_id where s.provider_organization_id='fd110000-0000-4000-8000-000000000002'),2::bigint,'contested line is carried while two clean lines close');
select ok(not exists(select 1 from public.provider_statement_lines where payable_event_id=(select(v->>'payable_event_id')::uuid from monthly347 where k='payable-2')),'line-specific dispute never enters an issued statement');
select ok((select bool_and(due_on=issued_on+7)from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002'),'approved standard payment deadline is seven calendar days');
select is((select count(*)from public.provider_billing_source_policy_bindings where provider_organization_id='fd110000-0000-4000-8000-000000000002'),2::bigint,'official statement and invoice each retain their frozen approved issuer binding');
select ok((select sum(case direction when'DEBIT'then amount_minor else-amount_minor end)=0 from public.financial_entries where organization_id='fd110000-0000-4000-8000-000000000002'),'automated invoices remain exactly double-entry balanced');

-- Finality bridge: upstream immutable adjudications are synthetic rollback-only
-- fixtures. The service bridge and Finance credit command execute natively.
-- The invoice already has its approved issuer/fiscal binding. A composite role
-- cannot use an adjustment to erase its own Provider debt.
insert into public.platform_user_roles(user_id,role_code)values('fd100000-0000-4000-8000-000000000002','FINANCE_MANAGER');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.issue_provider_credit_note(id,'AUTO',current_date,100,999999,'Attempt to erase own Provider debt','test347-self-credit')from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002'$$,'42501','PROVIDER_CREDIT_NOTE_DENIED','ProviderOwner plus Finance cannot issue its own credit');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
insert into monthly347 select'canonical-credit',public.issue_provider_credit_note(id,'AUTO',current_date,100,999999,'Independent canonical fiscal credit','test347-independent-credit')from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002';
select is((select public.issue_provider_credit_note(id,'AUTO',current_date,100,123456,'Independent canonical fiscal credit','test347-independent-credit')from public.provider_invoices where provider_organization_id='fd110000-0000-4000-8000-000000000002'),(select v from monthly347 where k='canonical-credit'),'retained advisory tax argument never overrides the canonical fiscal receipt');
reset role;
select is((select tax_minor from public.provider_credit_notes where id=(select(v->>'credit_note_id')::uuid from monthly347 where k='canonical-credit')),20::bigint,'credit VAT is computed from the original approved invoice, never the posted override');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
do $$declare t record;begin for t in select id,row_version from public.tax_rule_versions where jurisdiction_code='MA'and category_code='PENALTY'and status='ACTIVE'loop perform public.decide_morocco_tax_rule('f347a000-0000-4000-8000-000000000001',t.id,'RETIRE','DEMO','TEST347-PENALTY','TEST ONLY replace the penalty tax version',t.row_version,'test347-retire-penalty-'||t.id);end loop;end$$;
insert into monthly347 values('penalty-tax',public.propose_morocco_tax_rule('f347a000-0000-4000-8000-000000000001','PENALTY','OUT_OF_SCOPE',0,100,'{"environment_class":"NON_PRODUCTION_DEMO"}','TEST ONLY penalty fiscal treatment, never a production assertion',current_date-90,null,'TEST ONLY distinct penalty category prerequisite','test347-propose-penalty'));
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_morocco_tax_rule('f347a000-0000-4000-8000-000000000001',(v->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST ONLY penalty approval','TEST ONLY independently checked penalty tax',1,'test347-approve-penalty')from monthly347 where k='penalty-tax';
reset role;
insert into public.dispute_cases(id,mission_id,contract_id,contract_version_id,client_organization_id,provider_organization_id,obligation_key,description,urgency,status,policy_snapshot,response_due_at,appeal_due_at,opened_by)
select ('f347e000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,(select(v->>'mission_id')::uuid from accept338 where k='mission'),'fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','SIGNED_REPORT','TEST ONLY historical decision finality fixture','STANDARD',case when n=1 then'APPEALED'else'DECIDED'end,jsonb_build_object('version','TEST347','content_hash',repeat('e',64),'response_hours',48,'urgent_response_hours',24,'correction_business_days',5,'review_business_days',2,'appeal_hours',72),clock_timestamp()-interval'50 days',case when n=2 then clock_timestamp()+interval'2 days'else clock_timestamp()-interval'30 days'end,'fd100000-0000-4000-8000-000000000001'from generate_series(1,6)n;
insert into public.dispute_evidence(id,dispute_case_id,submitted_by_user_id,submitted_by_organization_id,evidence_type,statement,evidence_hash,visibility)
select ('f347e100-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f347e000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fd100000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','MESSAGE','TEST ONLY historical evidence record',repeat('e',64),'BOTH_PARTIES'from generate_series(1,6)n;
insert into public.dispute_decisions(id,dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,decided_by,decided_at)
select ('f347e200-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f347e000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1,'NON_COMPLIANT_CONFIRMED','TEST ONLY immutable upstream adjudication',array[('f347e100-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid],jsonb_build_object('version','TEST347','content_hash',repeat('e',64),'currency','MAD','validated_clause',true,'penalty_minor','700','commission_minor','500'),'fd100000-0000-4000-8000-000000000004',clock_timestamp()-interval'80 days'from generate_series(1,6)n;
insert into public.dispute_financial_consequences(id,dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,beneficiary_organization_id,rule_snapshot,created_at)
select ('f347e300-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f347e000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f347e200-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=6 then'CONTRACTUAL_PENALTY'else'MATRICIA_COMMISSION'end,'ACCRUAL',case when n in(5,6)then 700 else 500 end,'MAD','fd110000-0000-4000-8000-000000000002',case when n=6 then'fd110000-0000-4000-8000-000000000001'::uuid end,jsonb_build_object('version','TEST347','content_hash',repeat('e',64),'validated_clause',true),clock_timestamp()-case when n=6 then interval'2 days'else interval'1 day'end from generate_series(1,6)n;
insert into public.dispute_decisions(id,dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,supersedes_decision_id,decided_by)
values('f347e400-0000-4000-8000-000000000003','f347e000-0000-4000-8000-000000000003',2,'COMPLIANT','TEST ONLY reversed before financial accrual',array['f347e100-0000-4000-8000-000000000003'::uuid],jsonb_build_object('version','TEST347','content_hash',repeat('e',64)),'f347e200-0000-4000-8000-000000000003','fd100000-0000-4000-8000-000000000004');
insert into public.dispute_financial_consequences(id,dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,rule_snapshot,reverses_consequence_id)
values('f347e500-0000-4000-8000-000000000003','f347e000-0000-4000-8000-000000000003','f347e400-0000-4000-8000-000000000003','MATRICIA_COMMISSION','REVERSAL',500,'MAD','fd110000-0000-4000-8000-000000000002','{}','f347e300-0000-4000-8000-000000000003');
-- Historical alternative-version fixture only, without a new signature claim.
-- The open dispute remains frozen on its original verified V1.
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
select 'f347ca00-0000-4000-8000-000000000002',contract_id,2,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot||jsonb_build_object('commission_basis_points',2000),repeat('a',64),'TEST ONLY alternative historical contract version',created_by from public.contract_versions where id='fd220000-0000-4000-8000-000000000001';
update public.missions set contract_version_id='f347ca00-0000-4000-8000-000000000002'where id=(select(v->>'mission_id')::uuid from accept338 where k='mission');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(1);
select public.run_provider_billing_scheduler_v1(1);
reset role;
select is((select count(*)from public.provider_dispute_payable_sources_v1),1::bigint,'bounded ingestion reaches a clean Matricia commission after an older Client penalty exception');
select ok(exists(select 1 from public.provider_billing_exceptions_v1 where source_id='f347e300-0000-4000-8000-000000000006'and reason_code='CLIENT_BENEFICIARY_COLLECTION_MANDATE_REQUIRED'),'first bounded ingestion preserves the Client penalty as an explicit exception');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
reset role;
select is((select count(*)from public.provider_dispute_payable_sources_v1),2::bigint,'only final non-reversed consequences accrue once; open appeal and deadline are excluded');
select ok((select bool_and(contract_version_id='fd220000-0000-4000-8000-000000000001'::uuid)from public.provider_payable_events where id in(select payable_event_id from public.provider_dispute_payable_sources_v1)),'dispute payables retain their original V1 even when mission now references V2');
select ok(not exists(select 1 from public.provider_dispute_payable_sources_v1 where consequence_id='f347e300-0000-4000-8000-000000000006'),'Client-beneficiary penalty is never booked as Matricia income');
select ok(exists(select 1 from public.provider_billing_exceptions_v1 where source_id='f347e300-0000-4000-8000-000000000006'and reason_code='CLIENT_BENEFICIARY_COLLECTION_MANDATE_REQUIRED'),'Client penalty requires its own approved collection mandate');
-- Reverse one accrued commission before its historical period closes.
insert into public.dispute_decisions(id,dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,supersedes_decision_id,decided_by)
values('f347e400-0000-4000-8000-000000000004','f347e000-0000-4000-8000-000000000004',2,'COMPLIANT','TEST ONLY reversed after accrual before invoice',array['f347e100-0000-4000-8000-000000000004'::uuid],jsonb_build_object('version','TEST347','content_hash',repeat('e',64)),'f347e200-0000-4000-8000-000000000004','fd100000-0000-4000-8000-000000000004');
insert into public.dispute_financial_consequences(id,dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,rule_snapshot,reverses_consequence_id)
values('f347e500-0000-4000-8000-000000000004','f347e000-0000-4000-8000-000000000004','f347e400-0000-4000-8000-000000000004','MATRICIA_COMMISSION','REVERSAL',500,'MAD','fd110000-0000-4000-8000-000000000002','{}','f347e300-0000-4000-8000-000000000004');
insert into public.provider_billing_periods_v1(id,policy_id,provider_organization_id,currency,period_end,generated_at,dispute_until)select 'f347c000-0000-4000-8000-000000000002',(v#>>'{}')::uuid,'fd110000-0000-4000-8000-000000000002','MAD',(date_trunc('month',current_date)::date-interval'2 months')::date-1,clock_timestamp()-interval'10 days',clock_timestamp()-interval'7 days'from monthly347 where k='closing-policy';
insert into public.provider_pre_statement_lines_v1(period_id,payable_event_id,source_snapshot)select 'f347c000-0000-4000-8000-000000000002',e.id,to_jsonb(e)||jsonb_build_object('gross_amount_minor',e.gross_amount_minor::text,'commission_amount_minor',e.commission_amount_minor::text,'tax_amount_minor',e.tax_amount_minor::text,'total_due_minor',e.total_due_minor::text)from public.provider_dispute_payable_sources_v1 s join public.provider_payable_events e on e.id=s.payable_event_id;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
reset role;
select ok(not exists(select 1 from public.provider_statement_lines l join public.provider_dispute_payable_sources_v1 s on s.payable_event_id=l.payable_event_id where s.consequence_id='f347e300-0000-4000-8000-000000000004'),'reversal after accrual is excluded before invoice');
select is((select i.total_minor from public.provider_invoices i join public.provider_statement_lines l on l.statement_id=i.statement_id join public.provider_dispute_payable_sources_v1 s on s.payable_event_id=l.payable_event_id where s.consequence_id='f347e300-0000-4000-8000-000000000005'),840::bigint,'only the final Matricia commission is invoiced with its approved VAT');
-- A later reversal requests a separate credit, retaining the original invoice.
insert into public.dispute_decisions(id,dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,supersedes_decision_id,decided_by)
values('f347e400-0000-4000-8000-000000000005','f347e000-0000-4000-8000-000000000005',2,'COMPLIANT','TEST ONLY reversal after immutable invoice issue',array['f347e100-0000-4000-8000-000000000005'::uuid],jsonb_build_object('version','TEST347','content_hash',repeat('e',64)),'f347e200-0000-4000-8000-000000000005','fd100000-0000-4000-8000-000000000004');
insert into public.dispute_financial_consequences(id,dispute_case_id,decision_id,consequence_type,direction,amount_minor,currency,payable_organization_id,rule_snapshot,reverses_consequence_id)
values('f347e500-0000-4000-8000-000000000005','f347e000-0000-4000-8000-000000000005','f347e400-0000-4000-8000-000000000005','MATRICIA_COMMISSION','REVERSAL',700,'MAD','fd110000-0000-4000-8000-000000000002','{}','f347e300-0000-4000-8000-000000000005');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
reset role;
select ok(exists(select 1 from public.provider_billing_exceptions_v1 where source_id='f347e500-0000-4000-8000-000000000005'and reason_code='DISPUTE_REVERSAL_CREDIT_NOTE_REQUIRED'),'post-issue reversal opens an explicit credit-note exception');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.issue_provider_dispute_reversal_credit_v1('f347e500-0000-4000-8000-000000000005','TEST ONLY self credit is forbidden','test347-reversal-credit')$$,'42501','REVERSAL_CREDIT_DENIED','decision author cannot validate its own financial credit');
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into monthly347 values('reversal-credit',public.issue_provider_dispute_reversal_credit_v1('f347e500-0000-4000-8000-000000000005','TEST ONLY independently approved financial reversal','test347-reversal-credit'));
select is(public.issue_provider_dispute_reversal_credit_v1('f347e500-0000-4000-8000-000000000005','TEST ONLY independently approved financial reversal','test347-reversal-credit')->>'credit_note_id',(select v->>'credit_note_id'from monthly347 where k='reversal-credit'),'credit-note replay creates one immutable correcting document');
reset role;
select is((select total_minor from public.provider_credit_notes where id=(select(v->>'credit_note_id')::uuid from monthly347 where k='reversal-credit')),840::bigint,'correcting credit uses the exact original commission amount and tax');
select is((select i.total_minor from public.provider_invoices i join public.provider_statement_lines l on l.statement_id=i.statement_id join public.provider_dispute_payable_sources_v1 s on s.payable_event_id=l.payable_event_id where s.consequence_id='f347e300-0000-4000-8000-000000000005'),840::bigint,'issued invoice is never rewritten by reversal');


-- Historical receipt admission has the same separation of parties as new declarations.
insert into public.organization_memberships(id,organization_id,user_id,status)values('f347ee10-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000005','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('f347ee10-0000-4000-8000-000000000001','CLIENT_OWNER');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.admit_provider_payable_v1((select(v->>'payable_event_id')::uuid from monthly347 where k='payable-1'),'TEST ONLY conflicted legacy Client Finance review')$$,'42501','INDEPENDENT_FINANCE_REVIEW_REQUIRED','legacy admission excludes Finance who belongs to the Client party');
reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f347ee00-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','test347-independent-legacy-review@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f347ee00-0000-4000-8000-000000000001','FINANCE_MANAGER');
insert into public.organization_memberships(id,organization_id,user_id,status)values('f347ee10-0000-4000-8000-000000000002','f347a000-0000-4000-8000-000000000001','f347ee00-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('f347ee10-0000-4000-8000-000000000002','CLIENT_OWNER');
select set_config('request.jwt.claim.sub','f347ee00-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"f347ee00-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select is(public.admit_provider_payable_v1((select(v->>'payable_event_id')::uuid from monthly347 where k='payable-1'),'TEST ONLY independent admission with CLEAN proof')->>'outcome','PROVIDER_PAYABLE_ADMITTED','outside Finance may review while membership in an unrelated audit organization remains allowed');
reset role;
set constraints all immediate;

-- TEST ONLY reproduction F12 on an actually signed contract without an economic clause.
reset role;
insert into public.dispute_cases(id,mission_id,contract_id,contract_version_id,client_organization_id,provider_organization_id,obligation_key,description,urgency,status,policy_snapshot,response_due_at,appeal_due_at,opened_by)
select 'f355e000-0000-4000-8000-000000000001',mission_id,contract_id,contract_version_id,client_organization_id,provider_organization_id,'UNAPPROVED_ECONOMIC_CLAUSE','TEST ONLY economic authority reproduction','STANDARD','MEDIATION_REVIEW',policy_snapshot,clock_timestamp()-interval'3 days',clock_timestamp()-interval'1 day',opened_by from public.dispute_cases where id='f347e000-0000-4000-8000-000000000001';
insert into public.dispute_evidence(id,dispute_case_id,submitted_by_user_id,submitted_by_organization_id,evidence_type,statement,evidence_hash,visibility)values('f355e100-0000-4000-8000-000000000001','f355e000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','MESSAGE','TEST ONLY economic proof',repeat('a',64),'BOTH_PARTIES');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_mission_dispute('f355e000-0000-4000-8000-000000000001','NON_COMPLIANT_CONFIRMED','TEST ONLY forged economics to reproduce defect',array['f355e100-0000-4000-8000-000000000001'::uuid],jsonb_build_object('version','CALLER-UNAPPROVED','content_hash',repeat('f',64),'currency','MAD','penalty_minor','87654','commission_minor','98765','validated_clause',true),'test355-unapproved-economics');
reset role;
update public.dispute_cases set appeal_due_at=clock_timestamp()-interval'1 day'where id='f355e000-0000-4000-8000-000000000001';
select is((select sum(amount_minor)from public.dispute_financial_consequences where dispute_case_id='f355e000-0000-4000-8000-000000000001'),186419::numeric,'REPRODUCED F12: caller amounts become immutable consequences without approved economic clause');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select public.run_provider_billing_scheduler_v1(100);
reset role;
select is((select e.commission_amount_minor from public.provider_payable_events e join public.provider_dispute_payable_sources_v1 source on source.payable_event_id=e.id join public.dispute_financial_consequences c on c.id=source.consequence_id where c.dispute_case_id='f355e000-0000-4000-8000-000000000001'),98765::bigint,'REPRODUCED F12: bridge accepts the unapproved caller commission as a payable');

select*from finish();
rollback;
