begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0212',configured_at=clock_timestamp()where singleton;
set local search_path=public,private,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('b212000c-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-provider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('MERGE212_ANCHOR_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('MERGE212_ANCHOR_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('MERGE212_ANCHOR_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('MERGE212_ANCHOR_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('b212000d-0000-4000-8000-000000000001','MA','MERGE212_ANCHOR_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('b212000d-0000-4000-8000-000000000002','MA','MERGE212_ANCHOR_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('b212000d-0000-4000-8000-000000000003','MA','MERGE212_ANCHOR_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b212000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('b212000d-0000-4000-8000-000000000004','MA','MERGE212_ANCHOR_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b212000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('b212000d-0000-4000-8000-000000000005','MA','MERGE212_ANCHOR_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b212000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b212000e-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','b212000c-0000-4000-8000-000000000001'),
('b212000e-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','b212000c-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('b212000f-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002','b212000c-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('b212000f-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('b2120010-0000-4000-8000-000000000001','MERGE212_TAX','merge212-tax','b212000e-0000-4000-8000-000000000001','DRAFT','b212000c-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('b2120010-0000-4000-8000-000000000002','b2120010-0000-4000-8000-000000000001','MERGE212_TAX_CAT','merge212-tax-cat','DRAFT','b212000c-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('b2120010-0000-4000-8000-000000000003','b2120010-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000002','MERGE212_TAX_SUB','merge212-tax-sub','DRAFT','b212000c-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('b2120010-0000-4000-8000-000000000004','b2120010-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000003','MERGE212_TAX_SERVICE','merge212-tax-service','DRAFT','b212000c-0000-4000-8000-000000000001');
-- Historical published service version matches the existing immutable RFQ hash.
-- The classification and its dated tax rule are independently governed below.
set local session_replication_role=replica;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('b2120010-0000-4000-8000-000000000005','b2120010-0000-4000-8000-000000000004','b2120010-0000-4000-8000-000000000001',1,'PUBLISHED','Service historique de recette212','خدمة تاريخية للاختبار212','Référence synthétique de recette','مرجع اصطناعي للاختبار','Précondition publiée pour une consultation historique','شرط منشور لاستشارة تاريخية','CONSULTING','mission','مهمة',1,'Source historique publiée de recette212',repeat('6',64),'b212000c-0000-4000-8000-000000000001',now()-interval'1 day','b2120010-0000-4000-8000-000000000003','MERGE212_TAX_SERVICE','merge212-tax-service');
update public.catalog_services set status='PUBLISHED',current_published_version_id='b2120010-0000-4000-8000-000000000005'where id='b2120010-0000-4000-8000-000000000004';
set local session_replication_role=origin;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('b2120011-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000004','MATCHING','b212000c-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('b2120011-0000-4000-8000-000000000002','b2120011-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA","tax_category_code":"MERGE212_ANCHOR_A"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'b212000c-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='b2120011-0000-4000-8000-000000000002' where id='b2120011-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('b2120012-0000-4000-8000-000000000001','b2120011-0000-4000-8000-000000000001','b2120011-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'b212000c-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('b2120012-0000-4000-8000-000000000002','b2120012-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('b2120013-0000-4000-8000-000000000001','b2120011-0000-4000-8000-000000000001','b2120011-0000-4000-8000-000000000002','b2120012-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'b212000c-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('b2120014-0000-4000-8000-000000000001','b2120013-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002','b2120012-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

create temporary table anchor_quote_payload(value jsonb);
insert into anchor_quote_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','b212000d-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update anchor_quote_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on anchor_quote_payload to authenticated;
create temporary table anchor_quote_result(value jsonb);grant select,insert on anchor_quote_result to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b212000a-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b212000a-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('b212000e-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','b212000c-0000-4000-8000-000000000001');
insert into public.provider_match_profiles(provider_organization_id)values('b212000e-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('b212000e-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','b212000a-0000-4000-8000-000000000002',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('b212000e-0000-4000-8000-000000000002','ICE','991212000000001'),('b212000e-0000-4000-8000-000000000002','IF','99121201'),('b212000e-0000-4000-8000-000000000002','RC','TEST-212');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='b212000a-0000-4000-8000-000000000002';org uuid:='b212000e-0000-4000-8000-000000000002';begin
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
-- No rate or approved mapping is injected for the quote under test.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b2120020-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax-source-212@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b2120020-0000-4000-8000-000000000001','FINANCE_MANAGER');
insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values('TEST_CLIENT_TAX212','Service de recette fiscale212','خدمة اختبار ضريبي212','Référence synthétique transactionnelle','مرجع اصطناعي للمعاملة','SERVICE','ACTIVE');
select set_config('request.jwt.claims','{"sub":"b2120020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax212_rule',public.propose_morocco_tax_rule(null,'TEST_CLIENT_TAX212','VAT',2000,100,'{}','TEST/212 synthetic fiscal reference','2020-01-01',null,'TEST fiscal source for canonical quote212','test-tax212-rule')::text,true);
select set_config('request.jwt.claims','{"sub":"b212000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_morocco_tax_rule(null,(current_setting('test.tax212_rule')::jsonb->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST/212/RULE','TEST independently reviewed fiscal source',1,'test-tax212-review');
select set_config('test.tax212_scope',private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','b2120010-0000-4000-8000-000000000005','MA','MAD'),true);
select set_config('request.jwt.claims','{"sub":"b2120020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax212_mapping',public.propose_service_tax_category_mapping_v1('b2120010-0000-4000-8000-000000000005',repeat('6',64),current_setting('test.tax212_scope'),'MA','MAD','TEST_CLIENT_TAX212',current_date,null,true,array[]::uuid[],'TEST classification for canonical quote212','b2120021-0000-4000-8000-000000000001')::text,true);
select set_config('request.jwt.claims','{"sub":"b212000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((current_setting('test.tax212_mapping')::jsonb->>'proposal_id')::uuid,current_setting('test.tax212_mapping')::jsonb->>'content_hash',true,'TEST/212/MAPPING','TEST independent classification review');
update anchor_quote_payload set value=jsonb_set(value,'{items,0,tax_rule_version_id}',to_jsonb(current_setting('test.tax212_rule')::jsonb->>'tax_rule_version_id'));
select set_config('request.jwt.claims','{"sub":"b212000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into anchor_quote_result select public.create_quote_revision('b2120014-0000-4000-8000-000000000001',(select value from anchor_quote_payload),'Initial reviewed quote','anchor-quote-create');
select is((select calculation_basis#>>'{service_tax_policy_snapshot,mapping_id}'from public.quote_versions where id=(select(value->>'quote_version_id')::uuid from anchor_quote_result)),current_setting('test.tax212_mapping')::jsonb->>'proposal_id','quote freezes the actual independently approved classification rather than legacy caller category');

select set_config('test.anchor_identity',public.get_my_provider_identity_status_v1('b212000e-0000-4000-8000-000000000002')::text,true);
select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST provider registered address','merge212-publish-anchor');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('b2120001-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','canonical-merge212-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('b2120001-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)values('b2120005-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','b2120001-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('b2120005-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b212000e-0000-4000-8000-000000000001','ICE','992212000000001','VERIFIED'),('b212000e-0000-4000-8000-000000000001','IF','99221201','VERIFIED'),('b212000e-0000-4000-8000-000000000001','RC','TEST220','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','VERIFIED',1,'b2120001-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99221201","rc_number":"TEST220","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Client fiscal test","display_name":"Client fiscal test","country_code":"MA","identifiers":{"ICE":"992212000000001","IF":"99221201","RC":"TEST220"}}',1,'b2120001-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001',1,now()-interval'1 day','b212000a-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b2120002-0000-0000-0000-000000000001','b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b212000e-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b212000a-0000-4000-8000-000000000002',clock_timestamp(),'b2120001-0000-4000-8000-000000000001'),
('b2120002-0000-0000-0000-000000000002','b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b212000e-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b212000a-0000-4000-8000-000000000002',clock_timestamp(),'b2120001-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b2120003-0000-0000-0000-000000000001','b2120002-0000-0000-0000-000000000001','b212000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2120004-0000-0000-0000-000000000001'),
('b2120003-0000-0000-0000-000000000002','b2120002-0000-0000-0000-000000000002','b212000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2120004-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b2120002-0000-0000-0000-000000000001' then 'b2120003-0000-0000-0000-000000000001'::uuid
  else 'b2120003-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b2120002-0000-0000-0000-000000000001','b2120002-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','b212000a-0000-4000-8000-000000000002',clock_timestamp(),'b2120001-0000-4000-8000-000000000001','b2120002-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('b212000b-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','b212000a-0000-4000-8000-000000000002',clock_timestamp(),'b2120001-0000-4000-8000-000000000001','b2120002-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


create temporary table provider_fixture(provider_organization_id uuid,provider_service_id uuid,questionnaire_session_id uuid,qualification_id uuid,qualification_decision_id uuid);
insert into provider_fixture values('b212000e-0000-4000-8000-000000000002','b212000b-0000-4000-8001-000000000001','b212000b-0000-4000-8001-000000000002','b212000b-0000-4000-8001-000000000003','b212000b-0000-4000-8001-000000000004');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by) values
 ('b2120006-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001','ROTATION.155.V1','DRAFT',repeat('e',64),'b212000c-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by) values
 ('b2120007-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001','ROTATION_QUESTIONNAIRE','DRAFT','b212000c-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by) values
 ('b2120008-0000-4000-8000-000000000001','b2120007-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001','b2120006-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire rotation','استبيان التناوب','Questionnaire pour preuve de rotation','استبيان لإثبات التناوب','PROVIDER','1.0.0','ROTATION-V1',repeat('f',64),'Fixture rotation','b212000c-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select provider_service_id,provider_organization_id,'b2120010-0000-4000-8000-000000000004','DECIDED','b212000c-0000-4000-8000-000000000001',now() from provider_fixture;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
select questionnaire_session_id,provider_organization_id,'b212000c-0000-4000-8000-000000000001','b2120010-0000-4000-8000-000000000001','b2120006-0000-4000-8000-000000000001','b2120008-0000-4000-8000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('1',64) from provider_fixture;
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
select qualification_id,provider_service_id,provider_organization_id,'b2120010-0000-4000-8000-000000000004' from provider_fixture;
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
select qualification_decision_id,qualification_id,provider_organization_id,'b2120010-0000-4000-8000-000000000004',1,'APPROVED','b2120008-0000-4000-8000-000000000001',questionnaire_session_id,8000,jsonb_build_array('IDENTITY'),'[]','Qualification équivalente','ROTATION-V1',now()-interval '1 day',now()+interval '1 year','b212000c-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
update public.provider_qualifications q set current_decision_id=f.qualification_decision_id from provider_fixture f where q.id=f.qualification_id;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
select provider_organization_id,'b2120010-0000-4000-8000-000000000004',1,'AVAILABLE',5,2,now()-interval '1 day','Capacité équivalente','b212000c-0000-4000-8000-000000000001' from provider_fixture;


set local session_replication_role=origin;
create temporary table amend_results(k text primary key,v jsonb);grant all on amend_results to authenticated;
create function pg_temp.merge212_generate(p_key text)returns jsonb language sql security invoker as $$
 select public.generate_selected_quote_contract_v1('b2120011-0000-4000-8000-000000000001',(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.expected_contract_0212')::integer,(select(v->>'policy_version_id')::uuid from amend_results where k='template'),(select(v->>'policy_version_id')::uuid from amend_results where k='commission'),'Génération canonique approuvée en fixture seulement',p_key)
$$;
select set_config('request.jwt.claims','{"sub":"b2120001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','b2120001-0000-4000-8000-000000000001',true);set local role authenticated;
insert into amend_results values('compare',public.compare_quotes('b2120013-0000-4000-8000-000000000001','merge212-compare'));
select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Offre choisie pour la fixture contractuelle',(select(v->>'comparison_snapshot_id')::uuid from amend_results where k='compare'),'merge212-select');
select set_config('test.expected_contract_0212',(select row_version::text from public.service_requests where id='b2120011-0000-4000-8000-000000000001'),true);
insert into amend_results values('empty_context',public.get_selected_quote_contract_context_v1('b2120011-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub','b2120001-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b2120001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into amend_results values('template',public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_AMEND_210','version',1,'library_id','b2120010-0000-4000-8000-000000000001','service_id','b2120010-0000-4000-8000-000000000004','country_code','MA','title_fr','Clauses synthétiques de fixture','title_ar','بنود اختبار فقط','clauses',jsonb_build_object('fr','TEXTE SYNTHÉTIQUE TEST UNIQUEMENT : aucun contrat de production.','ar','نص اصطناعي للاختبار فقط: لا عقد إنتاجي.'),'valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-LEGAL-REFERENCE-220'),'merge212-template'));
insert into amend_results values('commission',public.create_contract_policy_version_v1(jsonb_build_object('kind','COMMISSION','code','TEST_AMEND_COMMISSION_210','version',1,'library_id','b2120010-0000-4000-8000-000000000001','service_id','b2120010-0000-4000-8000-000000000004','currency','MAD','country_code','MA','title_fr','Commission de fixture uniquement','title_ar','عمولة اختبار فقط','basis_points',750,'basis_code','CONFIRMED_CLIENT_RECEIPT_AMOUNT','valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-FINANCE-REFERENCE-220'),'merge212-commission'));
reset role;
select set_config('request.jwt.claim.sub','b212000a-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b212000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='template'),true,'Validation juridique synthétique réservée à cette fixture','merge212-template-approve');
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='commission'),true,'Validation financière synthétique réservée à cette fixture','merge212-commission-approve');
reset role;
set local session_replication_role=replica;
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by)values('b2120009-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','b2120009-0000-4000-9000-000000000001','MONTHLY','PAYPAL','merge212-capture-hold',10000,'MAD','merge212-capture-hold',repeat('a',64),'b2120009-0000-4000-9000-000000000002','b2120001-0000-4000-8000-000000000001');
insert into public.subscription_payment_events(payment_intent_id,organization_id,gateway,provider_event_id,provider_intent_id,event_type,amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,activation_result,correlation_id)values('b2120009-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000001','PAYPAL','merge212-capture-event','merge212-capture-hold','PAYMENT_SUCCEEDED',10000,'MAD',now(),'HOLD-202',repeat('a',64),repeat('a',64),'{}','b2120009-0000-4000-9000-000000000002');
set local session_replication_role=origin;
insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)select id,organization_id,true,'REFUND_REQUESTED'from public.subscription_payment_events where provider_event_id='merge212-capture-event';
select set_config('request.jwt.claim.sub','b2120001-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b2120001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
reset role;
update public.subscription_financial_holds set active=false,reason_code='DISPUTE_WON',updated_at=clock_timestamp()where organization_id='b212000e-0000-4000-8000-000000000001';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b212000e-0000-4000-8000-000000000001'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b212000e-0000-4000-8000-000000000001'and identifier_type='ICE';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b212000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b212000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
insert into amend_results values('draft',pg_temp.merge212_generate('merge212-generate'));
insert into amend_results values('replay',pg_temp.merge212_generate('merge212-generate'));
reset role;
-- An unused duplicate with a historical inactive ICE, plus an existing active
-- canonical Provider with real reviewed qualification and business history.
insert into public.organizations(id,legal_name,display_name,status,created_by)values
 ('a2120000-0000-4000-8000-000000000001','Doublon inutilisé fixture','Doublon inutilisé','PENDING','b2120001-0000-4000-8000-000000000001'),
 ('a2120000-0000-4000-8000-000000000002','Source historique fixture','Source historique','PENDING','b2120001-0000-4000-8000-000000000001');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values
 ('a2120000-0000-4000-8000-000000000001','ICE','991212000000001','PENDING',false),
 ('a2120000-0000-4000-8000-000000000002','ICE','991212000000001','PENDING',false);
insert into public.organization_memberships(id,organization_id,user_id,status)values('a2120000-0000-4000-8000-000000000101','a2120000-0000-4000-8000-000000000001','b2120001-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('a2120000-0000-4000-8000-000000000101','CLIENT_OWNER');
insert into public.credit_wallets(id,organization_id,wallet_type)values('a2120000-0000-4000-8000-000000000102','a2120000-0000-4000-8000-000000000002','CLIENT');
select set_config('test.target_members212',(select coalesce(jsonb_agg(to_jsonb(m)order by m.id),'[]')::text from public.organization_memberships m where organization_id='b212000e-0000-4000-8000-000000000002'),true);
select set_config('test.target_contracts212',(select coalesce(jsonb_agg(to_jsonb(c)order by c.id),'[]')::text from public.contracts c where provider_organization_id='b212000e-0000-4000-8000-000000000002'),true);
select set_config('request.jwt.claim.sub','b2120001-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b2120001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select set_config('test.context212',public.get_organization_merge_context_v1('a2120000-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002')::text,true);
select is(jsonb_array_length(current_setting('test.context212')::jsonb->'blockers'),0,'unused source is eligible even when the canonical target has business history');
select ok(jsonb_array_length(current_setting('test.context212')::jsonb->'proofs')>0,'context offers only actual verified current CLEAN legal documents');
select set_config('test.history_context212',public.get_organization_merge_context_v1('a2120000-0000-4000-8000-000000000002','b212000e-0000-4000-8000-000000000002')::text,true);
select ok(current_setting('test.history_context212')::jsonb->'blockers'?'SOURCE_HISTORY_REQUIRES_ARCHIVE_ACCESS_PLAN','a source with a wallet is an explicit archive-access exception, not silently merged');
select throws_ok($$select public.prepare_organization_merge_v1('a2120000-0000-4000-8000-000000000002','b212000e-0000-4000-8000-000000000002',current_setting('test.history_context212')::jsonb->>'context_hash','PROVIDER',(current_setting('test.history_context212')::jsonb->'proofs'->0->>'id')::uuid,'Synthetic legal reference212','Synthetic reviewed duplicate212','merge212-history-denied')$$,'55000','ORGANIZATION_MERGE_REQUIRES_EXCEPTION_PLAN','a historical source cannot be archived through this limited path');
select throws_ok($$select public.prepare_organization_merge_v1('a2120000-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002',repeat('f',64),'PROVIDER',(current_setting('test.context212')::jsonb->'proofs'->0->>'id')::uuid,'Synthetic legal reference212','Synthetic stale context212','merge212-stale-context')$$,'40001','STALE_ORGANIZATION_MERGE_CONTEXT','preparation must match the exact reviewed context version and identity');
select throws_ok($$select public.prepare_organization_merge_v1('a2120000-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002',current_setting('test.context212')::jsonb->>'context_hash','PROVIDER','a212ffff-0000-4000-8000-000000000099','Synthetic legal reference212','Synthetic unknown proof212','merge212-unknown-proof')$$,'55000','VERIFIED_LEGAL_PROOF_REQUIRED','another or unverified document cannot be substituted for the reviewed proof');
select set_config('test.exception212',public.record_organization_merge_exception_v1('a2120000-0000-4000-8000-000000000002','b212000e-0000-4000-8000-000000000002',current_setting('test.history_context212')::jsonb->>'context_hash','Revue spécifique des droits et archives nécessaire avant toute fusion','merge212-exception')::text,true);
select is(current_setting('test.exception212')::jsonb->>'outcome','ORGANIZATION_MERGE_EXCEPTION_RECORDED','historical source opens a real persistent exception without archiving');
select is(public.record_organization_merge_exception_v1('a2120000-0000-4000-8000-000000000002','b212000e-0000-4000-8000-000000000002',current_setting('test.history_context212')::jsonb->>'context_hash','Revue spécifique des droits et archives nécessaire avant toute fusion','merge212-exception'),current_setting('test.exception212')::jsonb,'exception case retry is idempotent');
select set_config('test.prepared212',public.prepare_organization_merge_v1('a2120000-0000-4000-8000-000000000001','b212000e-0000-4000-8000-000000000002',current_setting('test.context212')::jsonb->>'context_hash','PROVIDER',(current_setting('test.context212')::jsonb->'proofs'->0->>'id')::uuid,'Synthetic legal reference212','Synthetic reviewed duplicate212','merge212-prepare')::text,true);
select is(current_setting('test.prepared212')::jsonb->>'outcome','ORGANIZATION_MERGE_PREPARED','first administrator prepares a frozen legal dossier');
select throws_ok($$select public.decide_organization_merge_v1((current_setting('test.prepared212')::jsonb->>'request_id')::uuid,true,current_setting('test.prepared212')::jsonb->>'request_hash','Synthetic self approval denied212','merge212-self')$$,'42501','INDEPENDENT_MERGE_APPROVER_REQUIRED','preparer cannot approve their own merge');
select set_config('request.jwt.claim.sub','b212000a-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b212000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.decide_organization_merge_v1((current_setting('test.prepared212')::jsonb->>'request_id')::uuid,true,current_setting('test.prepared212')::jsonb->>'request_hash','Synthetic second review212','merge212-aal1')$$,'42501','ORGANIZATION_MERGE_DENIED','independent administrator also requires AAL2');
select set_config('request.jwt.claims','{"sub":"b212000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('test.merged212',public.decide_organization_merge_v1((current_setting('test.prepared212')::jsonb->>'request_id')::uuid,true,current_setting('test.prepared212')::jsonb->>'request_hash','Synthetic second review212','merge212-approve')::text,true);
select is(current_setting('test.merged212')::jsonb->>'outcome','ORGANIZATION_MERGED','independent approval archives the unused duplicate atomically');
select is(public.decide_organization_merge_v1((current_setting('test.prepared212')::jsonb->>'request_id')::uuid,true,current_setting('test.prepared212')::jsonb->>'request_hash','Synthetic second review212','merge212-approve'),current_setting('test.merged212')::jsonb,'merge replay returns the same result without another archive');
reset role;
select is((select status from public.organizations where id='a2120000-0000-4000-8000-000000000002'),'PENDING','blocked historical source remains unchanged after its exception was recorded');
select is((select count(*)::integer from public.organization_merge_exception_cases_v1 where source_organization_id='a2120000-0000-4000-8000-000000000002'),1,'one real exception record persists without pretending an archive-access plan is executed');
select is((select status from public.organizations where id='a2120000-0000-4000-8000-000000000001'),'ARCHIVED','only the source passport is archived');
select is((select status from public.organizations where id='b212000e-0000-4000-8000-000000000002'),'ACTIVE','canonical target remains active');
select is((select target_organization_id::text from public.organization_aliases_v1 where source_organization_id='a2120000-0000-4000-8000-000000000001'),'b212000e-0000-4000-8000-000000000002','traceable alias points to the exact approved canonical target');
select is((select coalesce(jsonb_agg(to_jsonb(m)order by m.id),'[]')::text from public.organization_memberships m where organization_id='b212000e-0000-4000-8000-000000000002'),current_setting('test.target_members212'),'no target membership is added or changed');
select is((select coalesce(jsonb_agg(to_jsonb(c)order by c.id),'[]')::text from public.contracts c where provider_organization_id='b212000e-0000-4000-8000-000000000002'),current_setting('test.target_contracts212'),'existing target contractual history is byte-for-byte unchanged');
select ok(not private.has_org_role('b212000e-0000-4000-8000-000000000002',array['CLIENT_OWNER','PROVIDER_OWNER'],'b2120001-0000-4000-8000-000000000001'),'source owner acquires no role in the canonical target');
select ok(not private.has_org_role('a2120000-0000-4000-8000-000000000001',array['CLIENT_OWNER'],'b2120001-0000-4000-8000-000000000001'),'archival closes source write permissions without claiming a historical user reader');
select is((select count(*)::integer from public.audit_events where action='organization.merged'and resource_id=current_setting('test.prepared212')::jsonb->>'request_id'),1,'one merge audit exists');
select is((select count(*)::integer from public.event_outbox where event_type='OrganizationMergedV1'and aggregate_id=current_setting('test.prepared212')::jsonb->>'request_id'),1,'one durable merge event exists despite replay');
select throws_ok($$insert into public.credit_wallets(organization_id,wallet_type)values('a2120000-0000-4000-8000-000000000001','CLIENT')$$,'55000','ORGANIZATION_ARCHIVED_BY_MERGE','a command that checked permissions before archival cannot insert later business facts');
select throws_ok($$update public.organizations set status='ACTIVE'where id='a2120000-0000-4000-8000-000000000001'$$,'55000','MERGED_ORGANIZATION_REACTIVATION_REQUIRES_PLAN','a legacy organization edit cannot reactivate an already merged source');
select set_config('test.merge_event212',(select id::text from public.event_outbox where event_type='OrganizationMergedV1'and aggregate_id=current_setting('test.prepared212')::jsonb->>'request_id'),true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select ok(public.verify_organization_workflow_event_v1(current_setting('test.merge_event212')::bigint,'OrganizationMergedV1',(current_setting('test.prepared212')::jsonb->>'request_id')::uuid),'outbox ACK verifies the real archive and independent decision');
select ok(not public.verify_organization_workflow_event_v1(0,'OrganizationMergedV1',(current_setting('test.prepared212')::jsonb->>'request_id')::uuid),'unknown event cannot be acknowledged as a merge');
reset role;
select ok(not has_table_privilege('authenticated','public.organization_aliases_v1','SELECT')and not has_function_privilege('authenticated','private.organization_merge_source_history_v1(uuid)','EXECUTE'),'alias is not a cross-organization authorization fallback');
select*from finish();rollback;
