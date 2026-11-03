begin;
set local search_path=public,private,extensions;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-ONLY-contract220-explicit-dev',configured_at=clock_timestamp()where singleton;
select no_plan();
grant usage on schema extensions to authenticated;
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
reset role;
-- SQL-only Storage metadata fixtures below exercise ACL/transactional binding.
-- They never certify real file bytes; native readback is exercised in HTTP/archive tests.
create temporary table archive241(k text primary key,v jsonb);grant all on archive241 to authenticated,service_role;
select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into archive241 values('source',public.get_contract_signature_document_source_v1((select(v->>'contract_id')::uuid from contract_results where k='draft')));
select is((select v->>'source_hash'from archive241 where k='source'),(select v->>'content_hash'from contract_results where k='draft'),'source hash is recomposed from real approved quote/parties/policies');
select is((select v->>'price_minor'from archive241 where k='source'),'12000','price is an exact string from the selected immutable quote');
select is((select jsonb_array_length(v->'parties')from archive241 where k='source'),2,'both frozen parties are provided');
select ok((select length(v->'clauses'->>'ar')>10 from archive241 where k='source'),'Arabic approved clauses are retained, not invented');
select is(public.get_signature_document_archive_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),'fr'),null::jsonb,'no metadata means no claimed archived PDF');
select throws_ok($$select public.register_signature_document_archive_pair_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),'a2200000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'SIGNATURE_SOURCE_PDF_V1','[]')$$,'42501',null,'browser cannot attest a Storage archive');
reset role;
select ok(not has_function_privilege('anon','public.get_contract_signature_document_source_v1(uuid,uuid)','EXECUTE'),'anonymous source access is denied');
select ok(not has_function_privilege('authenticated','public.register_signature_document_archive_pair_v1(text,uuid,uuid,text,text,text,jsonb)','EXECUTE'),'registration is service-only');
select ok(not has_function_privilege('service_role','private.signature_document_source_v1(text,uuid,uuid)','EXECUTE'),'private legal source has no direct service API grant');
select ok(not(select public from storage.buckets where id='signature-source-documents'),'actual source bucket is private');
select ok(exists(select 1 from pg_policies where schemaname='storage'and tablename='objects'and policyname='signature_source_private_only'and permissive='RESTRICTIVE'),'broad Storage policies cannot expose this bucket');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('bb410000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000000','authenticated','authenticated','archive-foreign@example.invalid','',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','bb410000-0000-4000-8000-000000000099',true);select set_config('request.jwt.claims','{"sub":"bb410000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select throws_ok($$select public.get_contract_signature_document_source_v1((select(v->>'contract_id')::uuid from contract_results where k='draft'))$$,'42501','SIGNATURE_DOCUMENT_NOT_FOUND','unrelated user cannot read canonical legal source');
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into archive241 values('pair',(select jsonb_agg(jsonb_build_object('locale',locale,'pdf_sha256',sha,'storage_path','contract/'||(v->>'source_id')||'/'||(v->>'source_hash')||'/'||locale||'/'||sha||'.pdf','size_bytes',100))from archive241 cross join(values('fr',repeat('1',64)),('ar',repeat('2',64)))p(locale,sha)where k='source'));
create function pg_temp.register241(p_pair jsonb)returns jsonb language sql as $$select public.register_signature_document_archive_pair_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),'a2200000-0000-4000-8000-000000000001',(select v->>'source_hash'from archive241 where k='source'),(select v->>'parties_hash'from archive241 where k='source'),'SIGNATURE_SOURCE_PDF_V1',p_pair)$$;
select throws_ok($$select pg_temp.register241((select v from archive241 where k='pair'))$$,'55000','SIGNATURE_ARCHIVE_OBJECT_REQUIRED','metadata cannot register missing Storage objects');
insert into storage.objects(bucket_id,name,metadata)select 'signature-source-documents',x->>'storage_path','{"mimetype":"application/pdf","size":100}'from archive241 cross join lateral jsonb_array_elements(v)x where k='pair';
select throws_ok($$select pg_temp.register241(jsonb_build_array((select v->0 from archive241 where k='pair')))$$,'23514','SIGNATURE_ARCHIVE_SOURCE_MISMATCH','one locale cannot register a partial pair');
select throws_ok($$select pg_temp.register241(jsonb_set((select v from archive241 where k='pair'),'{0,storage_path}','"../other.pdf"'))$$,'23514','SIGNATURE_ARCHIVE_INVALID_PATH','paths cannot target another source');
insert into archive241 values('registered',pg_temp.register241((select v from archive241 where k='pair')));
select is(jsonb_array_length((select v from archive241 where k='registered')),2,'both locale metadata rows commit atomically');
select is(pg_temp.register241((select v from archive241 where k='pair')),(select v from archive241 where k='registered'),'exact retry returns the same immutable artifacts');
select is((select count(*)from private.contract_signature_source_artifacts_v1 where source_id=(select(v->>'source_id')::uuid from archive241 where k='source')),2::bigint,'replay creates no duplicate artifacts');
select is((select count(*)from public.audit_events where action='signature.source_pdf_archived'and resource_id=(select v->>'contract_version_id'from archive241 where k='source')),2::bigint,'replay emits no duplicate archive audit');
select ok(private.signature_document_archive_pair_exists_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),(select(v->>'contract_version_id')::uuid from archive241 where k='source'),(select v->>'source_hash'from archive241 where k='source'),(select v->>'parties_hash'from archive241 where k='source')),'pair checks exact version/hash/parties/private objects');
update storage.buckets set public=true where id='signature-source-documents';
select ok(not private.signature_document_archive_pair_exists_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),(select(v->>'contract_version_id')::uuid from archive241 where k='source'),(select v->>'source_hash'from archive241 where k='source'),(select v->>'parties_hash'from archive241 where k='source')),'public Storage bucket cannot satisfy private archive proof');
update storage.buckets set public=false where id='signature-source-documents';
select throws_ok($$update private.contract_signature_source_artifacts_v1 set pdf_sha256=repeat('f',64)where source_id=(select(v->>'source_id')::uuid from archive241 where k='source')$$,'55000',null,'archived PDF metadata cannot be replaced');
select set_config('request.jwt.claim.sub','a2200000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select is(public.get_signature_document_archive_v1('CONTRACT',(select(v->>'source_id')::uuid from archive241 where k='source'),'ar')->>'pdf_sha256',repeat('2',64),'authenticated party reads only its exact localized archive');
reset role;
select*from finish();rollback;
