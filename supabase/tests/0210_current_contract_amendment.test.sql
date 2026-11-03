begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0210',configured_at=clock_timestamp()where singleton;
set local search_path=public,private,extensions;
select no_plan();
grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('b210000c-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-provider@example.invalid','',now(),'{}','{}',now(),now());

insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)
values
 ('AMEND210_ANCHOR_A','Devis test A','اختبار أ','Catégorie fiscale test A','فئة اختبار أ','SERVICE','ACTIVE'),
 ('AMEND210_ANCHOR_B','Devis test B','اختبار ب','Catégorie fiscale test B','فئة اختبار ب','SERVICE','ACTIVE'),
 ('AMEND210_ANCHOR_DEMO','Devis test démo','اختبار تجريبي','Catégorie fiscale démo','فئة تجريبية','SERVICE','ACTIVE'),
 ('AMEND210_ANCHOR_RETIRED','Devis expiré','اختبار منتهي','Catégorie de règle expirée','فئة قاعدة منتهية','SERVICE','ACTIVE');

insert into public.tax_rule_versions(
 id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,
 professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,
 approved_by,approved_at,validation_reference,content_hash,change_reason
) values
 ('b210000d-0000-4000-8000-000000000001','MA','AMEND210_ANCHOR_A',1,2000,'2026-01-01',null,'DRAFT','PENDING','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('1',64),'Règle inactive pour test'),
 ('b210000d-0000-4000-8000-000000000002','MA','AMEND210_ANCHOR_DEMO',1,2000,'2026-01-01',null,'RETIRED','DEMO','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',null,null,null,repeat('2',64),'Règle démonstration non validée'),
 ('b210000d-0000-4000-8000-000000000003','MA','AMEND210_ANCHOR_B',1,2000,'2030-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b210000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('3',64),'Règle future validée test'),
 ('b210000d-0000-4000-8000-000000000004','MA','AMEND210_ANCHOR_RETIRED',1,2000,'2020-01-01','2020-12-31','ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b210000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('4',64),'Règle expirée validée test'),
 ('b210000d-0000-4000-8000-000000000005','MA','AMEND210_ANCHOR_A',2,2000,'2026-01-01',null,'ACTIVE','VALIDATED','VAT',100,'{}','Référence fiscale de test','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT','b210000c-0000-4000-8000-000000000001',now(),'TEST-VALIDATION',repeat('5',64),'Règle valide test');

insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b210000e-0000-4000-8000-000000000001','Client fiscal test','Client fiscal test','ACTIVE','b210000c-0000-4000-8000-000000000001'),
('b210000e-0000-4000-8000-000000000002','Provider fiscal test','Provider fiscal test','ACTIVE','b210000c-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status) values('b210000f-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000002','b210000c-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values('b210000f-0000-4000-8000-000000000001','PROVIDER_SALES');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('b2100010-0000-4000-8000-000000000001','AMEND210_TAX','amend210-tax','b210000e-0000-4000-8000-000000000001','DRAFT','b210000c-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by) values('b2100010-0000-4000-8000-000000000002','b2100010-0000-4000-8000-000000000001','AMEND210_TAX_CAT','amend210-tax-cat','DRAFT','b210000c-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by) values('b2100010-0000-4000-8000-000000000003','b2100010-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000002','AMEND210_TAX_SUB','amend210-tax-sub','DRAFT','b210000c-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by) values('b2100010-0000-4000-8000-000000000004','b2100010-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000003','AMEND210_TAX_SERVICE','amend210-tax-service','DRAFT','b210000c-0000-4000-8000-000000000001');
-- Historical published service version matches the existing immutable RFQ hash.
-- The classification and its dated tax rule are independently governed below.
set local session_replication_role=replica;
insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values('b2100010-0000-4000-8000-000000000005','b2100010-0000-4000-8000-000000000004','b2100010-0000-4000-8000-000000000001',1,'PUBLISHED','Service historique de recette210','خدمة تاريخية للاختبار210','Référence synthétique de recette','مرجع اصطناعي للاختبار','Précondition publiée pour une consultation historique','شرط منشور لاستشارة تاريخية','CONSULTING','mission','مهمة',1,'Source historique publiée de recette210',repeat('6',64),'b210000c-0000-4000-8000-000000000001',now()-interval'1 day','b2100010-0000-4000-8000-000000000003','AMEND210_TAX_SERVICE','amend210-tax-service');
update public.catalog_services set status='PUBLISHED',current_published_version_id='b2100010-0000-4000-8000-000000000005'where id='b2100010-0000-4000-8000-000000000004';
set local session_replication_role=origin;
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by) values('b2100011-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000004','MATCHING','b210000c-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by) values('b2100011-0000-4000-8000-000000000002','b2100011-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001',1,'Demande fiscale test','NORMAL','MAD','{"region_code":"CASABLANCA","tax_category_code":"AMEND210_ANCHOR_A"}',true,repeat('6',64),repeat('7',64),'Fixture fiscale',repeat('8',64),'b210000c-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='b2100011-0000-4000-8000-000000000002' where id='b2100011-0000-4000-8000-000000000001';
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at) values('b2100012-0000-4000-8000-000000000001','b2100011-0000-4000-8000-000000000001','b2100011-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'b210000c-0000-4000-8000-000000000001',now());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component) values('b2100012-0000-4000-8000-000000000002','b2100012-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by) values('b2100013-0000-4000-8000-000000000001','b2100011-0000-4000-8000-000000000001','b2100011-0000-4000-8000-000000000002','b2100012-0000-4000-8000-000000000001','OPEN',now()+interval'7 days','{"mask_direct_contacts":true,"competitor_offers_visible":false}',1,'b210000c-0000-4000-8000-000000000001');
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at) values('b2100014-0000-4000-8000-000000000001','b2100013-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000002','b2100012-0000-4000-8000-000000000002','ACCEPTED',now());
set local session_replication_role=origin;

create temporary table anchor_quote_payload(value jsonb);
insert into anchor_quote_payload values(jsonb_build_object('currency','MAD','solution_fr','Solution fiscale','solution_ar','','deliverables',jsonb_build_array('Livrable'),'inclusions','[]'::jsonb,'exclusions','[]'::jsonb,'prerequisites','[]'::jsonb,'warranty_fr','Garantie test','warranty_ar','','correction_terms_fr','Corrections incluses','correction_terms_ar','','sla','{}'::jsonb,'proposed_start_date','2026-09-12','duration_days','10','valid_until',(now()+interval'30 days')::text,'items',jsonb_build_array(jsonb_build_object('line_number','1','item_kind','ONE_TIME','label_fr','Forfait test','label_ar','','quantity','1','unit_code','FORFAIT','unit_price_minor','10000','tax_rule_version_id','b210000d-0000-4000-8000-000000000005','recurrence_interval','')),'options','[]'::jsonb));
update anchor_quote_payload set value=value||'{"expected_current_version_id":null}'::jsonb;
grant select on anchor_quote_payload to authenticated;
create temporary table anchor_quote_result(value jsonb);grant select,insert on anchor_quote_result to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b210000a-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-anchor-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b210000a-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('b210000e-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','b210000c-0000-4000-8000-000000000001');
insert into public.provider_match_profiles(provider_organization_id)values('b210000e-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('b210000e-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','b210000a-0000-4000-8000-000000000002',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('b210000e-0000-4000-8000-000000000002','ICE','991210000000001'),('b210000e-0000-4000-8000-000000000002','IF','99121001'),('b210000e-0000-4000-8000-000000000002','RC','TEST-212');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='b210000a-0000-4000-8000-000000000002';org uuid:='b210000e-0000-4000-8000-000000000002';begin
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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('b2100020-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax-source-210@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('b2100020-0000-4000-8000-000000000001','FINANCE_MANAGER');
insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values('TEST_CLIENT_TAX210','Service de recette fiscale210','خدمة اختبار ضريبي210','Référence synthétique transactionnelle','مرجع اصطناعي للمعاملة','SERVICE','ACTIVE');
select set_config('request.jwt.claims','{"sub":"b2100020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax210_rule',public.propose_morocco_tax_rule(null,'TEST_CLIENT_TAX210','VAT',2000,100,'{}','TEST/210 synthetic fiscal reference','2020-01-01',null,'TEST fiscal source for canonical quote210','test-tax210-rule')::text,true);
select set_config('request.jwt.claims','{"sub":"b210000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_morocco_tax_rule(null,(current_setting('test.tax210_rule')::jsonb->>'tax_rule_version_id')::uuid,'APPROVE','VALIDATED','TEST/210/RULE','TEST independently reviewed fiscal source',1,'test-tax210-review');
select set_config('test.tax210_scope',private.service_tax_mapping_scope_hash_v1('DEVELOPMENT','b2100010-0000-4000-8000-000000000005','MA','MAD'),true);
select set_config('request.jwt.claims','{"sub":"b2100020-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.tax210_mapping',public.propose_service_tax_category_mapping_v1('b2100010-0000-4000-8000-000000000005',repeat('6',64),current_setting('test.tax210_scope'),'MA','MAD','TEST_CLIENT_TAX210',current_date,null,true,array[]::uuid[],'TEST classification for canonical quote210','b2100021-0000-4000-8000-000000000001')::text,true);
select set_config('request.jwt.claims','{"sub":"b210000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_service_tax_category_mapping_v1((current_setting('test.tax210_mapping')::jsonb->>'proposal_id')::uuid,current_setting('test.tax210_mapping')::jsonb->>'content_hash',true,'TEST/210/MAPPING','TEST independent classification review');
update anchor_quote_payload set value=jsonb_set(value,'{items,0,tax_rule_version_id}',to_jsonb(current_setting('test.tax210_rule')::jsonb->>'tax_rule_version_id'));
select set_config('request.jwt.claims','{"sub":"b210000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into anchor_quote_result select public.create_quote_revision('b2100014-0000-4000-8000-000000000001',(select value from anchor_quote_payload),'Initial reviewed quote','anchor-quote-create');
select is((select calculation_basis#>>'{service_tax_policy_snapshot,mapping_id}'from public.quote_versions where id=(select(value->>'quote_version_id')::uuid from anchor_quote_result)),current_setting('test.tax210_mapping')::jsonb->>'proposal_id','quote freezes the actual independently approved classification rather than legacy caller category');

select set_config('test.anchor_identity',public.get_my_provider_identity_status_v1('b210000e-0000-4000-8000-000000000002')::text,true);
select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.anchor_identity')::jsonb->>'identity_hash','TEST provider registered address','amend210-publish-anchor');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('b2100001-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','canonical-amend210-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('b2100001-0000-4000-8000-000000000002','SUPER_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)values('b2100005-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','b2100001-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('b2100005-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b210000e-0000-4000-8000-000000000001','ICE','992210000000001','VERIFIED'),('b210000e-0000-4000-8000-000000000001','IF','99221001','VERIFIED'),('b210000e-0000-4000-8000-000000000001','RC','TEST220','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','VERIFIED',1,'b2100001-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99221001","rc_number":"TEST220","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Client fiscal test","display_name":"Client fiscal test","country_code":"MA","identifiers":{"ICE":"992210000000001","IF":"99221001","RC":"TEST220"}}',1,'b2100001-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001',1,now()-interval'1 day','b210000a-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b2100002-0000-0000-0000-000000000001','b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b210000e-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b210000a-0000-4000-8000-000000000002',clock_timestamp(),'b2100001-0000-4000-8000-000000000001'),
('b2100002-0000-0000-0000-000000000002','b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b210000e-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'b210000a-0000-4000-8000-000000000002',clock_timestamp(),'b2100001-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b2100003-0000-0000-0000-000000000001','b2100002-0000-0000-0000-000000000001','b210000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2100004-0000-0000-0000-000000000001'),
('b2100003-0000-0000-0000-000000000002','b2100002-0000-0000-0000-000000000002','b210000e-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b2100004-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b2100002-0000-0000-0000-000000000001' then 'b2100003-0000-0000-0000-000000000001'::uuid
  else 'b2100003-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b2100002-0000-0000-0000-000000000001','b2100002-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','b210000a-0000-4000-8000-000000000002',clock_timestamp(),'b2100001-0000-4000-8000-000000000001','b2100002-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('b210000b-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','b210000a-0000-4000-8000-000000000002',clock_timestamp(),'b2100001-0000-4000-8000-000000000001','b2100002-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


create temporary table provider_fixture(provider_organization_id uuid,provider_service_id uuid,questionnaire_session_id uuid,qualification_id uuid,qualification_decision_id uuid);
insert into provider_fixture values('b210000e-0000-4000-8000-000000000002','b210000b-0000-4000-8001-000000000001','b210000b-0000-4000-8001-000000000002','b210000b-0000-4000-8001-000000000003','b210000b-0000-4000-8001-000000000004');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by) values
 ('b2100006-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001','ROTATION.155.V1','DRAFT',repeat('e',64),'b210000c-0000-4000-8000-000000000001');
insert into public.questionnaires(id,library_id,code,status,created_by) values
 ('b2100007-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001','ROTATION_QUESTIONNAIRE','DRAFT','b210000c-0000-4000-8000-000000000001');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by) values
 ('b2100008-0000-4000-8000-000000000001','b2100007-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001','b2100006-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire rotation','استبيان التناوب','Questionnaire pour preuve de rotation','استبيان لإثبات التناوب','PROVIDER','1.0.0','ROTATION-V1',repeat('f',64),'Fixture rotation','b210000c-0000-4000-8000-000000000001');
insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)
select provider_service_id,provider_organization_id,'b2100010-0000-4000-8000-000000000004','DECIDED','b210000c-0000-4000-8000-000000000001',now() from provider_fixture;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)
select questionnaire_session_id,provider_organization_id,'b210000c-0000-4000-8000-000000000001','b2100010-0000-4000-8000-000000000001','b2100006-0000-4000-8000-000000000001','b2100008-0000-4000-8000-000000000001','PROVIDER','fr-MA','SUBMITTED',now(),'{}',repeat('1',64) from provider_fixture;
insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)
select qualification_id,provider_service_id,provider_organization_id,'b2100010-0000-4000-8000-000000000004' from provider_fixture;
insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)
select qualification_decision_id,qualification_id,provider_organization_id,'b2100010-0000-4000-8000-000000000004',1,'APPROVED','b2100008-0000-4000-8000-000000000001',questionnaire_session_id,8000,jsonb_build_array('IDENTITY'),'[]','Qualification équivalente','ROTATION-V1',now()-interval '1 day',now()+interval '1 year','b210000c-0000-4000-8000-000000000001',extensions.gen_random_uuid() from provider_fixture;
update public.provider_qualifications q set current_decision_id=f.qualification_decision_id from provider_fixture f where q.id=f.qualification_id;
insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,reason,declared_by)
select provider_organization_id,'b2100010-0000-4000-8000-000000000004',1,'AVAILABLE',5,2,now()-interval '1 day','Capacité équivalente','b210000c-0000-4000-8000-000000000001' from provider_fixture;


set local session_replication_role=origin;
create temporary table amend_results(k text primary key,v jsonb);grant all on amend_results to authenticated;
create function pg_temp.amend210_generate(p_key text)returns jsonb language sql security invoker as $$
 select public.generate_selected_quote_contract_v1('b2100011-0000-4000-8000-000000000001',(select(value->>'quote_version_id')::uuid from anchor_quote_result),current_setting('test.expected_contract_0210')::integer,(select(v->>'policy_version_id')::uuid from amend_results where k='template'),(select(v->>'policy_version_id')::uuid from amend_results where k='commission'),'Génération canonique approuvée en fixture seulement',p_key)
$$;
select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);set local role authenticated;
insert into amend_results values('compare',public.compare_quotes('b2100013-0000-4000-8000-000000000001','amend210-compare'));
select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Offre choisie pour la fixture contractuelle',(select(v->>'comparison_snapshot_id')::uuid from amend_results where k='compare'),'amend210-select');
select is((select status from public.service_requests where id='b2100011-0000-4000-8000-000000000001'),'PROVIDER_SELECTED','actual comparison and selection project the request to Provider selected');
select ok(not has_function_privilege('authenticated','public.select_quote(uuid,uuid,text,uuid)','EXECUTE'),'direct legacy selection cannot bypass comparison and the recorded reason');
select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Rejeu autorisé à vérifier',(select(v->>'comparison_snapshot_id')::uuid from amend_results where k='compare'),'amend210-replay-aal1')$$,'42501','QUOTE_CLIENT_SCOPE_DENIED','even an already-selected replay requires AAL2');
select set_config('request.jwt.claim.sub','b210000c-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b210000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.select_quote_and_notify((select(value->>'quote_id')::uuid from anchor_quote_result),(select(value->>'quote_version_id')::uuid from anchor_quote_result),'Rejeu étranger refusé',(select(v->>'comparison_snapshot_id')::uuid from amend_results where k='compare'),'amend210-replay-foreign')$$,'42501','QUOTE_CLIENT_SCOPE_DENIED','Provider cannot obtain a Client selection replay by guessing comparison IDs');
select set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.expected_contract_0210',(select row_version::text from public.service_requests where id='b2100011-0000-4000-8000-000000000001'),true);
insert into amend_results values('empty_context',public.get_selected_quote_contract_context_v1('b2100011-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into amend_results values('template',public.create_contract_policy_version_v1(jsonb_build_object('kind','TEMPLATE','code','TEST_AMEND_210','version',1,'library_id','b2100010-0000-4000-8000-000000000001','service_id','b2100010-0000-4000-8000-000000000004','country_code','MA','title_fr','Clauses synthétiques de fixture','title_ar','بنود اختبار فقط','clauses',jsonb_build_object('fr','TEXTE SYNTHÉTIQUE TEST UNIQUEMENT : aucun contrat de production.','ar','نص اصطناعي للاختبار فقط: لا عقد إنتاجي.'),'valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-LEGAL-REFERENCE-220'),'amend210-template'));
insert into amend_results values('commission',public.create_contract_policy_version_v1(jsonb_build_object('kind','COMMISSION','code','TEST_AMEND_COMMISSION_210','version',1,'library_id','b2100010-0000-4000-8000-000000000001','service_id','b2100010-0000-4000-8000-000000000004','currency','MAD','country_code','MA','title_fr','Commission de fixture uniquement','title_ar','عمولة اختبار فقط','basis_points',750,'basis_code','CONFIRMED_CLIENT_RECEIPT_AMOUNT','valid_from',(current_date-1)::text,'approval_reference','TEST-ONLY-FINANCE-REFERENCE-220'),'amend210-commission'));
reset role;
select set_config('request.jwt.claim.sub','b210000a-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"b210000a-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='template'),true,'Validation juridique synthétique réservée à cette fixture','amend210-template-approve');
select public.decide_contract_policy_version_v1((select(v->>'policy_version_id')::uuid from amend_results where k='commission'),true,'Validation financière synthétique réservée à cette fixture','amend210-commission-approve');
reset role;
set local session_replication_role=replica;
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by)values('b2100009-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','b2100009-0000-4000-9000-000000000001','MONTHLY','PAYPAL','amend210-capture-hold',10000,'MAD','amend210-capture-hold',repeat('a',64),'b2100009-0000-4000-9000-000000000002','b2100001-0000-4000-8000-000000000001');
insert into public.subscription_payment_events(payment_intent_id,organization_id,gateway,provider_event_id,provider_intent_id,event_type,amount_minor,currency,paid_at,payment_reference,payload_hash,signature_fingerprint,activation_result,correlation_id)values('b2100009-0000-4000-8000-000000000001','b210000e-0000-4000-8000-000000000001','PAYPAL','amend210-capture-event','amend210-capture-hold','PAYMENT_SUCCEEDED',10000,'MAD',now(),'HOLD-202',repeat('a',64),repeat('a',64),'{}','b2100009-0000-4000-9000-000000000002');
set local session_replication_role=origin;
insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)select id,organization_id,true,'REFUND_REQUESTED'from public.subscription_payment_events where provider_event_id='amend210-capture-event';
select set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
reset role;
update public.subscription_financial_holds set active=false,reason_code='DISPUTE_WON',updated_at=clock_timestamp()where organization_id='b210000e-0000-4000-8000-000000000001';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b210000e-0000-4000-8000-000000000001'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b210000e-0000-4000-8000-000000000001'and identifier_type='ICE';
update public.organization_identifiers set verification_status='PENDING'where organization_id='b210000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
reset role;
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b210000e-0000-4000-8000-000000000002'and identifier_type='ICE';
set local role authenticated;
insert into amend_results values('draft',pg_temp.amend210_generate('amend210-generate'));
insert into amend_results values('replay',pg_temp.amend210_generate('amend210-generate'));
reset role;
select is((select status from public.service_requests where id='b2100011-0000-4000-8000-000000000001'),'CONTRACT_PENDING','real selected-quote draft binding projects Contract pending');
select is((select count(*)from public.contract_signatures where contract_id=(select(v->>'contract_id')::uuid from amend_results where k='draft')),0::bigint,'draft projection creates no signature');
-- Actual native DEV-mock transitions; synthetic transaction-only policies and
-- authorities are explicitly non-contractual and invalid under PROD retag.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2100010-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amend-signature210@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('a2100010-0000-4000-8000-000000000103','b210000e-0000-4000-8000-000000000002','a2100010-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('a2100010-0000-4000-8000-000000000103','PROVIDER_OWNER');
insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at)
select'DEVELOPMENT','CONTRACT',1,id,'SIMPLE',true,false,false,'transaction-only-synthetic-signature-policy210','transaction-only-development-adapter210','b2100001-0000-4000-8000-000000000002','b210000a-0000-4000-8000-000000000002',clock_timestamp()-interval'1 second'from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT';
do $$declare contract_ref uuid;version_ref uuid;envelope uuid;client_signer uuid;provider_signer uuid;begin
 select(v->>'contract_id')::uuid,(v->>'contract_version_id')::uuid into contract_ref,version_ref from amend_results where k='draft';
 perform set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 envelope:=(public.create_signature_envelope(contract_ref,version_ref,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','synthetic-contract210.pdf','transaction-only/contracts210.pdf',repeat('b',64),'native-envelope210')->>'envelope_id')::uuid;
 client_signer:=(public.add_signature_signer(envelope,'b210000e-0000-4000-8000-000000000001','b2100001-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest((select email::text from auth.users where id='b2100001-0000-4000-8000-000000000001'),'sha256'),'hex'),1,'native-client210')->>'signer_id')::uuid;
 perform public.authorize_signature_signer(client_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/client210.pdf',repeat('c',64),'native-client-authority210');
 provider_signer:=(public.add_signature_signer(envelope,'b210000e-0000-4000-8000-000000000002','a2100010-0000-4000-8000-000000000003','PROVIDER_OWNER',encode(extensions.digest('amend-signature210@example.invalid','sha256'),'hex'),2,'native-provider210')->>'signer_id')::uuid;
 perform set_config('request.jwt.claim.sub','a2100010-0000-4000-8000-000000000003',true);perform set_config('request.jwt.claims','{"sub":"a2100010-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.authorize_signature_signer(provider_signer,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'transaction-only/provider210.pdf',repeat('d',64),'native-provider-authority210');
 perform set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 perform public.submit_contract_for_signature(contract_ref,1,'native-submit210');
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.run_mock_signature_provider(envelope,'SENT',null,'native-sent210');perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',client_signer,'native-client-signed210');perform public.run_mock_signature_provider(envelope,'SIGNER_SIGNED',provider_signer,'native-provider-signed210');
 perform set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
end$$;
select is((select status from public.service_requests where id='b2100011-0000-4000-8000-000000000001'),'CONTRACTED','only the sealed two-party native callback projects Contracted');
select is((select count(*)from public.audit_events where action='rfq.request.stage_projected'and resource_id='b2100011-0000-4000-8000-000000000001'),3::bigint,'one audit exists per real selected/draft/signed transition');
create function pg_temp.amend210_propose(p_key text,p_delta bigint default 1250)returns jsonb language sql security invoker as $$
 select public.create_current_contract_amendment_v1((select(v->>'contract_id')::uuid from amend_results where k='draft'),(select(v->>'contract_version_id')::uuid from amend_results where k='draft'),(select v->>'content_hash'from amend_results where k='draft'),'Modification contractuelle de fixture uniquement','{"description":"Ajouter une revue des pièces du dossier"}',p_delta,2,p_key)
$$;
set local role authenticated;
insert into amend_results values('amendment',pg_temp.amend210_propose('amend210-propose'));
insert into amend_results values('amendment_replay',pg_temp.amend210_propose('amend210-propose'));
select is((select v->>'outcome'from amend_results where k='amendment'),'CONTRACT_AMENDMENT_DRAFTED','reviewed base produces a real draft without signing or activation');
select is((select v from amend_results where k='amendment'),(select v from amend_results where k='amendment_replay'),'same command replays the actual amendment');
select throws_ok($$select pg_temp.amend210_propose('amend210-propose',1251)$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same key cannot change the proposed commercial amount');
select throws_ok($$select public.create_current_contract_amendment_v1((select(v->>'contract_id')::uuid from amend_results where k='draft'),null,(select v->>'content_hash'from amend_results where k='draft'),'Modification de fixture','{"description":"Périmètre de fixture"}',0,0,'amend210-null-base')$$,'22023','INVALID_AMENDMENT','null base cannot bypass optimistic concurrency');
select throws_ok($$select public.create_current_contract_amendment_v1((select(v->>'contract_id')::uuid from amend_results where k='draft'),(select(v->>'contract_version_id')::uuid from amend_results where k='draft'),repeat('f',64),'Modification de fixture','{"description":"Périmètre de fixture"}',0,0,'amend210-stale-hash')$$,'40001','STALE_CONTRACT_VERSION','stale reviewed hash is refused');
select throws_ok($$select public.create_current_contract_amendment_v1((select(v->>'contract_id')::uuid from amend_results where k='draft'),'b210ffff-0000-4000-8000-000000000099',(select v->>'content_hash'from amend_results where k='draft'),'Modification de fixture','{"description":"Périmètre de fixture"}',0,0,'amend210-stale-version')$$,'40001','STALE_CONTRACT_VERSION','a different reviewed version cannot bypass CAS with the current hash');
select throws_ok($$select pg_temp.amend210_propose('amend210-negative-total',-12001)$$,'22023','INVALID_AMENDMENT_TOTAL','proposal cannot make the contractual amount negative');
reset role;
select is((select count(*)from public.contract_amendments where contract_id=(select(v->>'contract_id')::uuid from amend_results where k='draft')),1::bigint,'replay and refused proposals leave one amendment');
select ok((select a.commission_rule_snapshot=v.commission_rule_snapshot and a.deliverables_delta='[]'::jsonb and a.base_contract_version_id=v.id from public.contract_amendments a join public.contract_versions v on v.id=a.base_contract_version_id where a.id=(select(v->>'amendment_id')::uuid from amend_results where k='amendment')),'commission and base snapshot are derived from the immutable contract');
select is((select scope_delta->>'description'from public.change_requests where id=(select(v->>'change_request_id')::uuid from amend_results where k='amendment')),'Ajouter une revue des pièces du dossier','business description is preserved without a user-authored JSON contract');
select is((select count(*)from public.audit_events where action='contract.amendment_drafted'and resource_id=(select v->>'amendment_id'from amend_results where k='amendment')),1::bigint,'one real drafting audit exists');
select is((select count(*)from public.event_outbox where event_type='ContractAmendmentDraftedV1'and aggregate_id=(select v->>'contract_id'from amend_results where k='draft')),1::bigint,'one real draft event exists despite replay');
select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select throws_ok($$select pg_temp.amend210_propose('amend210-aal1')$$,'42501','AMENDMENT_CREATE_DENIED','AAL1 cannot propose an amendment');
reset role;
select set_config('request.jwt.claims','{"sub":"b210000c-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','b210000c-0000-4000-8000-000000000001',true);set local role authenticated;
select throws_ok($$select pg_temp.amend210_propose('amend210-provider-reader')$$,'42501','AMENDMENT_CREATE_DENIED','Provider sales access does not confer contract writing authority');
reset role;
select set_config('request.jwt.claims','{"sub":"b2100001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);select set_config('request.jwt.claim.sub','b2100001-0000-4000-8000-000000000001',true);
update public.subscription_financial_holds set active=true where organization_id='b210000e-0000-4000-8000-000000000001';set local role authenticated;
select throws_ok($$select pg_temp.amend210_propose('amend210-financial-hold')$$,'55000','CONTRACT_NEW_COMMITMENT_NOT_ALLOWED','a financial hold blocks new amendment commitment');
reset role;
select is((select count(*)from public.contract_amendments where contract_id=(select(v->>'contract_id')::uuid from amend_results where k='draft')),1::bigint,'financial refusal leaves historical amendment unchanged');
select ok(not has_function_privilege('anon','public.create_current_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,text,uuid)','EXECUTE')and not has_function_privilege('service_role','public.create_current_contract_amendment_v1(uuid,uuid,text,text,jsonb,bigint,integer,text,uuid)','EXECUTE'),'only authenticated party commands are granted');
update public.subscription_financial_holds set active=false where organization_id='b210000e-0000-4000-8000-000000000001';
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
set local role authenticated;
select throws_ok($$select public.create_mission((select(v->>'contract_id')::uuid from amend_results where k='draft'),(select(v->>'contract_version_id')::uuid from amend_results where k='draft'),'[]','[]','[]','amend210-production-mission')$$,'55000','CONTRACT_SIGNATURE_NOT_EFFECTIVE_IN_DEPLOYMENT','retagging an ACTIVE development mock cannot authorize a new production mission');
select throws_ok($$select pg_temp.amend210_propose('amend210-production-amendment')$$,'55000','CONTRACT_SIGNATURE_NOT_EFFECTIVE_IN_DEPLOYMENT','retagging a development mock cannot authorize a new production amendment');
reset role;
select is((select status from public.contracts where id=(select(v->>'contract_id')::uuid from amend_results where k='draft')),'ACTIVE','refused new effects do not erase the historical completed mock fact');
select is((select count(*)from public.missions where contract_id=(select(v->>'contract_id')::uuid from amend_results where k='draft')),0::bigint,'no mission is created under the retagged environment');
select set_config('test.stage_event210',(select id::text from public.event_outbox where event_type='ServiceRequestStageChangedV1'and aggregate_id='b2100011-0000-4000-8000-000000000001'order by id desc limit 1),true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
select ok(public.verify_service_request_stage_event_v1(current_setting('test.stage_event210')::bigint,'b2100011-0000-4000-8000-000000000001'),'stage consumer verifies the actual persisted transition and audit');
reset role;
select*from finish();rollback;
