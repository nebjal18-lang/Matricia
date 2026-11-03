begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0250',configured_at=clock_timestamp()where singleton;
set local search_path=public,private,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('b250000c-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-provider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('AMEND250_ANCHOR_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('AMEND250_ANCHOR_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('AMEND250_ANCHOR_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('AMEND250_ANCHOR_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('b250000d-0000-4000-8000-000000000001','MA','AMEND250_ANCHOR_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('b250000d-0000-4000-8000-000000000002','MA','AMEND250_ANCHOR_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('b250000d-0000-4000-8000-000000000003','MA','AMEND250_ANCHOR_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b250000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('b250000d-0000-4000-8000-000000000004','MA','AMEND250_ANCHOR_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b250000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('b250000d-0000-4000-8000-000000000005','MA','AMEND250_ANCHOR_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b250000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b250000e-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','b250000c-0000-4000-8000-000000000001'),
('b250000e-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','b250000c-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('b250000f-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000002','b250000c-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('b250000f-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('b2500010-0000-4000-8000-000000000001','AMEND250_TAX','amend250-tax','b250000e-0000-4000-8000-000000000001','DRAFT','b250000c-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('b2500010-0000-4000-8000-000000000002','b2500010-0000-4000-8000-000000000001','AMEND250_TAX_CAT','amend250-tax-cat','DRAFT','b250000c-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('b2500010-0000-4000-8000-000000000003','b2500010-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000002','AMEND250_TAX_SUB','amend250-tax-sub','DRAFT','b250000c-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('b2500010-0000-4000-8000-000000000004','b2500010-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000003','AMEND250_TAX_SERVICE','amend250-tax-service','DRAFT','b250000c-0000-4000-8000-000000000001');
-- Historical published service version matches the existing immutable RFQ hash.
-- The classification and its dated tax rule are independently governed below.
set local session_replication_role=replica;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('b2500010-0000-4000-8000-000000000005','b2500010-0000-4000-8000-000000000004','b2500010-0000-4000-8000-000000000001',1,'PUBLISHED','Service historique de recette250','خدمة تاريخية للاختبار250','Référence synthétique de recette','مرجع اصطناعي للاختبار','Précondition publiée pour une consultation historique','شرط منشور لاستشارة تاريخية','CONSULTING','mission','مهمة',1,'Source historique publiée de recette250',repeat('6',64),'b250000c-0000-4000-8000-000000000001',now()-interval'1 day','b2500010-0000-4000-8000-000000000003','AMEND250_TAX_SERVICE','amend250-tax-service');
update public.catalog_services set status='PUBLISHED',current_published_version_id='b2500010-0000-4000-8000-000000000005'where id='b2500010-0000-4000-8000-000000000004';
set local session_replication_role=origin;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('b2500011-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000004','MATCHING','b250000c-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('b2500011-0000-4000-8000-000000000002','b2500011-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA","tax_category_code":"AMEND250_ANCHOR_A","service_version_id":"b2500010-0000-4000-8000-000000000005"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'b250000c-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='b2500011-0000-4000-8000-000000000002' where id='b2500011-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('b2500012-0000-4000-8000-000000000001','b2500011-0000-4000-8000-000000000001','b2500011-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'b250000c-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('b2500012-0000-4000-8000-000000000002','b2500012-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('b2500013-0000-4000-8000-000000000001','b2500011-0000-4000-8000-000000000001','b2500011-0000-4000-8000-000000000002','b2500012-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'b250000c-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('b2500014-0000-4000-8000-000000000001','b2500013-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000002','b2500012-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

create temporary table anchor_quote_payload(value jsonb);
insert into anchor_quote_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','b250000d-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update anchor_quote_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on anchor_quote_payload to authenticated;
create temporary table anchor_quote_result(value jsonb);grant select,insert on anchor_quote_result to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b250000a-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b250000a-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('b250000e-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','b250000c-0000-4000-8000-000000000001');
insert into public.provider_match_profiles(provider_organization_id)values('b250000e-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('b250000e-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','b250000a-0000-4000-8000-000000000002',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('b250000e-0000-4000-8000-000000000002','ICE','991250000000001'),('b250000e-0000-4000-8000-000000000002','IF','99125001'),('b250000e-0000-4000-8000-000000000002','RC','TEST-212');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='b250000a-0000-4000-8000-000000000002';org uuid:='b250000e-0000-4000-8000-000000000002';begin
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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b2500020-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax-source-250@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b2500020-0000-4000-8000-000000000001','FINANCE_MANAGER');
insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values('TEST_CLIENT_TAX250','Service de recette fiscale250','خدمة اختبار ضريبي250','Référence synthétique transactionnelle','مرجع اصطناعي للمعاملة','SERVICE','ACTIVE');
select set_config('request.jwt.claims','{"sub":"b2500020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax250_rule',public.propose_morocco_tax_rule(null,'TEST_CLIENT_TAX250','VAT',2000,100,'{}','TEST/250 synthetic fiscal reference','2020-01-01',null,'TEST fiscal source for canonical quote250','test-tax250-rule')::text,true);
select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_morocco_tax_rule(null,(current_setting('test.tax250_rule')::jsonb->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST/250/RULE','TEST independently reviewed fiscal source',1,'test-tax250-review');
select set_config('test.tax250_scope',private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','b2500010-0000-4000-8000-000000000005','MA','MAD'),true);
select set_config('request.jwt.claims','{"sub":"b2500020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax250_mapping',public.propose_service_tax_category_mapping_v1('b2500010-0000-4000-8000-000000000005',repeat('6',64),current_setting('test.tax250_scope'),'MA','MAD','TEST_CLIENT_TAX250',current_date,null,true,array[]::uuid[],'TEST classification for canonical quote250','b2500021-0000-4000-8000-000000000001')::text,true);
select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((current_setting('test.tax250_mapping')::jsonb->>'proposal_id')::uuid,current_setting('test.tax250_mapping')::jsonb->>'content_hash',true,'TEST/250/MAPPING','TEST independent classification review');
update anchor_quote_payload set value=jsonb_set(value,'{items,0,tax_rule_version_id}',to_jsonb(current_setting('test.tax250_rule')::jsonb->>'tax_rule_version_id'));
select set_config('request.jwt.claims','{"sub":"b250000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into anchor_quote_result select public.create_quote_revision('b2500014-0000-4000-8000-000000000001',(select value from anchor_quote_payload),'Initial reviewed quote','anchor-quote-create');

select set_config('test.anchor_identity',public.get_my_provider_identity_status_v1('b250000e-0000-4000-8000-000000000002')::text,true);
select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST provider registered address','amend250-publish-anchor');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('b2500001-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','canonical-amend250-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('b2500001-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)values('b2500005-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','b2500001-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('b2500005-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b250000e-0000-4000-8000-000000000001','ICE','992250000000001','VERIFIED'),('b250000e-0000-4000-8000-000000000001','IF','99225001','VERIFIED'),('b250000e-0000-4000-8000-000000000001','RC','TEST220','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','VERIFIED',1,'b2500001-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99225001","rc_number":"TEST220","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Client fiscal test","display_name":"Client fiscal test","country_code":"MA","identifiers":{"ICE":"992250000000001","IF":"99225001","RC":"TEST220"}}',1,'b2500001-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001',1,now()-interval'1 day','b250000a-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b2500002-0000-0000-0000-000000000001','b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b250000e-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b250000a-0000-4000-8000-000000000002',clock_timestamp(),'b2500001-0000-4000-8000-000000000001'),
('b2500002-0000-0000-0000-000000000002','b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b250000e-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b250000a-0000-4000-8000-000000000002',clock_timestamp(),'b2500001-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b2500003-0000-0000-0000-000000000001','b2500002-0000-0000-0000-000000000001','b250000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2500004-0000-0000-0000-000000000001'),
('b2500003-0000-0000-0000-000000000002','b2500002-0000-0000-0000-000000000002','b250000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2500004-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b2500002-0000-0000-0000-000000000001' then 'b2500003-0000-0000-0000-000000000001'::uuid
  else 'b2500003-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b2500002-0000-0000-0000-000000000001','b2500002-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','b250000a-0000-4000-8000-000000000002',clock_timestamp(),'b2500001-0000-4000-8000-000000000001','b2500002-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('b250000b-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','b250000a-0000-4000-8000-000000000002',clock_timestamp(),'b2500001-0000-4000-8000-000000000001','b2500002-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


create temporary table provider_fixture(provider_organization_id uuid,provider_service_id uuid,questionnaire_session_id uuid,qualification_id uuid,qualification_decision_id uuid);
insert into provider_fixture values('b250000e-0000-4000-8000-000000000002','b250000b-0000-4000-8001-000000000001','b250000b-0000-4000-8001-000000000002','b250000b-0000-4000-8001-000000000003','b250000b-0000-4000-8001-000000000004');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by) values
 ('b2500006-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','ROTATION.155.V1','DRAFT',repeat('e',64),'b250000c-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by) values
 ('b2500007-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','ROTATION_QUESTIONNAIRE','DRAFT','b250000c-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by) values
 ('b2500008-0000-4000-8000-000000000001','b2500007-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','b2500006-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire rotation','استبيان التناوب','Questionnaire pour preuve de rotation','استبيان لإثبات التناوب','PROVIDER','1.0.0','ROTATION-V1',repeat('f',64),'Fixture rotation','b250000c-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select provider_service_id,provider_organization_id,'b2500010-0000-4000-8000-000000000004','DECIDED','b250000c-0000-4000-8000-000000000001',now() from provider_fixture;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
select questionnaire_session_id,provider_organization_id,'b250000c-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','b2500006-0000-4000-8000-000000000001','b2500008-0000-4000-8000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('1',64) from provider_fixture;
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
select qualification_id,provider_service_id,provider_organization_id,'b2500010-0000-4000-8000-000000000004' from provider_fixture;
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
select qualification_decision_id,qualification_id,provider_organization_id,'b2500010-0000-4000-8000-000000000004',1,'APPROVED','b2500008-0000-4000-8000-000000000001',questionnaire_session_id,8000,jsonb_build_array('IDENTITY'),'[]','Qualification équivalente','ROTATION-V1',now()-interval '1 day',now()+interval '1 year','b250000c-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
update public.provider_qualifications q set current_decision_id=f.qualification_decision_id from provider_fixture f where q.id=f.qualification_id;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
select provider_organization_id,'b2500010-0000-4000-8000-000000000004',1,'AVAILABLE',5,2,now()-interval '1 day','Capacité équivalente','b250000c-0000-4000-8000-000000000001' from provider_fixture;


set local session_replication_role=origin;
create temporary table amend_results(k text primary key,v jsonb);grant all on amend_results to authenticated;
create function pg_temp.amend250_generate(p_key text)returns jsonb language sql security invoker as $$
 select public.generate_selected_quote_contract_v1('b2500011-0000-4000-8000-000000000001',(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.expected_contract_0250')::integer,(select(v->>'policy_version_id')::uuid from amend_results where k='template'),(select(v->>'policy_version_id')::uuid from amend_results where k='commission'),'Génération canonique approuvée en fixture seulement',p_key)
$$;
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);set local role authenticated;
insert into amend_results values('compare',public.compare_quotes('b2500013-0000-4000-8000-000000000001','amend250-compare'));
select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Offre choisie pour la fixture contractuelle',(select(v->>'comparison_snapshot_id')::uuid from amend_results where k='compare'),'amend250-select');
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select set_config('request.jwt.claim.sub','b250000c-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b250000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.expected_contract_0250',(select row_version::text from public.service_requests where id='b2500011-0000-4000-8000-000000000001'),true);
insert into amend_results values('empty_context',public.get_selected_quote_contract_context_v1('b2500011-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into amend_results values('template',public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_AMEND_250','version',1,'library_id','b2500010-0000-4000-8000-000000000001','service_id','b2500010-0000-4000-8000-000000000004','country_code','MA','title_fr','Clauses synthétiques de fixture','title_ar','بنود اختبار فقط','clauses',jsonb_build_object('fr','TEXTE SYNTHÉTIQUE TEST UNIQUEMENT : aucun contrat de production.','ar','نص اصطناعي للاختبار فقط: لا عقد إنتاجي.'),'valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-LEGAL-REFERENCE-220'),'amend250-template'));
insert into amend_results values('commission',public.create_contract_policy_version_v1(jsonb_build_object('kind','COMMISSION','code','TEST_AMEND_COMMISSION_250','version',1,'library_id','b2500010-0000-4000-8000-000000000001','service_id','b2500010-0000-4000-8000-000000000004','currency','MAD','country_code','MA','title_fr','Commission de fixture uniquement','title_ar','عمولة اختبار فقط','basis_points',750,'basis_code','CONFIRMED_CLIENT_RECEIPT_AMOUNT','valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-FINANCE-REFERENCE-220'),'amend250-commission'));
reset role;
select set_config('request.jwt.claim.sub','b250000a-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='template'),true,'Validation juridique synthétique réservée à cette fixture','amend250-template-approve');
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='commission'),true,'Validation financière synthétique réservée à cette fixture','amend250-commission-approve');
reset role;
set local session_replication_role=replica;
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by)values('b2500009-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','b2500009-0000-4000-9000-000000000001','MONTHLY','PAYPAL','amend250-capture-hold',10000,'MAD','amend250-capture-hold',repeat('a',64),'b2500009-0000-4000-9000-000000000002','b2500001-0000-4000-8000-000000000001');
insert into public.subscription_payment_events(payment_intent_id,organization_id,gateway,provider_event_id,provider_intent_id,event_type,amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,activation_result,correlation_id)values('b2500009-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','PAYPAL','amend250-capture-event','amend250-capture-hold','PAYMENT_SUCCEEDED',10000,'MAD',now(),'HOLD-202',repeat('a',64),repeat('a',64),'{}','b2500009-0000-4000-9000-000000000002');
set local session_replication_role=origin;
insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)select id,organization_id,true,'REFUND_REQUESTED'from public.subscription_payment_events where provider_event_id='amend250-capture-event';
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
reset role;
update public.subscription_financial_holds set active=false,reason_code='DISPUTE_WON',updated_at=clock_timestamp()where organization_id='b250000e-0000-4000-8000-000000000001';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b250000e-0000-4000-8000-000000000001'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b250000e-0000-4000-8000-000000000001'and identifier_type='ICE';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b250000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b250000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
insert into amend_results values('draft',pg_temp.amend250_generate('amend250-generate'));
insert into amend_results values('replay',pg_temp.amend250_generate('amend250-generate'));
reset role;
-- Actual native DEV-mock transitions; synthetic transaction-only policies and
-- authorities are explicitly non-contractual and invalid under PROD retag.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2500010-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amend-signature250@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('a2500010-0000-4000-8000-000000000103','b250000e-0000-4000-8000-000000000002','a2500010-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('a2500010-0000-4000-8000-000000000103','PROVIDER_OWNER');
insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at)
select'DEVELOPMENT','CONTRACT',(select coalesce(max(version),0)+1 from private.contract_signature_policy_versions_v1 where environment='DEVELOPMENT'and source_kind='CONTRACT'),id,'SIMPLE',true,false,false,'transaction-only-synthetic-signature-policy250','transaction-only-development-adapter250','b2500001-0000-4000-8000-000000000002','b250000a-0000-4000-8000-000000000002',clock_timestamp()-interval'1 second'from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT';
do $$declare contract_ref uuid;version_ref uuid;envelope uuid;client_signer uuid;provider_signer uuid;begin
 select(v->>'contract_id')::uuid,(v->>'contract_version_id')::uuid into contract_ref,version_ref from amend_results where k='draft';
 perform set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 envelope:=(public.create_signature_envelope(contract_ref,version_ref,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','synthetic-contract250.pdf','transaction-only/contracts250.pdf',repeat('b',64),'native-envelope250')->>'envelope_id')::uuid;
 client_signer:=(public.add_signature_signer(envelope,'b250000e-0000-4000-8000-000000000001','b2500001-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest((select email::text from auth.users where id='b2500001-0000-4000-8000-000000000001'),'sha256'),'hex'),1,'native-client250')->>'signer_id')::uuid;
 perform public.authorize_signature_signer(client_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/client250.pdf',repeat('c',64),'native-client-authority250');
 provider_signer:=(public.add_signature_signer(envelope,'b250000e-0000-4000-8000-000000000002','a2500010-0000-4000-8000-000000000003','PROVIDER_OWNER',encode(extensions.digest('amend-signature250@example.invalid','sha256'),'hex'),2,'native-provider250')->>'signer_id')::uuid;
 perform set_config('request.jwt.claim.sub','a2500010-0000-4000-8000-000000000003',true);perform set_config('request.jwt.claims','{"sub":"a2500010-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.authorize_signature_signer(provider_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/provider250.pdf',repeat('d',64),'native-provider-authority250');
 perform set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 perform public.submit_contract_for_signature(contract_ref,1,'native-submit250');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.run_mock_signature_provider(envelope,'SENT',null,'native-sent250');perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',client_signer,'native-client-signed250');perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',provider_signer,'native-provider-signed250');
 perform set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
end$$;
-- The contract above was produced by the actual governed command and sealed by
-- two native DEV-mock signers. This is not a real legal signature or PSP call.
select set_config('test.contract250',(select v->>'contract_id'from amend_results where k='draft'),true);
select set_config('test.cv250',(select v->>'contract_version_id'from amend_results where k='draft'),true);
select set_config('test.snapshot250',(select private.canonical_request_hash(request_snapshot)from public.contract_versions where id=current_setting('test.cv250')::uuid),true);
select set_config('test.hash250',(select content_hash from public.contract_versions where id=current_setting('test.cv250')::uuid),true);
select ok((select request_snapshot->>'service_version_id'is null and request_snapshot#>>'{required_quote_data,service_version_id}'='b2500010-0000-4000-8000-000000000005'from public.contract_versions where id=current_setting('test.cv250')::uuid),'the real canonical contract has only the nested service version, reproducing the browser defect');
select is(private.contract_service_version_for_mission_v1(current_setting('test.cv250')::uuid),'b2500010-0000-4000-8000-000000000005'::uuid,'the nested contract source resolves through the actual immutable RFQ request');
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
create temporary table checklist250(k text primary key,result jsonb);
insert into checklist250 values('v1',public.publish_service_checklist_template('b250000e-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000005','[{"key":"DELIVERY","label_fr":"Contrôle initial","label_ar":"الفحص الأول","instructions_fr":"Vérifier le rapport initial","instructions_ar":"التحقق من التقرير الأول","proof_required":true,"proof_types":["DOCUMENT"]}]','Publication de recette version un','checklist250-publish-v1'));
insert into checklist250 values('v2',public.publish_service_checklist_template('b250000e-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000005','[{"key":"DELIVERY","label_fr":"Contrôle publié révisé","label_ar":"الفحص المنشور المعدل","instructions_fr":"Vérifier le rapport et les critères publiés","instructions_ar":"التحقق من التقرير والمعايير المنشورة","proof_required":true,"proof_types":["DOCUMENT"]}]','Publication de recette version deux','checklist250-publish-v2'));
-- A later draft is not a published executable checklist.
insert into public.service_checklist_templates(service_version_id,version,items,content_hash,created_by,publication_status)
select 'b2500010-0000-4000-8000-000000000005',3,items,repeat('d',64),'b2500001-0000-4000-8000-000000000002','DRAFT'from public.service_checklist_templates where id=(select(result->>'template_id')::uuid from checklist250 where k='v2');
select is(private.contract_mission_checklist_template_v1(current_setting('test.cv250')::uuid),(select(result->>'template_id')::uuid from checklist250 where k='v2'),'the existing publication ABI selects published v2 of the exact frozen service and ignores draft v3');
insert into public.service_request_tax_origins_v1(request_id,organization_id,service_version_id,service_content_hash,country_code,currency,tax_effective_on,origin_kind)
values('b2500011-0000-4000-8000-000000000001','b250000e-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000005',repeat('6',64),'MA','MAD',current_date,'LEGACY_EXACT_SOURCE');
select is(private.contract_service_version_for_mission_v1(current_setting('test.cv250')::uuid),'b2500010-0000-4000-8000-000000000005'::uuid,'an additive exact server origin corroborates the frozen source');
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
-- Draft-only historical ancestors were absent from this legacy fixture. Create
-- that draft input, then use real save/submit/four-eyes review/publication RPCs.
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into public.catalog_library_versions(id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,created_by)
select 'b2500030-0000-4000-8000-000000000001',id,1,'DRAFT',code,slug,'Bibliothèque de recette250','مكتبة الاختبار250','Description synthétique de recette','وصف اصطناعي للاختبار','folder',1,'Précondition brouillon historique',repeat('a',64),'b2500001-0000-4000-8000-000000000002'from public.catalog_libraries where id='b2500010-0000-4000-8000-000000000001';
insert into public.catalog_category_versions(id,category_id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,created_by)
select 'b2500030-0000-4000-8000-000000000002',id,library_id,1,'DRAFT',code,slug,'Catégorie de recette','فئة للاختبار','Description synthétique de recette','وصف اصطناعي للاختبار','folder',1,'Précondition brouillon historique',repeat('b',64),'b2500001-0000-4000-8000-000000000002'from public.catalog_categories where id='b2500010-0000-4000-8000-000000000002';
insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,category_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,created_by)
select 'b2500030-0000-4000-8000-000000000003',id,library_id,category_id,1,'DRAFT',code,slug,'Sous-catégorie de recette','فئة فرعية للاختبار','Description synthétique de recette','وصف اصطناعي للاختبار','folder',1,'Précondition brouillon historique',repeat('c',64),'b2500001-0000-4000-8000-000000000002'from public.catalog_subcategories where id='b2500010-0000-4000-8000-000000000003';
-- This old imported service also lacked its primary link. Only a DRAFT
-- input is repaired here; submission, review and publication remain native.
insert into public.catalog_service_subcategory_links(id,service_id,subcategory_id,library_id,link_type,status,created_by)
values('b2500031-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000004','b2500010-0000-4000-8000-000000000003','b2500010-0000-4000-8000-000000000001','PRIMARY','DRAFT','b2500001-0000-4000-8000-000000000002');
insert into public.catalog_service_subcategory_link_versions(id,link_id,library_id,service_id,subcategory_id,link_type,version,status,change_reason,content_hash,created_by)
values('b2500031-0000-4000-8000-000000000002','b2500031-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000001','b2500010-0000-4000-8000-000000000004','b2500010-0000-4000-8000-000000000003','PRIMARY',1,'DRAFT','Précondition historique de lien manquant',private.canonical_request_hash(jsonb_build_object('service_id','b2500010-0000-4000-8000-000000000004','subcategory_id','b2500010-0000-4000-8000-000000000003','link_type','PRIMARY')),'b2500001-0000-4000-8000-000000000002');
update public.catalog_service_subcategory_links set current_version_id='b2500031-0000-4000-8000-000000000002'where id='b2500031-0000-4000-8000-000000000001';
create temporary table catalog250(k text primary key,result jsonb);
insert into catalog250 values('LIBRARY',public.save_catalog_library_draft('b2500010-0000-4000-8000-000000000001','b2500030-0000-4000-8000-000000000001','Bibliothèque révisée250','مكتبة معدلة250','Description de bibliothèque révisée','وصف مكتبة معدل','folder',1,false,'Révision native pour publication250',(select row_version from public.catalog_libraries where id='b2500010-0000-4000-8000-000000000001'),1,'catalog250-save-library'));
insert into catalog250 values('CATEGORY',public.save_catalog_category_draft('b2500010-0000-4000-8000-000000000002','b2500030-0000-4000-8000-000000000002','Catégorie révisée250','فئة معدلة250','Description de catégorie révisée','وصف فئة معدل','folder',1,'{}',false,'Révision native pour publication250',(select row_version from public.catalog_categories where id='b2500010-0000-4000-8000-000000000002'),1,'catalog250-save-category'));
insert into catalog250 values('SUBCATEGORY',public.save_catalog_subcategory_draft('b2500010-0000-4000-8000-000000000003','b2500030-0000-4000-8000-000000000003','Sous-catégorie révisée250','فئة فرعية معدلة250','Description de sous-catégorie révisée','وصف فئة فرعية معدل','folder',1,'{}',false,'Révision native pour publication250',(select row_version from public.catalog_subcategories where id='b2500010-0000-4000-8000-000000000003'),1,'catalog250-save-subcategory'));
insert into catalog250 values('LIBRARY_SUB',public.submit_catalog_change('LIBRARY','b2500010-0000-4000-8000-000000000001','b2500030-0000-4000-8000-000000000001',(select row_version from public.catalog_libraries where id='b2500010-0000-4000-8000-000000000001'),(select row_version from public.catalog_library_versions where id='b2500030-0000-4000-8000-000000000001'),'catalog250-submit-library'));
insert into catalog250 values('CATEGORY_SUB',public.submit_catalog_change('CATEGORY','b2500010-0000-4000-8000-000000000002','b2500030-0000-4000-8000-000000000002',(select row_version from public.catalog_categories where id='b2500010-0000-4000-8000-000000000002'),(select row_version from public.catalog_category_versions where id='b2500030-0000-4000-8000-000000000002'),'catalog250-submit-category'));
insert into catalog250 values('SUBCATEGORY_SUB',public.submit_catalog_change('SUBCATEGORY','b2500010-0000-4000-8000-000000000003','b2500030-0000-4000-8000-000000000003',(select row_version from public.catalog_subcategories where id='b2500010-0000-4000-8000-000000000003'),(select row_version from public.catalog_subcategory_versions where id='b2500030-0000-4000-8000-000000000003'),'catalog250-submit-subcategory'));
select set_config('request.jwt.claim.sub','b250000a-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
do $$declare item record;begin for item in select k,(result->>'change_request_id')::uuid request_id from catalog250 where k in('LIBRARY_SUB','CATEGORY_SUB','SUBCATEGORY_SUB')order by k loop
 perform public.decide_catalog_editorial_review(item.request_id,'APPROVE','Revue indépendante FRAR du catalogue250',(select row_version from public.catalog_change_requests where id=item.request_id),true,'catalog250-review-'||lower(item.k));end loop;end$$;
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into catalog250 select'SERVICE',public.save_catalog_service_draft(s.service_id,s.id,s.primary_subcategory_id,s.code,s.slug,'Service révisé250','خدمة معدلة250','Description de service révisée','وصف خدمة معدل','Description complète du nouveau service','وصف كامل للخدمة الجديدة','ADVISORY',s.unit_label_fr,s.unit_label_ar,false,false,false,false,true,false,'MAD',1,'{"schema_version":1}','{"schema_version":1}',false,'Nouvelle version éditoriale250',(select row_version from public.catalog_services where id=s.service_id),s.row_version,'catalog250-save-service')from public.catalog_service_versions s where s.id='b2500010-0000-4000-8000-000000000005';
select set_config('test.new_sv250',(select result->>'version_id'from catalog250 where k='SERVICE'),true);
insert into catalog250 values('SERVICE_SUB',public.submit_franchise_catalog_service('b2500010-0000-4000-8000-000000000004',current_setting('test.new_sv250')::uuid,(select row_version from public.catalog_services where id='b2500010-0000-4000-8000-000000000004'),(select row_version from public.catalog_service_versions where id=current_setting('test.new_sv250')::uuid),'catalog250-submit-service'));
select set_config('request.jwt.claim.sub','b250000a-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_catalog_editorial_review((select(result->>'change_request_id')::uuid from catalog250 where k='SERVICE_SUB'),'APPROVE','Revue indépendante FRAR du nouveau service250',1,true,'catalog250-review-service');
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into catalog250 values('RELEASE',public.create_catalog_release('b2500010-0000-4000-8000-000000000001','HISTORICAL250.REPLACEMENT',private.canonical_request_hash((select jsonb_agg(jsonb_build_object('key',k,'result',result)order by k)from catalog250)),true,(select row_version from public.catalog_libraries where id='b2500010-0000-4000-8000-000000000001'),'catalog250-release-create'));
select set_config('test.release250',(select result->>'release_id'from catalog250 where k='RELEASE'),true);
do $$declare item record;release_ref uuid:=current_setting('test.release250')::uuid;begin
 for item in
 select 'LIBRARY'kind,library_id object_id,id version_id,content_hash,1 sort from public.catalog_library_versions where id='b2500030-0000-4000-8000-000000000001'
 union all select'CATEGORY',category_id,id,content_hash,2 from public.catalog_category_versions where id='b2500030-0000-4000-8000-000000000002'
 union all select'SUBCATEGORY',subcategory_id,id,content_hash,3 from public.catalog_subcategory_versions where id='b2500030-0000-4000-8000-000000000003'
 union all select'SERVICE',service_id,id,content_hash,4 from public.catalog_service_versions where id=current_setting('test.new_sv250')::uuid
 union all select'SERVICE_SUBCATEGORY_LINK',l.id,v.id,v.content_hash,5 from public.catalog_service_subcategory_links l join public.catalog_service_subcategory_link_versions v on v.id=l.current_version_id where l.service_id='b2500010-0000-4000-8000-000000000004'and l.link_type='PRIMARY'
 loop perform public.add_catalog_release_item(release_ref,item.kind,item.object_id,item.version_id,item.content_hash,item.sort,(select row_version from public.catalog_releases where id=release_ref),'catalog250-release-item-'||lower(item.kind));end loop;
end$$;
insert into catalog250 values('RELEASE_SUB',public.submit_catalog_release(current_setting('test.release250')::uuid,(select row_version from public.catalog_releases where id=current_setting('test.release250')::uuid),'catalog250-release-submit'));
select set_config('request.jwt.claim.sub','b250000a-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b250000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_catalog_editorial_review((select id from public.catalog_change_requests where target_type='RELEASE'and target_id=current_setting('test.release250')::uuid),'APPROVE','Revue indépendante de la nouvelle publication250',1,true,'catalog250-release-review');
select public.schedule_reviewed_catalog_release(current_setting('test.release250')::uuid,(select row_version from public.catalog_releases where id=current_setting('test.release250')::uuid),(select snapshot_hash from public.catalog_releases where id=current_setting('test.release250')::uuid),clock_timestamp()-interval'1 second',clock_timestamp()+interval'3 seconds','catalog250-release-schedule');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into catalog250 values('LEASE',public.claim_catalog_release('b2500030-0000-4000-8000-000000000090',current_setting('test.release250')::uuid,300));
insert into catalog250 values('PUBLISHED',public.complete_catalog_release_publish(current_setting('test.release250')::uuid,(select(result->>'lease_token')::uuid from catalog250 where k='LEASE'),(select(result->>'release_row_version')::integer from catalog250 where k='LEASE')));
select is((select result->>'outcome'from catalog250 where k='PUBLISHED'),'CATALOG_RELEASE_PUBLISHED','the second service version is published by the real worker lease pipeline');
select is((select status from public.catalog_service_versions where id='b2500010-0000-4000-8000-000000000005'),'RETIRED','native publication retires the exact old contract service version');
select is((select current_published_version_id::text from public.catalog_services where id='b2500010-0000-4000-8000-000000000004'),current_setting('test.new_sv250'),'the catalogue now points at the new version, not the signed source');
-- Let the genuinely scheduled short fixture publication expire before archive;
-- no catalogue status/date is forged to bypass the archive dependency check.
select pg_sleep(greatest(0,extract(epoch from((select effective_until from public.catalog_releases where id=current_setting('test.release250')::uuid)-clock_timestamp())))+0.05);
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into catalog250 values('ARCHIVED',public.archive_catalog_service('b2500010-0000-4000-8000-000000000004',current_setting('test.new_sv250')::uuid,(select row_version from public.catalog_services where id='b2500010-0000-4000-8000-000000000004'),(select row_version from public.catalog_service_versions where id=current_setting('test.new_sv250')::uuid),'Archive après échéance de publication de recette250','catalog250-archive'));
select is((select status from public.catalog_services where id='b2500010-0000-4000-8000-000000000004'),'ARCHIVED','native archive changes only the current catalogue identity');
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

create temporary table mission250(result jsonb);
insert into mission250 select public.create_mission(current_setting('test.contract250')::uuid,current_setting('test.cv250')::uuid,'[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1}]','[{"key":"D1","milestone_key":"M1","label_fr":"Rapport","label_ar":"تقرير","proof_required":true}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mission250-real-create');
select is((select result->>'outcome'from mission250),'MISSION_CREATED','the actual mission command succeeds from the sealed canonical nested contract');
select is((select s.service_version_id from public.mission_checklist_snapshots s where s.mission_id=(select(result->>'mission_id')::uuid from mission250)),'b2500010-0000-4000-8000-000000000005'::uuid,'the mission snapshots the frozen service version');
select is((select s.template_version from public.mission_checklist_snapshots s where s.mission_id=(select(result->>'mission_id')::uuid from mission250)),2,'the mission snapshots the second real published checklist version');
select ok(exists(select 1 from public.deliverables d join public.mission_milestones m on m.id=d.milestone_id and m.mission_id=d.mission_id where d.mission_id=(select(result->>'mission_id')::uuid from mission250)and m.milestone_key='M1'),'the real command also preserves the canonical deliverable milestone link');
select is((select private.canonical_request_hash(request_snapshot)from public.contract_versions where id=current_setting('test.cv250')::uuid),current_setting('test.snapshot250'),'mission creation does not rewrite the signed request snapshot');
select is((select content_hash from public.contract_versions where id=current_setting('test.cv250')::uuid),current_setting('test.hash250'),'the signed contract content hash is unchanged');
select ok(private.contract_version_signature_effective_v1(current_setting('test.contract250')::uuid,current_setting('test.cv250')::uuid),'the exact native development signature proof remains effective');
-- Additional immutable version rows below are negative/compatibility lookup
-- fixtures only. They are not signed, made current, or used to create missions.
create temporary table variants250(k text primary key,id uuid);
do $$declare base public.contract_versions%rowtype;kind text;snapshot jsonb;version_index integer:=100;new_id uuid;begin
 select*into base from public.contract_versions where id=current_setting('test.cv250')::uuid;
 foreach kind in array array['LEGACY_ROOT','BOTH_AGREE','DIVERGENCE','INVALID_NESTED','WRONG_REQUEST','WRONG_HASH','ALTERED_QUOTE_DATA','MISSING_SOURCE']loop
  snapshot:=case kind
   when'LEGACY_ROOT'then jsonb_build_object('service_version_id','b2500010-0000-4000-8000-000000000005')
   when'BOTH_AGREE'then base.request_snapshot||jsonb_build_object('service_version_id','b2500010-0000-4000-8000-000000000005')
   when'DIVERGENCE'then base.request_snapshot||jsonb_build_object('service_version_id','b250ffff-0000-4000-8000-000000000005')
   when'INVALID_NESTED'then jsonb_set(base.request_snapshot,'{required_quote_data,service_version_id}','"invalid-uuid"')
   when'WRONG_REQUEST'then base.request_snapshot||jsonb_build_object('request_version_id','b250ffff-0000-4000-8000-000000000006')
   when'WRONG_HASH'then base.request_snapshot||jsonb_build_object('catalog_snapshot_hash',repeat('f',64))
   when'ALTERED_QUOTE_DATA'then jsonb_set(base.request_snapshot,'{required_quote_data,region_code}','"OTHER_REGION"')
   when'MISSING_SOURCE'then base.request_snapshot-'required_quote_data'-'service_version_id'end;
  version_index:=version_index+1;new_id:=extensions.gen_random_uuid();
  insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by)
  values(new_id,base.contract_id,version_index,base.selected_quote_version_id,snapshot,base.quote_snapshot,base.clauses,base.price_minor,base.currency,base.commission_rule_snapshot,private.canonical_request_hash(snapshot),'Unsigned lookup fixture only','b2500001-0000-4000-8000-000000000001');
  insert into variants250 values(kind,new_id);
 end loop;
end$$;
select is(private.contract_service_version_for_mission_v1((select id from variants250 where k='LEGACY_ROOT')),'b2500010-0000-4000-8000-000000000005'::uuid,'the legacy root format remains valid when the actual RFQ service and hash agree');
select is(private.contract_service_version_for_mission_v1((select id from variants250 where k='BOTH_AGREE')),'b2500010-0000-4000-8000-000000000005'::uuid,'equal nested and legacy references remain compatible');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='DIVERGENCE'))$$,'22023','CONTRACT_SERVICE_SOURCE_DIVERGENCE','conflicting root and nested versions are refused');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='INVALID_NESTED'))$$,'22023','CONTRACT_SERVICE_SOURCE_INCOHERENT','invalid nested identifiers are not used as a fallback');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='WRONG_REQUEST'))$$,'22023','CONTRACT_SERVICE_SOURCE_INCOHERENT','a snapshot cannot claim another immutable request version');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='WRONG_HASH'))$$,'22023','CONTRACT_SERVICE_SOURCE_INCOHERENT','the signed catalogue hash must match the actual RFQ request');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='ALTERED_QUOTE_DATA'))$$,'22023','CONTRACT_SERVICE_SOURCE_INCOHERENT','caller quote data is not treated as an authoritative nested source');
select throws_ok($$select private.contract_service_version_for_mission_v1((select id from variants250 where k='MISSING_SOURCE'))$$,'22023','MISSION_SERVICE_VERSION_SNAPSHOT_REQUIRED','missing frozen provenance does not select the current service version');
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','b2500001-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"b2500001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is((public.create_mission(current_setting('test.contract250')::uuid,current_setting('test.cv250')::uuid,'[{"key":"M1","title_fr":"Livraison","title_ar":"التسليم","sort_order":1}]','[{"key":"D1","milestone_key":"M1","label_fr":"Rapport","label_ar":"تقرير","proof_required":true}]','[{"deliverable_key":"D1","criterion_key":"QUALITY"}]','mission250-real-create')->>'mission_id'),(select result->>'mission_id'from mission250),'the authorized replay retains its original mission after native catalogue replacement and archive');
select is((select s.template_version from public.mission_checklist_snapshots s where s.mission_id=(select(result->>'mission_id')::uuid from mission250)),2,'an already frozen mission checklist is never upgraded to the replacement service');
select ok(not has_function_privilege('authenticated','private.contract_service_version_for_mission_v1(uuid)','EXECUTE')and not has_function_privilege('service_role','private.contract_service_version_for_mission_v1(uuid)','EXECUTE'),'neither client nor generic service role can call the privileged source helper');
select *from finish();
rollback;
