begin;
set local search_path=public,private,extensions;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-ONLY-contract220-explicit-dev',configured_at=clock_timestamp()where singleton;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('fa120000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-provider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('QUOTE_ANCHOR_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('QUOTE_ANCHOR_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('fa121000-0000-4000-8000-000000000001','MA','QUOTE_ANCHOR_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('fa121000-0000-4000-8000-000000000002','MA','QUOTE_ANCHOR_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('fa121000-0000-4000-8000-000000000003','MA','QUOTE_ANCHOR_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('fa121000-0000-4000-8000-000000000004','MA','QUOTE_ANCHOR_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('fa121000-0000-4000-8000-000000000005','MA','QUOTE_ANCHOR_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','fa120000-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fa122000-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','fa120000-0000-4000-8000-000000000001'),
('fa122000-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','fa120000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('fa123000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','fa120000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('fa123000-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('fa124000-0000-4000-8000-000000000001','QUOTE_TAX','quote-tax','fa122000-0000-4000-8000-000000000001','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000002','fa124000-0000-4000-8000-000000000001','QUOTE_TAX_CAT','quote-tax-cat','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000003','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000002','QUOTE_TAX_SUB','quote-tax-sub','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('fa124000-0000-4000-8000-000000000004','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000003','QUOTE_TAX_SERVICE','quote-tax-service','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('fa125000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000004','MATCHING','fa120000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('fa125000-0000-4000-8000-000000000002','fa125000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA","tax_category_code":"QUOTE_ANCHOR_A"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'fa120000-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='fa125000-0000-4000-8000-000000000002' where id='fa125000-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('fa126000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'fa120000-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('fa126000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('fa127000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000001','fa125000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'fa120000-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('fa128000-0000-4000-8000-000000000001','fa127000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','fa126000-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

create temporary table anchor_quote_payload(value jsonb);
insert into anchor_quote_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','fa121000-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update anchor_quote_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on anchor_quote_payload to authenticated;
create temporary table anchor_quote_result(value jsonb);grant select,insert on anchor_quote_result to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f2120000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f2120000-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('fa122000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','fa120000-0000-4000-8000-000000000001');
insert into public.provider_match_profiles(provider_organization_id)values('fa122000-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('fa122000-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','f2120000-0000-4000-8000-000000000002',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fa122000-0000-4000-8000-000000000002','ICE','997212000000001'),('fa122000-0000-4000-8000-000000000002','IF','99721201'),('fa122000-0000-4000-8000-000000000002','RC','TEST-212');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='f2120000-0000-4000-8000-000000000002';org uuid:='fa122000-0000-4000-8000-000000000002';begin
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
select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
-- Transactional catalogue/tax prerequisites: exact published service and independent mapping approval.
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('fa124000-0000-4000-8000-000000000005','fa124000-0000-4000-8000-000000000004','fa124000-0000-4000-8000-000000000001',1,'PUBLISHED','Service fiscal de fixture','خدمة اختبار ضريبي','Service synthétique','خدمة اصطناعية','Source historique synthétique exacte pour contrat de recette','مصدر اصطناعي دقيق لعقد الاختبار','CONSULTING','mission','مهمة',1,'Précondition catalogue de fixture',repeat('6',64),'fa120000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z','fa124000-0000-4000-8000-000000000003','QUOTE_TAX_SERVICE','quote-tax-service');
insert into public.platform_user_roles(user_id,role_code)values('fa120000-0000-4000-8000-000000000001','FINANCE_MANAGER');
select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.archive241_tax_proposal',public.propose_service_tax_category_mapping_v1('fa124000-0000-4000-8000-000000000005',repeat('6',64),private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','fa124000-0000-4000-8000-000000000005','MA','MAD'),'MA','MAD','QUOTE_ANCHOR_A',current_date-1,null,true,'{}','TEST classification synthétique de la source exacte',extensions.gen_random_uuid())::text,true);
select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((current_setting('test.archive241_tax_proposal')::jsonb->>'proposal_id')::uuid,current_setting('test.archive241_tax_proposal')::jsonb->>'content_hash',true,'TEST/ARCHIVE241/TAX','TEST approbation indépendante de la classification');

select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into anchor_quote_result select public.create_quote_revision('fa128000-0000-4000-8000-000000000001',(select value from anchor_quote_payload),'Initial reviewed quote','anchor-quote-create');

select set_config('test.anchor_identity',public.get_my_provider_identity_status_v1('fa122000-0000-4000-8000-000000000002')::text,true);
select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST provider registered address','contract220-publish-anchor');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','canonical-contract220-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('a2200000-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2200000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('fa122000-0000-4000-8000-000000000001','ICE','997220000000001','VERIFIED'),('fa122000-0000-4000-8000-000000000001','IF','99722001','VERIFIED'),('fa122000-0000-4000-8000-000000000001','RC','TEST220','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','VERIFIED',1,'a2200000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99722001","rc_number":"TEST220","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Client fiscal test","display_name":"Client fiscal test","country_code":"MA","identifiers":{"ICE":"997220000000001","IF":"99722001","RC":"TEST220"}}',1,'a2200000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001',1,now()-interval'1 day','f2120000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b1770000-0000-0000-0000-000000000001','f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'fa122000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f2120000-0000-4000-8000-000000000002',clock_timestamp(),'a2200000-0000-4000-8000-000000000001'),
('b1770000-0000-0000-0000-000000000002','f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'fa122000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f2120000-0000-4000-8000-000000000002',clock_timestamp(),'a2200000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b1780000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000001','fa122000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000001'),
('b1780000-0000-0000-0000-000000000002','b1770000-0000-0000-0000-000000000002','fa122000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b1770000-0000-0000-0000-000000000001' then 'b1780000-0000-0000-0000-000000000001'::uuid
  else 'b1780000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b1770000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','f2120000-0000-4000-8000-000000000002',clock_timestamp(),'a2200000-0000-4000-8000-000000000001','b1770000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f2200000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','f2120000-0000-4000-8000-000000000002',clock_timestamp(),'a2200000-0000-4000-8000-000000000001','b1770000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


create temporary table provider_fixture(provider_organization_id uuid,provider_service_id uuid,questionnaire_session_id uuid,qualification_id uuid,qualification_decision_id uuid);
insert into provider_fixture values('fa122000-0000-4000-8000-000000000002','f2200000-0000-4000-8001-000000000001','f2200000-0000-4000-8001-000000000002','f2200000-0000-4000-8001-000000000003','f2200000-0000-4000-8001-000000000004');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by) values
 ('f1554200-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','ROTATION.155.V1','DRAFT',repeat('e',64),'fa120000-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by) values
 ('f1554210-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','ROTATION_QUESTIONNAIRE','DRAFT','fa120000-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by) values
 ('f1554300-0000-4000-8000-000000000001','f1554210-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire rotation','استبيان التناوب','Questionnaire pour preuve de rotation','استبيان لإثبات التناوب','PROVIDER','1.0.0','ROTATION-V1',repeat('f',64),'Fixture rotation','fa120000-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select provider_service_id,provider_organization_id,'fa124000-0000-4000-8000-000000000004','DECIDED','fa120000-0000-4000-8000-000000000001',now() from provider_fixture;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
select questionnaire_session_id,provider_organization_id,'fa120000-0000-4000-8000-000000000001','fa124000-0000-4000-8000-000000000001','f1554200-0000-4000-8000-000000000001','f1554300-0000-4000-8000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('1',64) from provider_fixture;
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
select qualification_id,provider_service_id,provider_organization_id,'fa124000-0000-4000-8000-000000000004' from provider_fixture;
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
select qualification_decision_id,qualification_id,provider_organization_id,'fa124000-0000-4000-8000-000000000004',1,'APPROVED','f1554300-0000-4000-8000-000000000001',questionnaire_session_id,8000,jsonb_build_array('IDENTITY'),'[]','Qualification équivalente','ROTATION-V1',now()-interval '1 day',now()+interval '1 year','fa120000-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
update public.provider_qualifications q set current_decision_id=f.qualification_decision_id from provider_fixture f where q.id=f.qualification_id;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
select provider_organization_id,'fa124000-0000-4000-8000-000000000004',1,'AVAILABLE',5,2,now()-interval '1 day','Capacité équivalente','fa120000-0000-4000-8000-000000000001' from provider_fixture;


set local session_replication_role=origin;
create temporary table contract_results(k text primary key,v jsonb);grant all on contract_results to authenticated;
create function pg_temp.contract220_generate(p_key text)returns jsonb language sql security invoker as $$
 select public.generate_selected_quote_contract_v1('fa125000-0000-4000-8000-000000000001',(select(value->>'quote_version_id')::uuid from anchor_quote_result),(select(v->>'row_version')::integer from contract_results where k='expected_request'),(select(v->>'policy_version_id')::uuid from contract_results where k='template'),(select(v->>'policy_version_id')::uuid from contract_results where k='commission'),'Génération canonique approuvée en fixture seulement',p_key)
$$;
select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);set local role authenticated;
insert into contract_results values('compare',public.compare_quotes('fa127000-0000-4000-8000-000000000001','contract220-compare'));
select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Offre choisie pour la fixture contractuelle',(select(v->>'comparison_snapshot_id')::uuid from contract_results where k='compare'),'contract220-select');
insert into contract_results values('expected_request',jsonb_build_object('row_version',(select row_version from public.service_requests where id='fa125000-0000-4000-8000-000000000001')));
insert into contract_results values('empty_context',public.get_selected_quote_contract_context_v1('fa125000-0000-4000-8000-000000000001'));
select is((select v->>'can_generate'from contract_results where k='empty_context'),'false','no approved policies means no new contract');
reset role;
select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into contract_results values('template',public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_CONTRACT_220','version',1,'library_id','fa124000-0000-4000-8000-000000000001','service_id','fa124000-0000-4000-8000-000000000004','country_code','MA','title_fr','Clauses synthétiques de fixture','title_ar','بنود اختبار فقط','clauses',jsonb_build_object('fr','TEXTE SYNTHÉTIQUE TEST UNIQUEMENT : aucun contrat de production.','ar','نص اصطناعي للاختبار فقط: لا عقد إنتاجي.'),'valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-LEGAL-REFERENCE-220'),'contract220-template'));
insert into contract_results values('commission',public.create_contract_policy_version_v1(jsonb_build_object('kind','COMMISSION','code','TEST_COMMISSION_220','version',1,'library_id','fa124000-0000-4000-8000-000000000001','service_id','fa124000-0000-4000-8000-000000000004','currency','MAD','country_code','MA','title_fr','Commission de fixture uniquement','title_ar','عمولة اختبار فقط','basis_points',750,'basis_code','CONFIRMED_CLIENT_RECEIPT_AMOUNT','valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-FINANCE-REFERENCE-220'),'contract220-commission'));
select throws_ok($$select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from contract_results where k='template'),true,'Auto approbation refusée de fixture','contract220-self')$$,'42501','CONTRACT_POLICY_INDEPENDENT_APPROVER_REQUIRED','creator cannot invent their own legal approval');
reset role;
select set_config('request.jwt.claim.sub','f2120000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from contract_results where k='template'),true,'Validation juridique synthétique réservée à cette fixture','contract220-template-approve');
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from contract_results where k='commission'),true,'Validation financière synthétique réservée à cette fixture','contract220-commission-approve');
reset role;
set local session_replication_role=replica;
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by)values('f2020000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','f2020000-0000-4000-9000-000000000001','MONTHLY','PAYPAL','contract220-capture-hold',10000,'MAD','contract220-capture-hold',repeat('a',64),'f2020000-0000-4000-9000-000000000002','a2200000-0000-4000-8000-000000000001');
insert into public.subscription_payment_events(payment_intent_id,organization_id,gateway,provider_event_id,provider_intent_id,event_type,amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,activation_result,correlation_id)values('f2020000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000001','PAYPAL','contract220-capture-event','contract220-capture-hold','PAYMENT_SUCCEEDED',10000,'MAD',now(),'HOLD-202',repeat('a',64),repeat('a',64),'{}','f2020000-0000-4000-9000-000000000002');
set local session_replication_role=origin;
insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)select id,organization_id,true,'REFUND_REQUESTED'from public.subscription_payment_events where provider_event_id='contract220-capture-event';
select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select pg_temp.contract220_generate('contract220-hold-denied')$$,'55000','CLIENT_FINANCIAL_HOLD_ACTIVE','refund hold after quote selection blocks new legal commitment');
reset role;
select is((select count(*)from public.contracts where client_organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'hold leaves no partial contract');
select is((select count(*)from public.event_outbox where event_type='ContractGeneratedV1'and organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'hold emits no contract-generated event');
update public.subscription_financial_holds set active=false,reason_code='DISPUTE_WON',updated_at=clock_timestamp()where organization_id='fa122000-0000-4000-8000-000000000001';
update public.organization_identifiers set verification_status='PENDING'where organization_id='fa122000-0000-4000-8000-000000000001'and identifier_type='ICE';
set local role authenticated;
select throws_ok($$select pg_temp.contract220_generate('contract220-identity-denied')$$,'55000','VERIFIED_LEGAL_PARTIES_REQUIRED','unverified Client ICE after selection blocks contract');
reset role;
select is((select count(*)from public.contracts where client_organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'identity refusal leaves no partial contract');
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='fa122000-0000-4000-8000-000000000001'and identifier_type='ICE';
update public.organization_identifiers set verification_status='PENDING'where organization_id='fa122000-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
select throws_ok($$select pg_temp.contract220_generate('contract220-provider-identity-denied')$$,'55000','PROVIDER_NOT_ELIGIBLE_FOR_NEW_COMMITMENT','unverified Provider identity blocks engagement after selection');
reset role;
select is((select count(*)from public.contracts where client_organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'Provider identity refusal creates no contract');
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='fa122000-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
insert into contract_results values('draft',pg_temp.contract220_generate('contract220-generate'));
insert into contract_results values('replay',pg_temp.contract220_generate('contract220-generate'));
reset role;
select is((select v->>'outcome'from contract_results where k='draft'),'SELECTED_QUOTE_CONTRACT_DRAFTED','selected quote produces an actual immutable draft');
select is((select v from contract_results where k='draft'),(select v from contract_results where k='replay'),'replay returns the same contract and hash');
select is((select count(*)from public.contracts where client_organization_id='fa122000-0000-4000-8000-000000000001'),1::bigint,'exactly one contract is created');
select is((select price_minor::text from public.contract_versions where id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')),'12000','price comes from exact selected quote totals');
select is((select commission_rule_snapshot->>'commission_basis_points'from public.contract_versions where id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')),'750','commission comes from independently approved policy');
select is((select count(*)from public.contract_parties where contract_version_id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')and legal_snapshot->>'schema_version'='1'),2::bigint,'both verified parties have versioned frozen snapshots');
select is((select legal_snapshot->>'registered_address'from public.contract_parties where contract_version_id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')and party_role='PROVIDER'),'TEST provider registered address','Provider address comes from the quote anchor');
select is((select count(*)from public.event_outbox where event_type='ContractGeneratedV1'and organization_id='fa122000-0000-4000-8000-000000000001'),1::bigint,'replay does not duplicate the event');
set local role authenticated;
select throws_ok($$select public.generate_contract('fa122000-0000-4000-8000-000000000001','fa122000-0000-4000-8000-000000000002','{}','{}','{}',1,'MAD','{}','{}','{}','Bypass JSON libre refusé','contract220-legacy-denied')$$,'55000','CANONICAL_SELECTED_QUOTE_CONTRACT_REQUIRED','legacy JSON cannot bypass canonical contract generation');
reset role;
select is((select count(*)from public.client_trials where organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'draft generation never issues a trial');
select is((select count(*)from public.credit_ledger_entries where organization_id='fa122000-0000-4000-8000-000000000001'),0::bigint,'draft generation never issues or consumes credits');
set local role authenticated;
select throws_ok($$select public.get_admin_contract_policy_console_v1(1)$$,'42501','CONTRACT_POLICY_CONSOLE_DENIED','Client cannot read the administrative policy registry');
select set_config('request.jwt.claim.sub','f2120000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into contract_results values('console',public.get_admin_contract_policy_console_v1(1));
select throws_ok($$select public.get_admin_contract_policy_console_v1(0)$$,'22023','INVALID_PAGE','policy console rejects invalid pages');
reset role;
select is((select jsonb_array_length(v->'policies')from contract_results where k='console'),2,'policy console exposes actual immutable versions and decisions');
select ok((select jsonb_array_length(v->'libraries')>0 and jsonb_array_length(v->'services')>0 from contract_results where k='console'),'policy creation uses authoritative catalogue choices');


-- Subsequent commands use genuine party roles and an actual centrally reviewed
-- legal revision. Historical quote/selection rows remain untouched.
insert into public.organization_member_roles(membership_id,role_code)values('fa123000-0000-4000-8000-000000000001','PROVIDER_OWNER');
create temporary table refresh238(k text primary key,v jsonb);grant all on refresh238 to authenticated,service_role;
insert into refresh238 values('old_selection',(select to_jsonb(d)from public.quote_selection_decisions d where rfq_id='fa127000-0000-4000-8000-000000000001')),('old_anchor',(select to_jsonb(a)from public.provider_quote_identity_snapshots a where quote_version_id=(select(value->>'quote_version_id')::uuid from anchor_quote_result))),('old_contract',(select to_jsonb(v)from public.contract_versions v where id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')));
set local role authenticated;select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result))$$,'42501','QUOTE_IDENTITY_SCOPE_DENIED','new legal-party projection requires actual AAL2');
select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into refresh238 values('initial',public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result)));
select is((select v->>'original_provider_current'from refresh238 where k='initial'),'true','initial selected anchor remains current');
select throws_ok($$select public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='initial'),'TEST new registered address','TEST Client cannot impersonate the Provider','refresh238-wrong-party')$$,'42501','QUOTE_IDENTITY_PROPOSAL_DENIED','Client cannot propose Provider identity');
reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2380000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','refresh238-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('a2380000-0000-4000-8000-000000000003','SUPER_ADMIN');
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)
select 'e2380000-0000-4000-8000-000000000001',id,'MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION',id::text,repeat('a',64),jsonb_build_object('intent','CHANGE_CONFIGURATION','extendedIdentity',true,'expectedRowVersion',row_version,'expectedIdentityHash',private.canonical_request_hash(private.admin_organization_identity_edit_snapshot_v1(id)),'expectedIce',(select normalized_value from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'and is_active),'ice',(select normalized_value from public.organization_identifiers where organization_id=o.id and identifier_type='ICE'and is_active),'legalName',legal_name,'country',country_code,'ifNumber','99238002','rcNumber',(select normalized_value from public.organization_identifiers where organization_id=o.id and identifier_type='RC'and is_active)),'TEST Provider fiscal identity revision after draft',2,'AUTHORIZED','a2200000-0000-4000-8000-000000000002'from public.organizations o where id='fa122000-0000-4000-8000-000000000002';
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select x.id,'APPROVE','TEST independent fiscal identity review',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u where x.id='e2380000-0000-4000-8000-000000000001'and u.id in('f2120000-0000-4000-8000-000000000002','a2380000-0000-4000-8000-000000000003');
set local role service_role;select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into refresh238 values('revision',public.execute_admin_operational_action_v1('e2380000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));reset role;
select is((select v->>'outcome'from refresh238 where k='revision'),'ADMIN_ACTION_EXECUTED','real reviewed fiscal mutation executes after the original draft');
select ok(not private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'old Provider review no longer permits a new commitment');
set local role authenticated;select set_config('request.jwt.claim.sub','f2120000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into refresh238 values('review',public.get_provider_identity_review_context_v1('fa122000-0000-4000-8000-000000000002'));
insert into refresh238 select'revalidated',public.revalidate_provider_identity_v1('fa122000-0000-4000-8000-000000000002',(v->>'organization_row_version')::integer,(v->>'profile_row_version')::integer,v->>'identity_hash',(v->>'company_decision_id')::uuid,'TEST new fiscal identity confirmed against three real CLEAN pieces',extensions.gen_random_uuid())from refresh238 where k='review';
reset role;
select ok(private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'fresh review restores current Provider identity');
set local role authenticated;select set_config('request.jwt.claim.sub','fa120000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into refresh238 values('current',public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result)));
select is((select v->>'original_provider_current'from refresh238 where k='current'),'false','a new verified identity never rewrites or revives the original quote anchor');
select throws_ok($$select public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='initial'),'TEST new registered address','TEST refuse stale displayed legal parties','refresh238-stale')$$,'40001','STALE_QUOTE_IDENTITY_CONTEXT','proposal binds the exact displayed identities and selected commercial terms');
insert into refresh238 values('proposal',public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='current'),'TEST newly confirmed Provider registered address','TEST explicit reconfirmation after fiscal review','refresh238-propose'));
insert into refresh238 values('proposal_replay',public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='current'),'TEST newly confirmed Provider registered address','TEST explicit reconfirmation after fiscal review','refresh238-propose'));
select is((select v from refresh238 where k='proposal'),(select v from refresh238 where k='proposal_replay'),'proposal replay preserves one immutable proof');
select throws_ok($$select public.respond_selected_quote_identity_reconfirmation_v1((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),(select v->>'content_hash'from refresh238 where k='proposal'),'ACCEPT','TEST Provider cannot accept for Client','refresh238-self')$$,'42501','QUOTE_IDENTITY_INDEPENDENT_CLIENT_REQUIRED','Provider cannot accept on behalf of Client');
reset role;
create function pg_temp.refresh238_execute(p_proposal uuid,p_key text,p_context text default null)returns jsonb language sql as $$select public.refresh_selected_quote_contract_draft_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'),(select(v->>'contract_version_id')::uuid from contract_results where k='draft'),(select v->>'content_hash'from contract_results where k='draft'),coalesce(p_context,(select v->>'context_hash'from refresh238 where k='current')),p_proposal,'TEST refresh only legal identity while preserving commercial offer',p_key)$$;
set local role authenticated;select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select pg_temp.refresh238_execute(null,'refresh238-unaccepted')$$,'55000','ACCEPTED_CURRENT_QUOTE_IDENTITY_REQUIRED','a stale Provider anchor needs actual independent Client acceptance');
insert into refresh238 values('accept',public.respond_selected_quote_identity_reconfirmation_v1((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),(select v->>'content_hash'from refresh238 where k='proposal'),'ACCEPT','TEST Client confirms the exact new legal parties','refresh238-accept'));
insert into refresh238 values('accept_replay',public.respond_selected_quote_identity_reconfirmation_v1((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),(select v->>'content_hash'from refresh238 where k='proposal'),'ACCEPT','TEST Client confirms the exact new legal parties','refresh238-accept'));
select is((select v from refresh238 where k='accept'),(select v from refresh238 where k='accept_replay'),'independent acceptance replay preserves the exact immutable proof');
select throws_ok($$select public.refresh_selected_quote_contract_draft_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'),null,(select v->>'content_hash'from contract_results where k='draft'),(select v->>'context_hash'from refresh238 where k='current'),(select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),'TEST reject nullable contract CAS before any effect','refresh238-null-cas')$$,'22023','INVALID_CONTRACT_DRAFT_REFRESH','nullable expected version never bypasses draft CAS');
reset role;
update refresh238 set k='proposal_previous'where k='proposal';
set local role authenticated;select set_config('request.jwt.claim.sub','fa120000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into refresh238 values('proposal',public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='current'),'TEST final confirmed Provider registered address','TEST subsequent explicit correction of registered address','refresh238-propose-latest'));
reset role;
set local role authenticated;select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.respond_selected_quote_identity_reconfirmation_v1((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),(select v->>'content_hash'from refresh238 where k='proposal'),'ACCEPT','TEST Client confirms this final displayed legal address','refresh238-accept-latest');
insert into refresh238 values('effective_context',public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result)));
select is((select count(*)from refresh238,jsonb_array_elements(v->'proposals')p where k='effective_context'and(p->>'effective')::boolean),1::bigint,'exactly one current acceptance is authoritative despite multiple accepted addresses');
select throws_ok($$select pg_temp.refresh238_execute((select(v->>'proposal_id')::uuid from refresh238 where k='proposal_previous'),'refresh238-old-address')$$,'55000','ACCEPTED_CURRENT_QUOTE_IDENTITY_REQUIRED','a previously accepted address cannot replace the latest accepted correction');
select throws_ok($$select pg_temp.refresh238_execute((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),'refresh238-bad-context',repeat('f',64))$$,'40001','STALE_QUOTE_IDENTITY_CONTEXT','refresh also binds the identities actually shown to Client');
insert into refresh238 values('unprepared',public.create_signature_envelope((select(v->>'contract_id')::uuid from contract_results where k='draft'),(select(v->>'contract_version_id')::uuid from contract_results where k='draft'),'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','TEST-unsigned.pdf','test-signatures/refresh238-unsigned.pdf',repeat('e',64),'refresh238-unprepared'));
insert into refresh238 values('refreshed',pg_temp.refresh238_execute((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),'refresh238-execute'));
insert into refresh238 values('refresh_replay',pg_temp.refresh238_execute((select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),'refresh238-execute'));
select is((select v from refresh238 where k='refreshed'),(select v from refresh238 where k='refresh_replay'),'same refresh key returns the same new immutable version');
select is((select v->>'archived_unprepared_envelopes'from refresh238 where k='refreshed'),'1','a real never-prepared envelope is locally archived with proof');
select is((select v->>'version'from refresh238 where k='refreshed'),'2','draft legal refresh appends exactly version two');
reset role;
select ok(private.signature_envelope_void_is_recorded_v1((select(v->>'envelope_id')::uuid from refresh238 where k='unprepared')),'archival produces the signature domain authoritative immutable proof');
select ok((select to_jsonb(v)=old.v from public.contract_versions v join refresh238 old on old.k='old_contract'where v.id=(select(v->>'contract_version_id')::uuid from contract_results where k='draft')),'original contract version remains byte-for-byte immutable');
select ok((select to_jsonb(d)=old.v from public.quote_selection_decisions d join refresh238 old on old.k='old_selection'where d.rfq_id='fa127000-0000-4000-8000-000000000001'),'original commercial selection remains byte-for-byte immutable');
select ok((select to_jsonb(a)=old.v from public.provider_quote_identity_snapshots a join refresh238 old on old.k='old_anchor'where a.quote_version_id=(select(value->>'quote_version_id')::uuid from anchor_quote_result)),'original submitted Provider quote identity remains immutable');
select ok((select new.price_minor=old.price_minor and new.currency=old.currency and new.clauses=old.clauses and new.commission_rule_snapshot=old.commission_rule_snapshot and new.quote_snapshot=old.quote_snapshot and new.request_snapshot=old.request_snapshot from public.contract_versions new join public.contract_versions old on old.contract_id=new.contract_id and old.version=1 where new.id=(select(v->>'contract_version_id')::uuid from refresh238 where k='refreshed')),'all commercial terms and approved policies are copied exactly');
select is((select legal_snapshot#>>'{identifiers,IF}'from public.contract_parties where contract_version_id=(select(v->>'contract_version_id')::uuid from refresh238 where k='refreshed')and party_role='PROVIDER'),'99238002','new version contains the actual newly verified fiscal identity');
set local role authenticated;
select is(public.get_selected_quote_contract_context_v1('fa125000-0000-4000-8000-000000000001')#>>'{existing_contract,contract_version_id}',(select v->>'contract_version_id'from refresh238 where k='refreshed'),'request context opens the real current refreshed version');
reset role;
select is((select count(*)from public.event_outbox where event_type='ContractGeneratedV1'and organization_id='fa122000-0000-4000-8000-000000000001'),1::bigint,'refresh never reissues the original generation event or its side effects');
select is(private.recompute_contract_document_source_hash_v1((select(v->>'contract_version_id')::uuid from contract_results where k='draft')),(select v->>'content_hash'from contract_results where k='draft'),'document source validates the immutable original despite later identity changes');
select is(private.recompute_contract_document_source_hash_v1((select(v->>'contract_version_id')::uuid from refresh238 where k='refreshed')),(select v->>'content_hash'from refresh238 where k='refreshed'),'document source recomposes the refreshed hash and verifies its parent and acceptance ledger');
select is(private.recompute_contract_document_source_hash_v1('ffffffff-ffff-4fff-8fff-ffffffffffff'),null::text,'unrecognized document versions have no trusted canonical source');
select is((select count(*)from public.event_outbox where event_type='SelectedQuoteIdentityProposedV1'and organization_id='fa122000-0000-4000-8000-000000000002'),2::bigint,'proposal replay never duplicates its correlated Outbox fact');
select is((select count(*)from public.event_outbox where event_type='SelectedQuoteIdentityRespondedV1'and organization_id='fa122000-0000-4000-8000-000000000001'),2::bigint,'acceptance emits an actual separate Outbox fact');
select is((select count(*)from public.event_outbox where event_type='SelectedQuoteContractDraftRefreshedV1'and organization_id='fa122000-0000-4000-8000-000000000001'),1::bigint,'refresh replay emits exactly one configuration fact without economic reissuance');
-- Exercise a real history exceeding one page without moving the effective
-- accepted proof into an arbitrary UI page.
set local role authenticated;select set_config('request.jwt.claim.sub','fa120000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fa120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.propose_selected_quote_identity_reconfirmation_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),(select v->>'context_hash'from refresh238 where k='current'),'TEST pending alternative registered address '||i,'TEST pending proposal for actual paginated history '||i,'refresh238-history-'||i)from generate_series(1,26)i;
reset role;
set local role authenticated;select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into refresh238 values('page1',public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),1)),('page2',public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),2));
select is((select jsonb_array_length(v->'proposals')from refresh238 where k='page1'),25,'first legal proposal history page is actually bounded to25 rows');
select is((select jsonb_array_length(v->'proposals')from refresh238 where k='page2'),3,'second history page contains all remaining proposals');
select is((select count(distinct p->>'id')from refresh238,jsonb_array_elements(v->'proposals')p where k in('page1','page2')),28::bigint,'two real pages cover all proposals without duplicates');
select is((select v#>>'{effective_proposal,id}'from refresh238 where k='page1'),(select v->>'proposal_id'from refresh238 where k='proposal'),'effective acceptance is available even when its history row is off the current page');
select throws_ok($$select public.get_selected_quote_identity_reconfirmation_context_v1((select(value->>'quote_version_id')::uuid from anchor_quote_result),0)$$,'22023','INVALID_QUOTE_IDENTITY_PAGE','invalid history pages fail explicitly');
reset role;
-- Run policy preparation as a separate SQL instruction before completing the contract.
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
create function pg_temp.prepare_governed_mock_envelope238_v1(p_contract_id uuid,p_client_signer uuid,p_provider_signer uuid,p_policy_proposer uuid,p_policy_reviewer uuid,p_key text)returns jsonb language plpgsql as $$
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
 return envelope||jsonb_build_object('client_signer_id',s_client,'provider_signer_id',s_provider);
end$$;

select pg_temp.prepare_governed_mock_policy_v1('fa122000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000002','f2120000-0000-4000-8000-000000000002','refresh238-final-signature');
insert into refresh238 values('ready',pg_temp.prepare_governed_mock_envelope238_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'),'a2200000-0000-4000-8000-000000000001','fa120000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000002','f2120000-0000-4000-8000-000000000002','refresh238-final-signature'));
create function pg_temp.refresh238_current(p_key text)returns jsonb language sql as $$select public.refresh_selected_quote_contract_draft_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'),(select(v->>'contract_version_id')::uuid from refresh238 where k='refreshed'),(select v->>'content_hash'from refresh238 where k='refreshed'),(select v->>'context_hash'from refresh238 where k='current'),(select(v->>'proposal_id')::uuid from refresh238 where k='proposal'),'TEST no refresh of a signature that is already prepared or complete',p_key)$$;
set local role authenticated;
select throws_ok($$select pg_temp.refresh238_current('refresh238-ready-denied')$$,'55000','CONTRACT_SIGNATURE_PREVENTS_DRAFT_REFRESH','a genuinely prepared READY envelope prevents refreshing its exact source');
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.run_mock_signature_provider((select(v->>'envelope_id')::uuid from refresh238 where k='ready'),'SENT',null,'refresh238-real-sdk-sent');
select public.run_mock_signature_provider((select(v->>'envelope_id')::uuid from refresh238 where k='ready'),'SIGNER_SIGNED',(select(v->>'client_signer_id')::uuid from refresh238 where k='ready'),'refresh238-real-sdk-client-signed');
select public.run_mock_signature_provider((select(v->>'envelope_id')::uuid from refresh238 where k='ready'),'SIGNER_SIGNED',(select(v->>'provider_signer_id')::uuid from refresh238 where k='ready'),'refresh238-real-sdk-provider-signed');
select ok(private.contract_version_signature_effective_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'),(select(v->>'contract_version_id')::uuid from refresh238 where k='refreshed')),'both actual governed development mock callbacks bind the refreshed version');
select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select pg_temp.refresh238_current('refresh238-signed-denied')$$,'55000','CONTRACT_SIGNATURE_PREVENTS_DRAFT_REFRESH','a genuinely completed signature remains immutable and cannot be refreshed');
reset role;
select is((select count(*)from public.contract_versions where contract_id=(select(v->>'contract_id')::uuid from contract_results where k='draft')),2::bigint,'READY and completed signature refusals create no extra contract versions');
select*from finish();rollback;
