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
create temporary table accept338(k text primary key,v jsonb);grant select,insert on accept338 to authenticated;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
reset role;
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
select 'fd220000-0000-4000-8000-000000000001','fd210000-0000-4000-8000-000000000001',1,'fd200000-0000-4000-8000-000000000001',jsonb_build_object('service_version_id',service_version_id),jsonb_build_object('quote_version_id','fd200000-0000-4000-8000-000000000001'),(select p.data->'clauses'||jsonb_build_object('template_policy_version_id',p.id,'template_code',p.code,'template_version',p.version,'template_content_hash',p.content_hash,'approval_reference',p.approval_reference)from public.contract_policy_versions_v1 p where p.id=(select(v->>'policy_version_id')::uuid from accept338 where k='policy')),12000,'MAD','{}'::jsonb,repeat('c',64),'MF024 contract','fd100000-0000-4000-8000-000000000001' from mf024_catalog;
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
set local role authenticated;
create function pg_temp.dispute338(p_key text,p_doc uuid default'fd411000-0000-0000-0000-000000000001',p_obligation text default'SIGNED_REPORT')returns jsonb language sql as $$select public.open_client_contract_dispute_v1((select(v->>'mission_id')::uuid from accept338 where k='mission'),p_obligation,'Rapport contractuel manquant : constat de recette uniquement.','STANDARD',array[p_doc],'Pièce de test privée à examiner par les parties autorisées.','CLIENT_ONLY',p_key)$$;
select throws_ok($$select pg_temp.dispute338('accept338-unknown-obligation','fd411000-0000-0000-0000-000000000001','INVENTED')$$,'22023','DISPUTE_OBLIGATION_OUTSIDE_CONTRACT','dispute cannot invent an obligation');
select throws_ok($$select public.open_mission_dispute((select(v->>'mission_id')::uuid from accept338 where k='mission'),'SIGNED_REPORT','Rapport manquant pour recette uniquement.','STANDARD','{"response_hours":1}','[{"type":"MESSAGE","statement":"Message de recette","visibility":"CLIENT_ONLY"}]','accept338-spoof-policy')$$,'22023','DISPUTE_POLICY_FROM_CONTRACT_REQUIRED','Client cannot supply arbitrary dispute deadlines');
select throws_ok($$select pg_temp.dispute338('accept338-foreign-document','fd411000-0000-0000-0000-999999999999')$$,'42501','DISPUTE_DOCUMENT_NOT_REUSABLE','unknown or foreign document cannot become evidence');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.dispute338('accept338-aal1')$$,'42501','DISPUTE_OPEN_DENIED','AAL1 cannot open a financial/legal dispute');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into accept338 values('dispute',pg_temp.dispute338('accept338-open'));
insert into accept338 values('dispute-replay',pg_temp.dispute338('accept338-open'));
select is((select v from accept338 where k='dispute'),(select v from accept338 where k='dispute-replay'),'same real dispute is returned on replay');
select is((select count(*)::integer from public.dispute_cases),1,'replay creates no second case');
select is((select policy_snapshot->>'response_hours'from public.dispute_cases),'48','deadline comes from independently approved frozen contractual policy');
select is((select count(*)::integer from public.dispute_evidence),2,'one private statement and one canonical document are retained');
select is((select evidence_hash from public.dispute_evidence where evidence_type='DOCUMENT'),repeat('a',64),'document hash comes from canonical scanned source');
insert into accept338 select'attachment',public.authorize_client_dispute_attachment_v1(id)from public.dispute_evidence where evidence_type='DOCUMENT';
select is((select v->>'object_path'from accept338 where k='attachment'),'fd110000-0000-4000-8000-000000000001/client-a/registration.pdf','authorized owner receives original private object reference');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.dispute_evidence),0,'provider sees no CLIENT_ONLY evidence under actual RLS');
reset role;
select set_config('test.accept338_evidence',(select id::text from public.dispute_evidence where evidence_type='DOCUMENT'),true);
set local role authenticated;
select throws_ok($$select public.authorize_client_dispute_attachment_v1(current_setting('test.accept338_evidence')::uuid)$$,'42501','DISPUTE_EVIDENCE_DENIED','provider cannot request private download authorization');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.missions),0,'foreign tenant sees no mission');
select is((select count(*)::integer from public.dispute_cases),0,'foreign tenant sees no case');
select is((select count(*)::integer from public.dispute_evidence),0,'foreign tenant sees no evidence');
select throws_ok($$select public.get_client_mission_preparation_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001')$$,'42501','MISSION_CREATE_DENIED','foreign tenant cannot prepare this mission');
select throws_ok($$select public.authorize_client_dispute_attachment_v1(current_setting('test.accept338_evidence')::uuid)$$,'42501','DISPUTE_EVIDENCE_DENIED','foreign tenant cannot authorize private evidence download');
reset role;
select is((select count(*)::integer from public.audit_events where action='dispute.opened'),1,'one real dispute audit exists');
select is((select count(*)::integer from public.event_outbox where event_type='DisputeWarningIssuedV1'),1,'one warning outbox event exists');


-- New Provider regression coverage, all rollback-only.
select is(private.dispute_business_deadline_v1('2026-11-06 14:00:00+00',2,'{}'),'2026-11-10 14:00:00+00'::timestamptz,'Friday plus two working days is Tuesday, never Sunday');
select is(private.dispute_business_deadline_v1('2026-11-06 14:00:00+00',5,'{}'),'2026-11-13 14:00:00+00'::timestamptz,'five-day correction excludes the weekend');
select is(private.dispute_business_deadline_v1('2026-11-06 14:00:00+00',2,'{"business_calendar":{"version":"FIXTURE_CALENDAR_V1","time_zone":"UTC","working_iso_days":[1,2,3,4,5],"holidays":["2026-11-09"]}}'),'2026-11-11 14:00:00+00'::timestamptz,'contract-frozen holiday is excluded');
select is(private.dispute_business_deadline_v1('2026-03-27 14:00:00+00',2,'{"business_calendar":{"version":"FIXTURE_DST_V1","time_zone":"Europe/Paris","working_iso_days":[1,2,3,4,5],"holidays":[]}}'),'2026-03-31 13:00:00+00'::timestamptz,'local wall time is retained over a daylight-saving transition');
select throws_ok($$select private.dispute_business_deadline_v1(now(),2,'{"business_calendar":{"version":"BAD","time_zone":"UTC","working_iso_days":[],"holidays":[]}}')$$,'22023','INVALID_DISPUTE_BUSINESS_CALENDAR','empty working week fails closed');
select throws_ok($$select private.dispute_business_deadline_v1(now(),-1,'{}')$$,'22023','INVALID_DISPUTE_BUSINESS_DAYS','negative correction duration is rejected');
select ok(not has_function_privilege('authenticated','private.dispute_business_deadline_v1(timestamptz,integer,jsonb)','EXECUTE'),'API cannot call the private deadline helper');
select ok(not has_function_privilege('authenticated','public.respond_to_mission_dispute_legacy_0441(uuid,text,text,jsonb,text,uuid)','EXECUTE'),'legacy direct response path is closed');
select ok(not has_function_privilege('service_role','public.appeal_mission_dispute_legacy_0441(uuid,text,jsonb,text,uuid)','EXECUTE'),'service role cannot call legacy appeal');
select set_config('test.dispute351_case',(select v->>'dispute_case_id'from accept338 where k='dispute'),true);
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
-- Two explicit time zones make a genuine civil-date boundary at any UTC hour.
set local timezone='Etc/GMT+12';
-- A real reviewed source with a real date boundary, not a mocked eligibility helper.
insert into accept338 values('expiring-upload',public.begin_provider_document_upload('fd110000-0000-4000-8000-000000000002','application/pdf',20));
insert into storage.objects(bucket_id,name,metadata)select'provider-qualification',v->>'storage_object_path','{"mimetype":"application/pdf","size":20}'::jsonb from accept338 where k='expiring-upload';
insert into accept338 values('expiring-source',public.record_provider_document_version('fd110000-0000-4000-8000-000000000002','REFERENCE','DISPUTE_REFERENCE_351',jsonb_build_object('issued_on',(current_date-1)::text,'expires_on',current_date::text,'storage_object_path',(select v->>'storage_object_path'from accept338 where k='expiring-upload'),'content_hash',repeat('e',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic date-boundary evidence','dispute351-expiring-source'));
reset role;
grant select,insert on accept338 to service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
create temporary table dispute351_scan as select * from public.claim_provider_document_scan_jobs('fd351000-0000-4000-8000-000000000021',1,300);
select public.complete_provider_document_scan_job(proof_id,lease_token,worker_id,row_version,'CLEAN','SYNTHETIC_TEST','1',repeat('e',64),'dispute351-expiring-scan')from dispute351_scan;
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into accept338 values('expiring-review',public.review_provider_document((select(v->>'document_version_id')::uuid from accept338 where k='expiring-source'),'VERIFIED','Independent synthetic evidence review','TEST-351','dispute351-expiring-review'));
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into accept338 values('native-thread',public.open_rfq_message_thread('fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','Éléments de recette contradictoire','dispute351-thread'));
insert into accept338 values('native-message',public.send_internal_message((select(v->>'thread_id')::uuid from accept338 where k='native-thread'),'fd110000-0000-4000-8000-000000000002','Message métier عربي conservé pour le dossier.','[]','dispute351-send'));
insert into accept338 values('native-delivery',public.submit_delivery((select id from public.deliverables where mission_id=(select(v->>'mission_id')::uuid from accept338 where k='mission')order by id limit 1),'Preuve de livraison de recette uniquement','[]','[{"type":"URL","url":"https://example.invalid/provider-proof","evidence_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]','dispute351-delivery'));
insert into accept338 values('evidence-provider',public.get_dispute_evidence_context_v1(current_setting('test.dispute351_case')::uuid,'provider'));
select is((select v->>'organizationId'from accept338 where k='evidence-provider'),'fd110000-0000-4000-8000-000000000002','native Provider context is scoped to its actual organisation');
select ok((select jsonb_array_length(v->'documents')>=3 and jsonb_array_length(v->'messages')=1 and jsonb_array_length(v->'deliveries')=1 from accept338 where k='evidence-provider'),'context offers reviewed scanned originals, native message and versioned delivery');
create function pg_temp.evidence351()returns jsonb language sql as $$select jsonb_build_array(jsonb_build_object('type','MESSAGE','statement','Texte libre عربي inchangé','hash','forged','visibility','BOTH_PARTIES'),jsonb_build_object('type','DOCUMENT','visibility','BOTH_PARTIES','hash','forged','storage_path','other/tenant.pdf','metadata',jsonb_build_object('source_document_id',(select v#>>'{documents,0,id}'from accept338 where k='evidence-provider'))),jsonb_build_object('type','MESSAGE','visibility','BOTH_PARTIES','metadata',jsonb_build_object('source_message_id',(select v#>>'{messages,0,id}'from accept338 where k='evidence-provider'))),jsonb_build_object('type','DELIVERY_PROOF','visibility','BOTH_PARTIES','metadata',jsonb_build_object('source_delivery_proof_id',(select v#>>'{deliveries,0,id}'from accept338 where k='evidence-provider'))))$$;
select throws_ok($$select public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'CONTEST','Je conteste avec un document étranger.','[{"type":"DOCUMENT","visibility":"BOTH_PARTIES","metadata":{"source_document_id":"fd411000-0000-0000-0000-000000000001"}}]','dispute351-foreign')$$,'42501','DISPUTE_DOCUMENT_NOT_REUSABLE','Client private document cannot be attached by Provider');
select throws_ok($$select public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'CONTEST','Cette pièce est un message inventé.','[{"type":"MESSAGE","visibility":"BOTH_PARTIES","metadata":{"source_message_id":"fd411000-0000-0000-0000-000000000099"}}]','dispute351-message')$$,'42501','DISPUTE_MESSAGE_NOT_REUSABLE','unknown or foreign message is rejected');
select throws_ok($$select public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'CONTEST','La visibilité ne nous appartient pas.','[{"type":"MESSAGE","statement":"Test","visibility":"CLIENT_ONLY"}]','dispute351-visibility')$$,'22023','INVALID_EVIDENCE_VISIBILITY','Provider cannot impersonate Client-only evidence');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_dispute_evidence_context_v1(current_setting('test.dispute351_case')::uuid,'provider')$$,'42501','DISPUTE_EVIDENCE_DENIED','AAL1 cannot load sensitive evidence sources');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into accept338 values('provider-response',public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'ACKNOWLEDGE_AND_CORRECT','Je reconnais le point et apporte une correction.',pg_temp.evidence351(),'dispute351-response'));
insert into accept338 values('provider-response-replay',public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'ACKNOWLEDGE_AND_CORRECT','Je reconnais le point et apporte une correction.',pg_temp.evidence351(),'dispute351-response'));
select is((select v from accept338 where k='provider-response'),(select v from accept338 where k='provider-response-replay'),'lost-response retry returns same native receipt');
reset role;
select is((select count(*)::integer from public.dispute_responses where dispute_case_id=current_setting('test.dispute351_case')::uuid),1,'retry creates no duplicate contradictory response');
select is((select evidence_hash from public.dispute_evidence where statement='Texte libre عربي inchangé'),encode(extensions.digest(convert_to('Texte libre عربي inchangé','UTF8'),'sha256'),'hex'),'authoritative hash comes from actual statement, not browser hash');
select is((select evidence_hash from public.dispute_evidence where metadata->>'source_provider_document_id' is not null),repeat('e',64),'Provider document hash is resolved from the trusted scanned original');
select is((select evidence_hash from public.dispute_evidence where metadata->>'source_message_id'is not null),encode(extensions.digest(convert_to('Message métier عربي conservé pour le dossier.','UTF8'),'sha256'),'hex'),'native message hash is resolved from its actual immutable text');
select is((select metadata->>'source_delivery_version_id'from public.dispute_evidence where evidence_type='DELIVERY_PROOF'),(select v->>'delivery_version_id'from accept338 where k='native-delivery'),'delivery evidence retains the exact submitted version');
select set_config('test.dispute351_shared_document',(select id::text from public.dispute_evidence where metadata->>'source_provider_document_id'is not null),true);
set local role authenticated;
select is(public.authorize_client_dispute_attachment_v1(current_setting('test.dispute351_shared_document')::uuid)->>'bucket','provider-qualification','native Provider can obtain a scoped private download authorization');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.authorize_client_dispute_attachment_v1(current_setting('test.dispute351_shared_document')::uuid)->>'sha256',repeat('e',64),'Client party can read Provider evidence explicitly shared with both parties');
reset role;
select is((select deadline_calendar_snapshot->>'version'from public.dispute_cases where id=current_setting('test.dispute351_case')::uuid),'STANDARD_WEEKDAYS_UTC_V1','actual used calendar is recorded explicitly');
select ok((select correction_due_at<review_due_at from public.dispute_cases where id=current_setting('test.dispute351_case')::uuid),'acknowledgement records its configured correction deadline separately');
select is((select count(*)::integer from public.audit_events where action='dispute.responded'),1,'one real response audit');
select is((select count(*)::integer from public.event_outbox where event_type='DisputeResponseSubmittedV1'),1,'one durable response event');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.get_dispute_evidence_context_v1(current_setting('test.dispute351_case')::uuid,'provider')$$,'42501','DISPUTE_EVIDENCE_DENIED','foreign organisation cannot list evidence sources');
reset role;
-- A new civil date makes the immutable source expired. Existing receipts
-- remain replayable without creating evidence again; new attachments fail.
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
set local timezone='Pacific/Kiritimati';
select ok((select expires_on<current_date from public.provider_document_versions where id=(select(v->>'document_version_id')::uuid from accept338 where k='expiring-review')),'source genuinely expires on the next civil date');
select is(public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'ACKNOWLEDGE_AND_CORRECT','Je reconnais le point et apporte une correction.',pg_temp.evidence351(),'dispute351-response'),(select v from accept338 where k='provider-response'),'same actor and request recover receipt after source expiration');
select throws_ok($$select public.respond_to_mission_dispute(current_setting('test.dispute351_case')::uuid,'ACKNOWLEDGE_AND_CORRECT','Je reconnais le point et apporte une correction.',pg_temp.evidence351(),'dispute351-new-expired-source')$$,'42501','DISPUTE_DOCUMENT_NOT_REUSABLE','a new operation cannot attach the now expired source');
set local timezone='Etc/GMT+12';
reset role;
-- The same human can legally administer two organisations; the selected party
-- must still determine authorship and evidence visibility, not membership order.
insert into public.organization_memberships(id,organization_id,user_id,status)values('fd351000-0000-4000-8000-000000000024','fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000002','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fd351000-0000-4000-8000-000000000024','CLIENT_OWNER');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into accept338 values('human-decision',public.decide_mission_dispute(current_setting('test.dispute351_case')::uuid,'MINOR_CORRECTION','Correction mineure décidée humainement pour la recette.',array[current_setting('test.dispute351_shared_document')::uuid],jsonb_build_object('version','TEST-351','content_hash',repeat('3',64)),'dispute351-human-decision'));
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
create function pg_temp.appeal351()returns jsonb language sql as $$select public.appeal_mission_dispute(current_setting('test.dispute351_case')::uuid,'Je demande une seconde revue indépendante du dossier.',jsonb_set(pg_temp.evidence351(),'{0,metadata}',jsonb_build_object('source_organization_id','fd110000-0000-4000-8000-000000000002')),'dispute351-composite-appeal')$$;
insert into accept338 values('composite-appeal',pg_temp.appeal351()),('composite-appeal-replay',pg_temp.appeal351());
select is((select v from accept338 where k='composite-appeal'),(select v from accept338 where k='composite-appeal-replay'),'composite actor appeal replays its original receipt');
reset role;
select is((select count(*)::integer from public.dispute_evidence where metadata->>'source_provider_document_id'is not null and submitted_by_organization_id='fd110000-0000-4000-8000-000000000002'),2,'both response and appeal Provider documents retain Provider authorship');
select ok(not exists(select 1 from public.dispute_evidence where metadata->>'source_provider_document_id'is not null and submitted_by_organization_id<>'fd110000-0000-4000-8000-000000000002'),'membership order never attributes Provider evidence to Client');
select set_config('test.dispute351_appeal_document',(select id::text from public.dispute_evidence where metadata->>'source_provider_document_id'is not null order by created_at desc limit 1),true);
set local role authenticated;
select is(public.authorize_client_dispute_attachment_v1(current_setting('test.dispute351_appeal_document')::uuid)->>'bucket','provider-qualification','Provider appeal original remains downloadable with composite membership');
reset role;
-- Calendar errors are rejected before a template can enter approval.
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
create function pg_temp.propose_calendar351(p_days integer,p_calendar jsonb)returns jsonb language sql as $$
 select public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_CALENDAR_351','version',1,'library_id','fd300000-0000-4000-8000-000000000001','service_id','fd300000-0000-4000-8000-000000000007','country_code','MA','title_fr','Calendrier de recette uniquement','title_ar','تقويم اختبار فقط','clauses',(select jsonb_set(jsonb_set(data->'clauses','{dispute_policy,review_business_days}',to_jsonb(p_days)),'{dispute_policy,business_calendar}',p_calendar)from public.contract_policy_versions_v1 where id=(select(v->>'policy_version_id')::uuid from accept338 where k='policy')),'valid_from',current_date::text,'approval_reference','TEST_ONLY_CALENDAR_351'),'dispute351-calendar-'||p_days::text)
