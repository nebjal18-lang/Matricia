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

-- Native proposal before any operational mission exists; no signature row is forged.
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
create function pg_temp.amend348()returns jsonb language sql as $$select public.propose_provider_contract_amendment_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',repeat('c',64),'Test extra scope','{"description":"Test additional report"}',1234,2,'[{"operation":"ADD","item_type":"DELIVERABLE","item_key":"ADDED_TEST","label_fr":"Texte libre original","label_ar":"Texte libre original","sort_order":2,"details":{"acceptance_criteria":[{"key":"ADDED_REVIEW","label_fr":"Rapport complémentaire vérifiable","label_ar":"Rapport complémentaire vérifiable"}]}}]','provider348-structured-amendment')$$;
insert into accept338 values('amend348',pg_temp.amend348());
select is(pg_temp.amend348(),(select v from accept338 where k='amend348'),'structured proposal retry preserves its original immutable result');
select is((select status from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from accept338 where k='amend348')),'DRAFT','proposal does not activate or sign an amendment');
select is((select deliverables_delta#>>'{0,label_ar}'from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from accept338 where k='amend348')),'Texte libre original','free text is not silently translated');
select is((select count(*)::integer from public.contract_items where contract_version_id='fd220000-0000-4000-8000-000000000001'),1,'original signed deliverables remain untouched');
select is((select count(*)::integer from public.contract_versions where contract_id='fd210000-0000-4000-8000-000000000001'),1,'draft proposal cannot rewrite or replace signed version');
select throws_ok($$select public.propose_provider_contract_amendment_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',repeat('c',64),'Test malformed scope','{"description":"Test malformed report"}',1234,2,'[{"operation":"ADD","item_type":"DELIVERABLE","item_key":"ADDED_BAD","label_fr":"Test","label_ar":"","sort_order":3}]','provider348-bad-deliverable')$$,'22023','INVALID_AMENDMENT_DELIVERABLE_DELTA','incomplete additional deliverable is refused before draft creation');
-- Complete the actual governed DEVELOPMENT mock amendment protocol, never a
-- legal production signature. The trusted callback runs as service_role.
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into accept338 select'amend-policy',public.propose_signature_policy_v1('fd110000-0000-4000-8000-000000000001','AMENDMENT',(provider->>'id')::uuid,'SIMPLE',false,false,'TEST-NON-CONTRACTUAL-AMENDMENT','TEST-INSTALLED-MOCK',1,'TEST ONLY amendment execution protocol','34111111-1111-4111-8111-111111111111')from jsonb_array_elements(public.list_signature_policy_governance_v1()->'providers')provider where provider->>'code'='MATRICIA_DEV_MOCK'limit 1;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000005',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from accept338 where k='amend-policy'),(select v->>'content_hash'from accept338 where k='amend-policy'),true,'TEST ONLY independent amendment signature policy review');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into accept338 select'amend-envelope',public.create_amendment_signature_envelope((v->>'amendment_id')::uuid,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-348-amendment.pdf','test-signatures/provider348-amendment.pdf',repeat('e',64),'provider348-amendment-envelope')from accept338 where k='amend348';
insert into accept338 select'amend-client-signer',public.add_signature_signer((v->>'envelope_id')::uuid,'fd110000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest('mf024-client@example.invalid','sha256'),'hex'),1,'provider348-amend-client-signer')from accept338 where k='amend-envelope';
insert into accept338 select'amend-provider-signer',public.add_signature_signer((v->>'envelope_id')::uuid,'fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000002','PROVIDER_OWNER',encode(extensions.digest('mf024-provider@example.invalid','sha256'),'hex'),2,'provider348-amend-provider-signer')from accept338 where k='amend-envelope';
select public.authorize_signature_signer((v->>'signer_id')::uuid,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],50000,'MAD',current_date-1,current_date+1,'test-authorities/client-amendment348.pdf',repeat('d',64),'provider348-amend-client-authority')from accept338 where k='amend-client-signer';
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.authorize_signature_signer((v->>'signer_id')::uuid,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],50000,'MAD',current_date-1,current_date+1,'test-authorities/provider-amendment348.pdf',repeat('c',64),'provider348-amend-provider-authority')from accept338 where k='amend-provider-signer';
select throws_ok($$select public.execute_signed_mission_amendment_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),repeat('0',64),'[]',true,'provider348-provider-exec')$$,'42501','AMENDMENT_EXECUTION_DENIED','Provider cannot execute their own proposed work as Client');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.submit_contract_amendment_for_signature((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from accept338 where k='amend348')),'provider348-submit-amendment');
select is(public.get_mission_amendment_preparation_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'))->>'status','NO_MISSION','no initial mission is fabricated by sending an amendment');
select set_config('test.provider348_amend_envelope',(select v->>'envelope_id'from accept338 where k='amend-envelope'),true);
select set_config('test.provider348_amend_client_signer',(select v->>'signer_id'from accept338 where k='amend-client-signer'),true);
select set_config('test.provider348_amend_provider_signer',(select v->>'signer_id'from accept338 where k='amend-provider-signer'),true);
reset role;select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SENT',null,'provider348-amend-sent');
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SIGNER_SIGNED',current_setting('test.provider348_amend_client_signer')::uuid,'provider348-amend-client-signed');
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SIGNER_SIGNED',current_setting('test.provider348_amend_provider_signer')::uuid,'provider348-amend-provider-signed');
reset role;

select ok(private.contract_version_signature_effective_v1('fd210000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='fd210000-0000-4000-8000-000000000001'and version=2)),'native governed mock amendment is effective before the first mission');
select is((select count(*)::integer from public.missions),0,'signature alone does not fabricate a mission');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into accept338 values('initial-signed-plan',public.get_client_mission_preparation_v1('fd210000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='fd210000-0000-4000-8000-000000000001'and version=2)));
select is((select x#>>'{required_criteria,0,key}'from accept338,jsonb_array_elements(v->'deliverables')x where k='initial-signed-plan'and x->>'key'='ADDED_TEST'),'ADDED_REVIEW','initial mission reads the actual signed extra criterion');
create function pg_temp.initial_assignments353(p_wrong_criterion boolean default false)returns jsonb language sql as $$select jsonb_agg(jsonb_build_object('deliverable_key',d->>'key','due_at','2026-12-03T12:00:00Z','owner_organization_id','fd110000-0000-4000-8000-000000000002','criterion_keys',case when d->>'key'='ADDED_TEST'and p_wrong_criterion then '["VERIFY"]'::jsonb else(select jsonb_agg(c->>'key')from jsonb_array_elements(coalesce(nullif(d->'required_criteria','null'::jsonb),v->'criteria'))c)end))from accept338,jsonb_array_elements(v->'deliverables')d where k='initial-signed-plan'$$;
select throws_ok($$select public.create_client_prepared_mission_v1('fd210000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='fd210000-0000-4000-8000-000000000001'and version=2),(select v->>'template_hash'from accept338 where k='initial-signed-plan'),pg_temp.initial_assignments353(true),'provider353-substituted-criterion')$$,'22023','MISSION_CRITERION_OUTSIDE_CHECKLIST','operational choices cannot substitute a different criterion for a signed addition');
insert into accept338 values('initial-signed-mission',public.create_client_prepared_mission_v1('fd210000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='fd210000-0000-4000-8000-000000000001'and version=2),(select v->>'template_hash'from accept338 where k='initial-signed-plan'),pg_temp.initial_assignments353(false),'provider353-actual-initial-mission'));
select is((select count(*)::integer from public.deliverables where mission_id=(select(v->>'mission_id')::uuid from accept338 where k='initial-signed-mission')),2,'initial mission contains both the original and the signed added deliverable');
select is((select a.criterion_key from public.acceptance_checklists a join public.deliverables d on d.id=a.deliverable_id where d.deliverable_key='ADDED_TEST'),'ADDED_REVIEW','the extra receipt retains the signed criterion key');
select is((select a.label_ar from public.acceptance_checklists a join public.deliverables d on d.id=a.deliverable_id where d.deliverable_key='ADDED_TEST'),'Rapport complémentaire vérifiable','free text is retained verbatim in the Arabic view of the signed receipt');
select is(public.get_mission_amendment_preparation_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'))->>'status','NO_ADDITIONAL_WORK','already prepared signed additions are not duplicated as pending work');
reset role;
select *from finish();rollback;
