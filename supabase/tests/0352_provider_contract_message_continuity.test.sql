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
-- Historical selected RFQ fixture: selection itself is tested elsewhere.
-- Keep the real CLOSED/closed_at constraint so messaging cannot reopen it.
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,invited_count,opened_by,closed_at)
values('fd150000-0000-4000-8000-000000000001','fd140000-0000-4000-8000-000000000001','fd160000-0000-4000-8000-000000000001','fd170000-0000-4000-8000-000000000001','CLOSED',clock_timestamp()+interval'1 day',1,'fd100000-0000-4000-8000-000000000001',clock_timestamp());
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


-- First conversation for a historically selected quote and the governed DEV-mock
-- contract sealed above; selection itself is not executed by this fixture.
-- This extends the canonical0338 fixture, retaining all its active constraints.
select is((select count(*)::integer from public.internal_message_threads),0,'precondition: selected contract has no pre-existing conversation');
select is((select status from public.rfqs where id='fd150000-0000-4000-8000-000000000001'),'CLOSED','precondition: historical selected RFQ is closed');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into accept338 values('provider352-thread',public.open_rfq_message_thread('fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','Suivi du contrat sélectionné','provider352-open'));
insert into accept338 values('provider352-replay',public.open_rfq_message_thread('fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','Suivi du contrat sélectionné','provider352-open'));
select is((select v from accept338 where k='provider352-thread'),(select v from accept338 where k='provider352-replay'),'lost-response retry returns the same thread and command');
select set_config('test.provider352_thread',(select v->>'thread_id' from accept338 where k='provider352-thread'),true);
select set_config('test.provider352_mission',(select v->>'mission_id' from accept338 where k='mission'),true);
select ok(jsonb_path_exists(public.list_internal_message_open_options_v1('fd110000-0000-4000-8000-000000000002'),'$.options[*] ? (@.context == "CONTRACT")'),'Provider selector includes its selected contractual dossier');
select is(public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')->'thread'->>'participant_kind','PROVIDER','the new contract conversation has the selected Provider presentation');
select is(public.get_internal_message_thread(current_setting('test.provider352_thread')::uuid)->'thread'->>'can_send','true','legacy conversation projection also carries Owner execution capability');
select is(public.find_provider_rfq_message_thread_v1('fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002'),current_setting('test.provider352_thread')::uuid,'a dossier deep link resumes its authorized thread without searching the first inbox page');
reset role;
select is((select status from public.rfqs where id='fd150000-0000-4000-8000-000000000001'),'CLOSED','opening the conversation never reopens the RFQ');
select is((select count(*)::integer from public.internal_message_threads),1,'replay creates no second object thread');
select is((select count(*)::integer from public.audit_events where action='messaging.thread.opened'),1,'one audited opening is retained');
select is((select count(*)::integer from public.event_outbox where event_type='InternalMessageThreadOpenedV1'),1,'one opening event is emitted');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fa352000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider352-tech-a@example.invalid','',now(),'{}','{}',now(),now()),
('fa352000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider352-tech-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values
('fb352000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','fa352000-0000-4000-8000-000000000001','ACTIVE'),
('fb352000-0000-4000-8000-000000000002','fd110000-0000-4000-8000-000000000002','fa352000-0000-4000-8000-000000000002','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fb352000-0000-4000-8000-000000000001','PROVIDER_TECHNICIAN'),('fb352000-0000-4000-8000-000000000002','PROVIDER_TECHNICIAN');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','unassigned Technician cannot read employer-wide contract conversation');
select is((public.search_internal_message_inbox('','fd110000-0000-4000-8000-000000000002')->>'total')::integer,0,'unassigned Technician sees no contract thread in inbox');
select throws_ok($$select public.send_internal_message(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002','Contournement par identifiant connu.','[]','provider352-unassigned')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','unassigned Technician cannot send by a known thread identifier');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.assign_provider_mission_v1(current_setting('test.provider352_mission')::uuid,'fa352000-0000-4000-8000-000000000001',true,'Affectation de recette de la mission','provider352-assign')$$,'Owner assigns the first Technician through the governed command');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')$$,'assigned Technician can read the contractual mission thread');
select lives_ok($$select public.send_internal_message(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002','Livraison en cours نص حر محفوظ.','[]','provider352-assigned')$$,'assigned Technician can send the unchanged bilingual free text');
select lives_ok($$select public.open_rfq_message_thread('fd150000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','Suivi de mission affectée','provider352-tech-open')$$,'assigned Technician can reach the same private thread after contract selection');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','second Technician cannot inherit the first Technician assignment');
reset role;
-- Read permission from Viewer must not turn into execution permission for a
-- simultaneous, unassigned Technician role.
insert into public.organization_member_roles(membership_id,role_code)values('fb352000-0000-4000-8000-000000000002','PROVIDER_VIEWER');
set local role authenticated;
select is(public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')->'thread'->>'can_send','false','Technician plus Viewer retains authorized read but not execution');
select is(public.get_internal_message_thread(current_setting('test.provider352_thread')::uuid)->'thread'->>'can_send','false','legacy projection never infers execution from composite read access');
select throws_ok($$select public.send_internal_message(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002','Escalade par rôle composite.','[]','provider352-composite')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','adding Viewer cannot grant unassigned Technician write access');
select throws_ok($$select public.save_internal_message_draft_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002','Brouillon non autorisé.','fc352000-0000-4000-8000-000000000001')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','composite read permission cannot prepare private file uploads');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.assign_provider_mission_v1(current_setting('test.provider352_mission')::uuid,'fa352000-0000-4000-8000-000000000001',false,'Retrait de l’affectation de recette','provider352-revoke')$$,'Owner revokes the assignment without altering historical messages');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','revocation immediately removes Technician history access');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.list_internal_message_open_options_v1('fd110000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_OPTIONS_SCOPE_DENIED','foreign tenant cannot enumerate contractual message options');
reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('fa352000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider352-client-viewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('fb352000-0000-4000-8000-000000000003','fd110000-0000-4000-8000-000000000001','fa352000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fb352000-0000-4000-8000-000000000003','CLIENT_VIEWER');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000001')->'thread'->>'can_send','false','Client Viewer keeps read access without gaining Provider message execution');
select throws_ok($$select public.send_internal_message(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000001','Essai Viewer côté Client.','[]','provider352-clientviewer')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','Client Viewer cannot send through the shared private conversation command');
reset role;
-- An organisation may carry both business profiles. Client-only membership
-- does not silently become permission to inspect Provider commercial messages.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('fa352000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','provider352-other-profile@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('fb352000-0000-4000-8000-000000000004','fd110000-0000-4000-8000-000000000002','fa352000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fb352000-0000-4000-8000-000000000004','CLIENT_VIEWER');
select set_config('request.jwt.claim.sub','fa352000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fa352000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.get_internal_message_thread_page_for_organization_v1(current_setting('test.provider352_thread')::uuid,'fd110000-0000-4000-8000-000000000002')$$,'42501','MESSAGE_THREAD_SCOPE_DENIED','Client-only role in a shared organisation is not a Provider read entitlement');
select is((public.search_internal_message_inbox('','fd110000-0000-4000-8000-000000000002')->>'total')::integer,0,'the other business profile cannot discover Provider conversation metadata');
reset role;
select ok(not has_function_privilege('service_role','public.list_internal_message_open_options_v1(uuid,integer)','EXECUTE'),'service role cannot bypass option actor authorization');
select ok(not has_function_privilege('anon','public.list_internal_message_open_options_v1(uuid,integer)','EXECUTE'),'anonymous option access is closed');
select ok(not has_function_privilege('authenticated','private.contract_message_open_scope_v1(uuid,uuid,uuid)','EXECUTE'),'API cannot invoke the private lifecycle helper');
select is((select count(*)::integer from public.internal_messages where body='Livraison en cours نص حر محفوظ.'),1,'revocation never rewrites or deletes the authored message');
select * from finish();rollback;