$$;
select throws_ok($$select pg_temp.propose_calendar351(3651,'{"version":"TEST351","time_zone":"UTC","working_iso_days":[1,2,3,4,5],"holidays":[]}'::jsonb)$$,'22023','INVALID_CONTRACT_DISPUTE_POLICY','unusable day bounds are rejected before template approval');
select throws_ok($$select pg_temp.propose_calendar351(2,'{"version":"TEST351","time_zone":"UTC","working_iso_days":[],"holidays":[]}'::jsonb)$$,'22023','INVALID_DISPUTE_BUSINESS_CALENDAR','invalid calendars cannot be proposed for approval');
reset role;
-- Incident/evidence reads inherit the actual technical assignment, including
-- immediate revocation. These are fixture users, never production accounts.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fd351000-0000-4000-8000-000000000031','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dispute351-assigned@example.invalid','',now(),'{}','{}',now(),now()),
('fd351000-0000-4000-8000-000000000032','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dispute351-unassigned@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values
('fd351000-0000-4000-8000-000000000041','fd110000-0000-4000-8000-000000000002','fd351000-0000-4000-8000-000000000031','ACTIVE'),
('fd351000-0000-4000-8000-000000000042','fd110000-0000-4000-8000-000000000002','fd351000-0000-4000-8000-000000000032','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fd351000-0000-4000-8000-000000000041','PROVIDER_TECHNICIAN'),('fd351000-0000-4000-8000-000000000042','PROVIDER_TECHNICIAN');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.assign_provider_mission_v1((select(v->>'mission_id')::uuid from accept338 where k='mission'),'fd351000-0000-4000-8000-000000000031',true,'Affectation de recette explicite','dispute351-assign');
select set_config('request.jwt.claim.sub','fd351000-0000-4000-8000-000000000032',true);select set_config('request.jwt.claims','{"sub":"fd351000-0000-4000-8000-000000000032","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.dispute_cases where id=current_setting('test.dispute351_case')::uuid),0,'unassigned Technician cannot read a colleague incident');
select is((select count(*)::integer from public.dispute_evidence where dispute_case_id=current_setting('test.dispute351_case')::uuid),0,'unassigned Technician cannot read colleague incident evidence');
select throws_ok($$select public.authorize_client_dispute_attachment_v1(current_setting('test.dispute351_appeal_document')::uuid)$$,'42501','DISPUTE_EVIDENCE_DENIED','known evidence identifier cannot bypass technical assignment');
select set_config('request.jwt.claim.sub','fd351000-0000-4000-8000-000000000031',true);select set_config('request.jwt.claims','{"sub":"fd351000-0000-4000-8000-000000000031","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.dispute_cases where id=current_setting('test.dispute351_case')::uuid),1,'assigned Technician can read the actual incident');
select ok((select count(*)>0 from public.dispute_evidence where dispute_case_id=current_setting('test.dispute351_case')::uuid),'assigned Technician can read evidence shared with its party');
select is((select count(*)::integer from public.dispute_evidence where dispute_case_id=current_setting('test.dispute351_case')::uuid and visibility='CLIENT_ONLY'),0,'technical assignment never opens Client-only evidence');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.assign_provider_mission_v1((select(v->>'mission_id')::uuid from accept338 where k='mission'),'fd351000-0000-4000-8000-000000000031',false,'Révocation de recette explicite','dispute351-revoke');
select set_config('request.jwt.claim.sub','fd351000-0000-4000-8000-000000000031',true);select set_config('request.jwt.claims','{"sub":"fd351000-0000-4000-8000-000000000031","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.dispute_cases where id=current_setting('test.dispute351_case')::uuid),0,'assignment revocation removes incident access immediately');
select throws_ok($$select public.authorize_client_dispute_attachment_v1(current_setting('test.dispute351_appeal_document')::uuid)$$,'42501','DISPUTE_EVIDENCE_DENIED','revoked assignment cannot download historical shared evidence');
reset role;
select *from finish();rollback;
