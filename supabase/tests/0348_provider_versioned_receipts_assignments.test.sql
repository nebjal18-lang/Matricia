-- Reuses the canonical native prepared-mission fixture; all changes roll back.
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
-- Provider corrective delivery/assignment regression on the canonical native
-- mission prepared above. All actors and optional-proof content are TEST ONLY.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fd100000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','technician-a@example.invalid','',now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','technician-b@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values
('fd120000-0000-4000-8000-000000000006','fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000006','ACTIVE'),
('fd120000-0000-4000-8000-000000000007','fd110000-0000-4000-8000-000000000002','fd100000-0000-4000-8000-000000000007','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('fd120000-0000-4000-8000-000000000006','PROVIDER_TECHNICIAN'),('fd120000-0000-4000-8000-000000000007','PROVIDER_TECHNICIAN');
select set_config('test.provider348_mission',(select(v->>'mission_id')from accept338 where k='mission'),true);
select set_config('test.provider348_deliverable',(select id::text from public.deliverables where mission_id=current_setting('test.provider348_mission')::uuid limit 1),true);
select set_config('test.provider348_milestone',(select id::text from public.mission_milestones where mission_id=current_setting('test.provider348_mission')::uuid limit 1),true);
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)::integer from public.missions),0,'unassigned Technician reads no mission of their employer');
select is((select count(*)::integer from public.contracts),0,'unassigned Technician reads no contract of their employer');
select throws_ok($$select public.submit_delivery(current_setting('test.provider348_deliverable')::uuid,'Test corrective report','[]','[]','provider348-unassigned')$$,'42501','DELIVERY_SUBMIT_DENIED','unassigned Technician cannot bypass the UI by delivery ID');
select throws_ok($$select public.submit_mission_milestone(current_setting('test.provider348_milestone')::uuid,1,'provider348-unassigned-milestone')$$,'42501','MILESTONE_SUBMIT_DENIED','unassigned Technician cannot submit another assignment');
select throws_ok($$select public.assign_provider_mission_v1(current_setting('test.provider348_mission')::uuid,'fd100000-0000-4000-8000-000000000006',true,'Self elevation test','provider348-self-assign')$$,'42501','ASSIGNMENT_MANAGE_DENIED','Technician cannot assign themselves');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(public.list_provider_mission_assignment_options_v1('fd110000-0000-4000-8000-000000000002')),2,'manager choices contain only current own-organization Technicians');
insert into accept338 values('assignment348',public.assign_provider_mission_v1(current_setting('test.provider348_mission')::uuid,'fd100000-0000-4000-8000-000000000006',true,'Assign synthetic test mission','provider348-assign'));
select is(public.assign_provider_mission_v1(current_setting('test.provider348_mission')::uuid,'fd100000-0000-4000-8000-000000000006',true,'Assign synthetic test mission','provider348-assign'),(select v from accept338 where k='assignment348'),'assignment retry returns same native receipt');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000007',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.missions),0,'other Technician cannot read assignment');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.missions),1,'assigned Technician reads their mission');
select is((select count(*)::integer from public.contracts),1,'assigned Technician reads relevant contract');
select lives_ok($$select public.submit_mission_milestone(current_setting('test.provider348_milestone')::uuid,1,'provider348-submit-milestone')$$,'assigned Technician submits first milestone');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.decide_mission_milestone(current_setting('test.provider348_milestone')::uuid,2,'REJECTED','Test missing item to correct','provider348-reject-milestone')$$,'Client records motivated milestone rejection');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.resubmit_mission_milestone_v1(current_setting('test.provider348_milestone')::uuid,3,'','provider348-bad-correction')$$,'22023','CORRECTION_REASON_REQUIRED','correction cannot silently erase rejection');
insert into accept338 values('milestone348',public.resubmit_mission_milestone_v1(current_setting('test.provider348_milestone')::uuid,3,'Test correction of missing item','provider348-correct-milestone'));
select is(public.resubmit_mission_milestone_v1(current_setting('test.provider348_milestone')::uuid,3,'Test correction of missing item','provider348-correct-milestone'),(select v from accept338 where k='milestone348'),'corrective milestone replay is stable after state transition');
select is((select reason from public.mission_milestone_decisions_v1 where milestone_id=current_setting('test.provider348_milestone')::uuid),'Test missing item to correct','Provider reads the actual Client rejection reason through scoped history');
select is((select prior_snapshot->>'status'from public.mission_milestone_corrections_v1 where milestone_id=current_setting('test.provider348_milestone')::uuid),'REJECTED','immutable correction retains rejected milestone snapshot');
select is((select status from public.mission_milestones where id=current_setting('test.provider348_milestone')::uuid),'SUBMITTED','corrected milestone can be reviewed again');
-- New proposals remain drafts and preserve the original signed version.
select throws_ok($$select public.propose_provider_contract_amendment_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',repeat('c',64),'Test extra scope','{"description":"Test additional report"}',1234,2,'[]','provider348-technician-amendment')$$,'42501','AMENDMENT_CREATE_DENIED','assigned Technician cannot price a contractual amendment');
select is((select count(*)::integer from public.search_provider_missions_v1('fd110000-0000-4000-8000-000000000002',current_setting('test.provider348_mission'),1)),1,'search reads assigned mission by reference before pagination');
select is((public.get_provider_mission_counts_v1('fd110000-0000-4000-8000-000000000002')->>'active_missions')::integer,1,'mission aggregate counts authorized rows independently of pages');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.propose_provider_contract_amendment_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',repeat('c',64),'Test extra scope','{"description":"Test additional report"}',1234,2,'[]','provider348-aal1-amendment')$$,'42501','AMENDMENT_CREATE_DENIED','AAL1 cannot propose an amendment');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.propose_provider_contract_amendment_v1('fd210000-0000-4000-8000-000000000001','fd220000-0000-4000-8000-000000000001',repeat('0',64),'Test extra scope','{"description":"Test additional report"}',1234,2,'[]','provider348-stale-amendment')$$,'40001','STALE_CONTRACT_VERSION','proposal cannot bind a stale version hash');
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
select is(public.get_mission_amendment_preparation_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'))->>'status','AWAITING_SIGNATURE','sending an amendment does not execute its work');
select set_config('test.provider348_amend_envelope',(select v->>'envelope_id'from accept338 where k='amend-envelope'),true);
select set_config('test.provider348_amend_client_signer',(select v->>'signer_id'from accept338 where k='amend-client-signer'),true);
select set_config('test.provider348_amend_provider_signer',(select v->>'signer_id'from accept338 where k='amend-provider-signer'),true);
reset role;select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SENT',null,'provider348-amend-sent');
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SIGNER_SIGNED',current_setting('test.provider348_amend_client_signer')::uuid,'provider348-amend-client-signed');
select public.run_mock_signature_provider(current_setting('test.provider348_amend_envelope')::uuid,'SIGNER_SIGNED',current_setting('test.provider348_amend_provider_signer')::uuid,'provider348-amend-provider-signed');
reset role;
select ok(private.contract_version_signature_effective_v1('fd210000-0000-4000-8000-000000000001',(select contract_version_id from public.missions where id=current_setting('test.provider348_mission')::uuid)),'amended contract is effective through its governed mock source-bound signatures');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into accept338 select'amend-preparation',public.get_mission_amendment_preparation_v1((v->>'amendment_id')::uuid)from accept338 where k='amend348';
select is((select v->>'status'from accept338 where k='amend-preparation'),'READY','effective signed additions require Client operational preparation');
select is((select v#>>'{items,0,criteria,0,label_fr}'from accept338 where k='amend-preparation'),'Rapport complémentaire vérifiable','preparation reads the actual signed acceptance wording');
reset role;
select throws_ok($$update public.missions set status='COMPLETED'where id=current_setting('test.provider348_mission')::uuid$$,'55000','MISSION_AMENDMENT_EXECUTION_REQUIRED','a signed additional obligation cannot be silently omitted from mission completion');
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.execute_signed_mission_amendment_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),(select v->>'preparation_hash'from accept338 where k='amend-preparation'),'[]',true,'provider348-aal1-execute')$$,'42501','AMENDMENT_EXECUTION_DENIED','AAL1 cannot execute signed additions');
select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.execute_signed_mission_amendment_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),repeat('0',64),'[]',true,'provider348-stale-execute')$$,'40001','STALE_AMENDMENT_PREPARATION','stale preparation cannot create additional work');
select throws_ok($$select public.execute_signed_mission_amendment_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),(select v->>'preparation_hash'from accept338 where k='amend-preparation'),'[{"deliverable_key":"INVENTED","due_at":"2026-12-03T12:00:00Z"}]',true,'provider348-invented-execute')$$,'22023','INVALID_AMENDMENT_ASSIGNMENT_SCOPE','Client cannot invent a deliverable outside signed additions');
create function pg_temp.execute_amend348()returns jsonb language sql as $$select public.execute_signed_mission_amendment_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'),(select v->>'preparation_hash'from accept338 where k='amend-preparation'),'[{"deliverable_key":"ADDED_TEST","due_at":"2026-12-03T12:00:00Z"}]',true,'provider348-execute-amendment')$$;
insert into accept338 values('amend-execution',pg_temp.execute_amend348());
select is(pg_temp.execute_amend348(),(select v from accept338 where k='amend-execution'),'actual execution retries without creating duplicate work');
select is((select count(*)::integer from public.deliverables where mission_id=current_setting('test.provider348_mission')::uuid and deliverable_key='ADDED_TEST'),1,'signature plus Client preparation creates the actual additional deliverable');
select is((select count(*)::integer from public.mission_milestones where mission_id=current_setting('test.provider348_mission')::uuid and milestone_key like'AMD_%'),1,'execution creates the actual additional milestone');
select is((select a.label_fr from public.acceptance_checklists a join public.deliverables d on d.id=a.deliverable_id where d.deliverable_key='ADDED_TEST'and d.mission_id=current_setting('test.provider348_mission')::uuid),'Rapport complémentaire vérifiable','receipt criterion is copied exactly from the signed proposal');
select is(public.get_mission_amendment_preparation_v1((select(v->>'amendment_id')::uuid from accept338 where k='amend348'))->>'status','APPLIED','applied state is backed by immutable execution and real mission objects');
reset role;
select is((select count(*)::integer from public.audit_events where action='mission.amendment.executed'),1,'one real execution audit after retry');
select is((select count(*)::integer from public.event_outbox where event_type='MissionAmendmentExecutedV1'),1,'one durable execution event after retry');
set local role authenticated;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
-- Native pending bytes stay quarantined while a lost response is recoverable.
select set_config('test.provider348_pending_deliverable',(select id::text from public.deliverables where mission_id=current_setting('test.provider348_mission')::uuid and deliverable_key='ADDED_TEST'),true);
select set_config('test.provider348_pending_key','fd348000-0000-4000-8000-000000000017',true);
select set_config('test.provider348_pending_path',auth.uid()::text||'/'||current_setting('test.provider348_pending_deliverable')||'/'||current_setting('test.provider348_pending_key')||'/test-pending.pdf',true);
insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs',current_setting('test.provider348_pending_path'),auth.uid()::text,'{"mimetype":"application/pdf","size":20}');
create function pg_temp.proofs348_pending()returns jsonb language sql as $$select jsonb_build_array(jsonb_build_object('type','DOCUMENT','storage_path',current_setting('test.provider348_pending_path'),'url',null,'evidence_hash',repeat('e',64),'metadata',jsonb_build_object('original_file_name','test-pending.pdf','mime_type','application/pdf','size_bytes',20,'upload_binding_version',1)))$$;
insert into accept338 values('pending-file348',public.submit_delivery(current_setting('test.provider348_pending_deliverable')::uuid,'Synthetic pending proof lost-response test','[]',pg_temp.proofs348_pending(),current_setting('test.provider348_pending_key')));
select is((select count(*)::integer from storage.objects where bucket_id='delivery-proofs'and name=current_setting('test.provider348_pending_path')),0,'even uploader cannot read bound pending bytes');
select is(public.get_provider_delivery_command_receipt_v1(current_setting('test.provider348_pending_deliverable')::uuid,'Synthetic pending proof lost-response test','[]',pg_temp.proofs348_pending(),current_setting('test.provider348_pending_key'))->'response',(select v from accept338 where k='pending-file348'),'same actor recovers exact delivery receipt without reading pending content');
select throws_ok($$select public.get_provider_delivery_command_receipt_v1(current_setting('test.provider348_pending_deliverable')::uuid,'Changed payload after commit','[]',pg_temp.proofs348_pending(),current_setting('test.provider348_pending_key'))$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed delivery payload cannot recover a previous receipt');
select is((select count(*)::integer from public.delivery_versions where deliverable_id=current_setting('test.provider348_pending_deliverable')::uuid),1,'receipt recovery creates no duplicate version');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000007',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_provider_delivery_command_receipt_v1(current_setting('test.provider348_pending_deliverable')::uuid,'Synthetic pending proof lost-response test','[]',pg_temp.proofs348_pending(),current_setting('test.provider348_pending_key'))$$,'42501','DELIVERY_SUBMIT_DENIED','unassigned colleague cannot recover delivery receipt by known key');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.submit_delivery(current_setting('test.provider348_deliverable')::uuid,'First test report','[]','[]','provider348-required-proof')$$,'22023','DELIVERY_PROOF_REQUIRED','mandatory proof is still enforced');
reset role;
-- This separate test deliverable has optional evidence, not an AV bypass.
update public.deliverables set proof_required=false where id=current_setting('test.provider348_deliverable')::uuid;
set local role authenticated;
insert into accept338 values('delivery348-v1',public.submit_delivery(current_setting('test.provider348_deliverable')::uuid,'First optional-evidence test report','[]','[]','provider348-delivery-v1'));
select is((select count(*)::integer from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=1 and status='PENDING'),1,'first delivery receives its own pending criterion');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,1,'[{"criterion_key":"VERIFY","status":"NONCOMPLIANT"}]','provider348-missing-rejection-reason')$$,'22023','ACCEPTANCE_REJECTION_REASON_REQUIRED','criterion rejection needs an actionable reason');
select lives_ok($$select public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,1,'[{"criterion_key":"VERIFY","status":"NONCOMPLIANT","comment":"Test missing result"}]','provider348-reject-v1')$$,'Client rejects V1 against its own criterion');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
insert into accept338 values('delivery348-v2',public.submit_delivery(current_setting('test.provider348_deliverable')::uuid,'Second corrected optional-evidence test report','[]','[]','provider348-delivery-v2'));
select is((select count(*)::integer from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=2 and status='PENDING'),1,'V2 receives fresh pending receipt without overwriting V1');
select is((select comment from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=1),'Test missing result','Provider reads original rejection comments');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,1,'[{"criterion_key":"VERIFY","status":"NONCOMPLIANT","comment":"Test missing result"}]','provider348-reject-v1')->>'outcome','DELIVERY_REJECTED','lost Client rejection receipt V1 is recoverable after corrective V2 exists');
select is((select status from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=2),'PENDING','replay of V1 never decides V2');
select throws_ok($$select public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,1,'[{"criterion_key":"VERIFY","status":"COMPLIANT","comment":"Changed claim"}]','provider348-reject-v1')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed V1 decision cannot reuse committed rejection key');
select throws_ok($$select public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,1,'[{"criterion_key":"VERIFY","status":"COMPLIANT"}]','provider348-stale-v1')$$,'40001','DELIVERY_VERSION_CHANGED','stale Client form cannot decide the corrective V2');
select lives_ok($$select public.accept_delivery_version_v1(current_setting('test.provider348_deliverable')::uuid,2,'[{"criterion_key":"VERIFY","status":"COMPLIANT","comment":"Test correction verified"}]','provider348-accept-v2')$$,'Client can accept corrective V2 after V1 rejection');
select is((select status from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=1),'NONCOMPLIANT','accepting V2 preserves noncompliant V1');
select is((select status from public.acceptance_checklists where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=2),'COMPLIANT','V2 has independent compliant receipt');
reset role;
select throws_ok($$update public.acceptance_checklists set comment='rewrite'where deliverable_id=current_setting('test.provider348_deliverable')::uuid and delivery_version=1$$,'55000','IMMUTABLE_DELIVERY_RECEIPT','even owner SQL cannot rewrite a decided version');
-- Composite read authority never becomes unassigned operational write authority.
insert into public.organization_member_roles(membership_id,role_code)values('fd120000-0000-4000-8000-000000000007','PROVIDER_VIEWER');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000007',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)::integer from public.missions),1,'explicit Viewer authority permits read only for composite Technician');
select throws_ok($$select public.submit_delivery(current_setting('test.provider348_deliverable')::uuid,'Composite scope escalation test','[]','[]','provider348-composite-escalation')$$,'42501','DELIVERY_SUBMIT_DENIED','Technician plus Viewer cannot write an unassigned delivery');
select throws_ok($$select public.submit_mission_milestone(current_setting('test.provider348_milestone')::uuid,4,'provider348-composite-milestone')$$,'42501','MILESTONE_SUBMIT_DENIED','Technician plus Viewer cannot submit an unassigned milestone');
reset role;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select lives_ok($$select public.assign_provider_mission_v1(current_setting('test.provider348_mission')::uuid,'fd100000-0000-4000-8000-000000000006',false,'Test assignment revocation','provider348-revoke')$$,'manager can revoke assignment');
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"fd100000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.missions),0,'revoked Technician immediately loses scoped access');
reset role;
select *from finish();rollback;

