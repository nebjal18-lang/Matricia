begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
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
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at)values('fd510000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000001','TEST.0104.V1','PUBLISHED',repeat('e',64),repeat('f',64),'fd100000-0000-4000-8000-000000000004','{"kind":"PUBLIC"}',now()-interval'1 day',now()-interval'1 day');
update public.catalog_libraries set current_release_id='fd510000-0000-4000-8000-000000000001'where id='fd300000-0000-4000-8000-000000000001';
insert into public.questionnaires(id,library_id,code,status,created_by)values('fd510000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001','SESSION_ENGINE','DRAFT','fd100000-0000-4000-8000-000000000004');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by)values('fd510000-0000-4000-8000-000000000003','fd510000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000001',1,'DRAFT','Session reproductible','جلسة قابلة للتكرار','Validation finale versionnée','تحقق نهائي بإصدار','PROVIDER','2.0.0','P06-SESSIONS-1',repeat('0',64),'APPROVED','fd100000-0000-4000-8000-000000000004',now(),repeat('c',64),1,'Sessions versionnées','fd100000-0000-4000-8000-000000000004');
insert into public.questionnaire_sections(id,questionnaire_version_id,section_key,label_fr,label_ar,sort_order,content_hash)values('fd510000-0000-4000-8000-000000000005','fd510000-0000-4000-8000-000000000003','GENERAL','Général','عام',1,repeat('d',64));
insert into public.question_bank_questions(id,library_id,question_key,scope,status,created_by)values
('fd510000-0000-4000-8000-000000000006','fd300000-0000-4000-8000-000000000001','HAS_POLICY','LIBRARY','DRAFT','fd100000-0000-4000-8000-000000000004'),
('fd510000-0000-4000-8000-000000000007','fd300000-0000-4000-8000-000000000001','POLICY_DETAIL','LIBRARY','DRAFT','fd100000-0000-4000-8000-000000000004');
insert into public.question_versions(id,question_id,library_id,source_service_id,version,status,label_fr,label_ar,answer_type,data_key,required_by_default,sensitivity,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,weight,maximum_score,content_hash,change_reason,created_by,published_at)values
('fd510000-0000-4000-8000-000000000008','fd510000-0000-4000-8000-000000000006','fd300000-0000-4000-8000-000000000001',null,1,'PUBLISHED','Avez-vous une politique ?','هل لديكم سياسة؟','YES_NO','session.has_policy',true,'BUSINESS','APPROVED','fd100000-0000-4000-8000-000000000004',now(),repeat('e',64),1,1,1,repeat('1',64),'Question session','fd100000-0000-4000-8000-000000000004',now()),
('fd510000-0000-4000-8000-000000000009','fd510000-0000-4000-8000-000000000007','fd300000-0000-4000-8000-000000000001','fd300000-0000-4000-8000-000000000007',1,'PUBLISHED','Décrivez la politique','صف السياسة','SHORT_TEXT','session.policy_detail',true,'CONFIDENTIAL','APPROVED','fd100000-0000-4000-8000-000000000004',now(),repeat('f',64),1,1,1,repeat('2',64),'Question session','fd100000-0000-4000-8000-000000000004',now());
update public.question_bank_questions set status='PUBLISHED',current_published_version_id=case when question_key='HAS_POLICY'then'fd510000-0000-4000-8000-000000000008'::uuid else'fd510000-0000-4000-8000-000000000009'::uuid end where library_id='fd300000-0000-4000-8000-000000000001';
insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order)values
('fd510000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000005','fd510000-0000-4000-8000-000000000008',1),
('fd510000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000005','fd510000-0000-4000-8000-000000000009',2);
insert into public.question_rules(id,library_id,rule_key,status,created_by)values
('fd510000-0000-4000-8000-000000000010','fd300000-0000-4000-8000-000000000001','HIDE_DETAIL','DRAFT','fd100000-0000-4000-8000-000000000004'),
('fd510000-0000-4000-8000-000000000011','fd300000-0000-4000-8000-000000000001','POLICY_SCORE','DRAFT','fd100000-0000-4000-8000-000000000004');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,compiled_hash,change_reason,created_by,published_at)values
('fd510000-0000-4000-8000-000000000012','fd510000-0000-4000-8000-000000000010','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"fd510000-0000-4000-8000-000000000008","value":false}','[{"type":"HIDE","target":"fd510000-0000-4000-8000-000000000009"}]','{"fd510000-0000-4000-8000-000000000008":[]}',10,repeat('3',64),'Masquage conditionnel','fd100000-0000-4000-8000-000000000004',now()),
('fd510000-0000-4000-8000-000000000013','fd510000-0000-4000-8000-000000000011','fd300000-0000-4000-8000-000000000001',1,'PUBLISHED','{"operator":"EQ","question_version_id":"fd510000-0000-4000-8000-000000000008","value":true}','[{"type":"SCORE","dimension":"GLOBAL","delta_basis_points":8000}]','{"fd510000-0000-4000-8000-000000000008":[]}',20,repeat('4',64),'Scoring versionné','fd100000-0000-4000-8000-000000000004',now());
update public.question_rules set status='PUBLISHED',current_published_version_id=case when rule_key='HIDE_DETAIL'then'fd510000-0000-4000-8000-000000000012'::uuid else'fd510000-0000-4000-8000-000000000013'::uuid end where library_id='fd300000-0000-4000-8000-000000000001';
insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order)values
('fd510000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000012',10),
('fd510000-0000-4000-8000-000000000003','fd300000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000013',20);
update public.questionnaire_versions set snapshot_hash=private.compute_questionnaire_snapshot_hash(id,jsonb_build_object('questionnaire_id',questionnaire_id,'library_id',library_id,'release_id',catalog_release_id,'version',version,'title_fr',title_fr,'title_ar',title_ar,'description_fr',description_fr,'description_ar',description_ar,'audience',audience,'engine_version',engine_version,'policy_version',policy_version)),status='PUBLISHED',published_at=now(),row_version=row_version+1 where id='fd510000-0000-4000-8000-000000000003';
update public.questionnaires set status='PUBLISHED',current_published_version_id='fd510000-0000-4000-8000-000000000003',row_version=row_version+1 where id='fd510000-0000-4000-8000-000000000002';
do $$declare requested jsonb; started jsonb; submitted jsonb; reviewed jsonb;begin
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 requested:=public.request_provider_service('fd110000-0000-4000-8000-000000000002','fd300000-0000-4000-8000-000000000007','TEST-0104-service-request');
 started:=public.start_questionnaire_session('fd110000-0000-4000-8000-000000000002','fd510000-0000-4000-8000-000000000003','fr-MA',null,'TEST-0351-questionnaire-start','fd510000-0000-4000-8000-000000000014');
 perform public.autosave_questionnaire_answers((started->>'session_id')::uuid,1,'[{"question_version_id":"fd510000-0000-4000-8000-000000000008","value":true,"expected_answer_row_version":0},{"question_version_id":"fd510000-0000-4000-8000-000000000009","value":"Dossier de qualification synthétique déposé العربية.","expected_answer_row_version":0}]','TEST-0351-questionnaire-save','fd510000-0000-4000-8000-000000000014');
 submitted:=public.submit_questionnaire_session((started->>'session_id')::uuid,2,'TEST-0351-questionnaire-submit','fd510000-0000-4000-8000-000000000014');
 if submitted->>'outcome'<>'QUESTIONNAIRE_SESSION_SUBMITTED'then raise exception 'TEST_QUESTIONNAIRE_SUBMISSION_FAILED';end if;
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 reviewed:=public.get_provider_qualification_questionnaire_review_v1((requested->>'qualification_id')::uuid,(started->>'session_id')::uuid);
 perform public.decide_provider_qualification((requested->>'qualification_id')::uuid,'APPROVED',(started->>'session_id')::uuid,8000,jsonb_build_array(jsonb_build_object('check','IDENTITY','passed',true),jsonb_build_object('check','HUMAN_EVIDENCE_REVIEW','passed',true,'review_context_hash',reviewed#>>'{selected,contextHash}')),'[]','TEST independent synthetic qualification','TEST-0104',clock_timestamp()+interval'1 year',1,'TEST-0104-qualification');
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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('fd100000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','accept339-provider-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('fd110000-0000-4000-8000-000000000006','C339 Provider B','C339 Provider B','ACTIVE','fd100000-0000-4000-8000-000000000006');
insert into public.organization_memberships(id,organization_id,user_id,status)values('fd120000-0000-4000-8000-000000000006','fd110000-0000-4000-8000-000000000006','fd100000-0000-4000-8000-000000000006','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fd120000-0000-4000-8000-000000000006','PROVIDER_OWNER');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('fd110000-0000-4000-8000-000000000006','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','fd100000-0000-4000-8000-000000000006');
insert into public.provider_match_profiles(provider_organization_id,region_codes)values('fd110000-0000-4000-8000-000000000006',array['CASABLANCA']);

select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select public.decide_provider_company('fd110000-0000-4000-8000-000000000006','VERIFIED','SIGNED',null,'TEST independent synthetic company review','TEST-ANCHOR',1,'TEST-0339-company-review-B');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fd110000-0000-4000-8000-000000000006','ICE','997104000000006'),('fd110000-0000-4000-8000-000000000006','IF','99710406'),('fd110000-0000-4000-8000-000000000006','RC','TEST-339-PROVIDER-B');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='fd100000-0000-4000-8000-000000000004';org uuid:='fd110000-0000-4000-8000-000000000006';begin
 foreach kind in array array['LEGAL','FISCAL','INSURANCE']loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  u:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',u->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  d:=public.record_provider_document_version(org,kind,'ANCHOR_'||kind,jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+365)::text,'storage_object_path',u->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic identity evidence for quote test','anchor-doc-b-'||kind);
  select id into job from public.provider_document_scan_jobs where document_version_id=(d->>'document_version_id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform public.record_provider_document_scan_result(job,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'anchor-scan-b-'||kind);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);perform public.review_provider_document((d->>'document_version_id')::uuid,'VERIFIED','Synthetic reviewer decision','TEST-ANCHOR','anchor-review-b-'||kind);
 end loop;
 context:=public.get_provider_identity_review_context_v1(org);
 perform public.revalidate_provider_identity_v1(org,(context->>'organization_row_version')::integer,(context->>'profile_row_version')::integer,context->>'identity_hash',(context->>'company_decision_id')::uuid,'Synthetic current identity review before publication',extensions.gen_random_uuid());
end$$;
do $$declare requested jsonb; started jsonb; submitted jsonb; reviewed jsonb;begin
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
 requested:=public.request_provider_service('fd110000-0000-4000-8000-000000000006','fd300000-0000-4000-8000-000000000007','TEST-0339-service-request-B');
 started:=public.start_questionnaire_session('fd110000-0000-4000-8000-000000000006','fd510000-0000-4000-8000-000000000003','fr-MA',null,'TEST-0339-B-questionnaire-start','fd510000-0000-4000-8000-000000000014');
 perform public.autosave_questionnaire_answers((started->>'session_id')::uuid,1,'[{"question_version_id":"fd510000-0000-4000-8000-000000000008","value":true,"expected_answer_row_version":0},{"question_version_id":"fd510000-0000-4000-8000-000000000009","value":"Dossier de qualification synthétique déposé العربية.","expected_answer_row_version":0}]','TEST-0339-B-questionnaire-save','fd510000-0000-4000-8000-000000000014');
 submitted:=public.submit_questionnaire_session((started->>'session_id')::uuid,2,'TEST-0339-B-questionnaire-submit','fd510000-0000-4000-8000-000000000014');
 if submitted->>'outcome'<>'QUESTIONNAIRE_SESSION_SUBMITTED'then raise exception 'TEST_QUESTIONNAIRE_SUBMISSION_FAILED';end if;
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
 reviewed:=public.get_provider_qualification_questionnaire_review_v1((requested->>'qualification_id')::uuid,(started->>'session_id')::uuid);
 perform public.decide_provider_qualification((requested->>'qualification_id')::uuid,'APPROVED',(started->>'session_id')::uuid,8000,jsonb_build_array(jsonb_build_object('check','IDENTITY','passed',true),jsonb_build_object('check','HUMAN_EVIDENCE_REVIEW','passed',true,'review_context_hash',reviewed#>>'{selected,contextHash}')),'[]','TEST independent synthetic qualification','TEST-0104',clock_timestamp()+interval'1 year',1,'TEST-0339-qualification-B');
 perform set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);
 perform set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
 perform public.declare_provider_capacity('fd110000-0000-4000-8000-000000000006','fd300000-0000-4000-8000-000000000007','AVAILABLE',5,2,'TEST provider capacity declaration','TEST-0339-capacity-B');
end$$;
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)values('fd171000-0000-4000-8000-000000000006','fd170000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000006',true,8500,'{}',30);
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)values('fd190000-0000-4000-8000-000000000006','fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000006','fd171000-0000-4000-8000-000000000006','ACCEPTED',clock_timestamp());
-- Exact test-only dated tax classification, approved independently for the
-- published source version. Values do not publish a real commercial offering.
insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values('ACCEPT339_SERVICE','Recette uniquement','اختبار فقط','Classification de recette','تصنيف اختبار','SERVICE','ACTIVE');
insert into public.tax_rule_versions(id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason)values('f3390000-0000-4000-8000-000000000001','MA','ACCEPT339_SERVICE',1,2000,current_date-1,'ACTIVE','VALIDATED','VAT',100,'{}','TEST ONLY, not a legal tax opinion','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fd100000-0000-4000-8000-000000000004',clock_timestamp(),'TEST-0339-TAX',repeat('9',64),'Synthetic rule for exact quote regression');
create temporary table accept339(k text primary key,v jsonb);grant select,insert on accept339 to authenticated;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into accept339 values('tax',public.propose_service_tax_category_mapping_v1('fd300000-0000-4000-8000-000000000009',repeat('7',64),private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','fd300000-0000-4000-8000-000000000009','MA','MAD'),'MA','MAD','ACCEPT339_SERVICE',(clock_timestamp()at time zone'Africa/Casablanca')::date,null,true,'{}','TEST ONLY mapping for exact quote sources',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((select(v->>'proposal_id')::uuid from accept339 where k='tax'),(select v->>'content_hash'from accept339 where k='tax'),true,'TEST-0339-MAPPING','TEST ONLY independent classification decision');
create function pg_temp.quote339(p_interval text,p_price text,p_terms text,p_key text,p_invitation uuid)returns jsonb language sql as $$select public.create_quote_revision(p_invitation,jsonb_build_object('expected_current_version_id',null,'currency','MAD','solution_fr','Solution de recette avec suivi récurrent','solution_ar','حل اختبار بمتابعة دورية','deliverables',jsonb_build_array('Rapport de recette contractuel'),'inclusions','[]'::jsonb,'exclusions',jsonb_build_array('Hébergement externe'),'prerequisites','[]'::jsonb,'warranty_fr','Garantie de recette distincte','warranty_ar','ضمان الاختبار','correction_terms_fr','Corrections sur anomalies prouvées','correction_terms_ar','تصحيح الأخطاء المثبتة','sla',jsonb_build_object('commercial_terms_v1',jsonb_build_object('source_locale','fr','payment_terms',p_terms,'maintenance_terms','Suivi de recette, texte du prestataire conservé.')),'proposed_start_date',(current_date+7)::text,'duration_days','10','valid_until',(clock_timestamp()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number',1,'item_kind','ONE_TIME','label_fr','Mise en place','label_ar','التهيئة','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','f3390000-0000-4000-8000-000000000001','recurrence_interval',''),jsonb_build_object('line_number',2,'item_kind','RECURRING','label_fr','Suivi de recette','label_ar','متابعة الاختبار','quantity','1','unit_code','FORFAIT','unit_price_minor',p_price,'tax_rule_version_id','f3390000-0000-4000-8000-000000000001','recurrence_interval',p_interval)),'options','[]'::jsonb),'Proposition native de recette uniquement',p_key)$$;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into accept339 values('quote-a',pg_temp.quote339('MONTH','1200','Acompte 30 %, solde à réception.','accept339-quote-a','fd190000-0000-4000-8000-000000000001'));
select public.submit_provider_quote_with_identity_v1((select(v->>'quote_id')::uuid from accept339 where k='quote-a'),(select(v->>'quote_version_id')::uuid from accept339 where k='quote-a'),public.get_my_provider_identity_status_v1('fd110000-0000-4000-8000-000000000002')->>'identity_hash','TEST Provider A registered address','accept339-submit-a');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
insert into accept339 values('quote-b',pg_temp.quote339('YEAR','14400','Paiement annuel à terme échu.','accept339-quote-b','fd190000-0000-4000-8000-000000000006'));
select public.submit_provider_quote_with_identity_v1((select(v->>'quote_id')::uuid from accept339 where k='quote-b'),(select(v->>'quote_version_id')::uuid from accept339 where k='quote-b'),public.get_my_provider_identity_status_v1('fd110000-0000-4000-8000-000000000006')->>'identity_hash','TEST Provider B registered address','accept339-submit-b');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into accept339 values('comparison',public.compare_quotes('fd150000-0000-4000-8000-000000000001','accept339-comparison'));
insert into accept339 values('comparison-replay',public.compare_quotes('fd150000-0000-4000-8000-000000000001','accept339-comparison'));
select is((select v from accept339 where k='comparison'),(select v from accept339 where k='comparison-replay'),'native comparison replay returns the same frozen snapshot');
select is((select(v->>'quote_count')::integer from accept339 where k='comparison'),2,'two real independently submitted Provider offers are compared');
select is((select total_minor::text from public.quote_versions where id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-a')),'13440','monthly offer total is server-computed exact minor units');
select is((select total_minor::text from public.quote_versions where id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-b')),'29280','annual offer total remains distinct and exact');
select is((select recurrence_interval from public.quote_items where quote_version_id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-a')and item_kind='RECURRING'),'MONTH','Client projection retains monthly recurrence');
select is((select recurrence_interval from public.quote_items where quote_version_id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-b')and item_kind='RECURRING'),'YEAR','Client projection retains annual recurrence');
select is((select sla#>>'{commercial_terms_v1,payment_terms}'from public.quote_versions where id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-a')),'Acompte 30 %, solde à réception.','Client projection preserves the first Provider payment terms verbatim');
select is((select sla#>>'{commercial_terms_v1,payment_terms}'from public.quote_versions where id=(select(v->>'quote_version_id')::uuid from accept339 where k='quote-b')),'Paiement annuel à terme échu.','Client projection preserves different second payment terms');
select is((select count(*)::integer from public.quote_comparison_snapshots),1,'idempotency writes only one immutable comparison');
select is((select count(*)::integer from public.quote_items),4,'Client RLS projection exposes every authorized line from both offers');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.quote_versions),1,'a Provider sees only their own offer');
select is((select count(*)::integer from public.quote_items),2,'Provider cannot read competitor recurring lines');
select is((select count(*)::integer from public.quote_comparison_snapshots),0,'Provider cannot read Client comparison snapshot');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.quote_versions),0,'foreign Client sees no offer version');
select is((select count(*)::integer from public.quote_items),0,'foreign Client sees no commercial line');
select throws_ok($$select public.compare_quotes('fd150000-0000-4000-8000-000000000001','accept339-foreign-compare')$$,'42501','QUOTE_CLIENT_SCOPE_DENIED','foreign Client cannot create a comparison');
reset role;
select is((select count(*)::integer from public.event_outbox where event_type='QuoteComparisonCreatedV1'),1,'comparison emits one durable event despite replay');
select *from finish();rollback;
