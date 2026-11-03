begin;
set local search_path=public,extensions;
select no_plan();
-- Synthetic historical catalogue and quote facts form a complete FK graph.
-- Every invitation, selected-quote, identity and signature guard remains enabled.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f8800000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-client@example.invalid','',now(),'{}','{}',now(),now()),
('f8800000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-provider@example.invalid','',now(),'{}','{}',now(),now()),
('f8800000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('f8810000-0000-4000-8000-000000000001','P216 Client','P216 Client','ACTIVE','f8800000-0000-4000-8000-000000000001'),
('f8810000-0000-4000-8000-000000000002','P216 Provider','P216 Provider','ACTIVE','f8800000-0000-4000-8000-000000000002'),
('f8810000-0000-4000-8000-000000000003','P216 Foreign','P216 Foreign','ACTIVE','f8800000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('f8820000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000001','ACTIVE'),
('f8820000-0000-4000-8000-000000000002','f8810000-0000-4000-8000-000000000002','f8800000-0000-4000-8000-000000000002','ACTIVE'),
('f8820000-0000-4000-8000-000000000003','f8810000-0000-4000-8000-000000000003','f8800000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('f8820000-0000-4000-8000-000000000001','CLIENT_OWNER'),('f8820000-0000-4000-8000-000000000002','PROVIDER_OWNER'),('f8820000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values('f8830000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002','DRAFT',1,'f8800000-0000-4000-8000-000000000001');
-- Current identity fixtures retain real checks; only upstream review records are seeded.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-identity-signature-fixture',configured_at=clock_timestamp()where singleton;
insert into public.platform_user_roles(user_id,role_code)values('f8800000-0000-4000-8000-000000000003','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('f8810000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','f8800000-0000-4000-8000-000000000002');
insert into public.provider_match_profiles(provider_organization_id,region_codes)values('f8810000-0000-4000-8000-000000000002',array['CASABLANCA']);

select set_config('request.jwt.claim.sub','f8800000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select public.decide_provider_company('f8810000-0000-4000-8000-000000000002','VERIFIED','SIGNED',null,'TEST independent synthetic company review','TEST-ANCHOR',1,'TEST-0218-company-review');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('f8810000-0000-4000-8000-000000000002','ICE','997218000000002'),('f8810000-0000-4000-8000-000000000002','IF','99721802'),('f8810000-0000-4000-8000-000000000002','RC','TEST-218-PROVIDER');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='f8800000-0000-4000-8000-000000000003';org uuid:='f8810000-0000-4000-8000-000000000002';begin
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
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('f8810000-0000-4000-8000-000000000001','ICE','997218000000001','VERIFIED'),('f8810000-0000-4000-8000-000000000001','IF','99721801','VERIFIED'),('f8810000-0000-4000-8000-000000000001','RC','TEST218','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','VERIFIED',1,'f8800000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99721801","rc_number":"TEST218","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"P216 Client","display_name":"P216 Client","country_code":"MA","identifiers":{"ICE":"997218000000001","IF":"99721801","RC":"TEST218"}}',1,'f8800000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',1,now()-interval'1 day','f8800000-0000-4000-8000-000000000003','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f8891000-0000-0000-0000-000000000001','f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'f8810000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f8800000-0000-4000-8000-000000000003',clock_timestamp(),'f8800000-0000-4000-8000-000000000001'),
('f8891000-0000-0000-0000-000000000002','f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'f8810000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f8800000-0000-4000-8000-000000000003',clock_timestamp(),'f8800000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f8892000-0000-0000-0000-000000000001','f8891000-0000-0000-0000-000000000001','f8810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f8893000-0000-0000-0000-000000000001'),
('f8892000-0000-0000-0000-000000000002','f8891000-0000-0000-0000-000000000002','f8810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f8893000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f8891000-0000-0000-0000-000000000001' then 'f8892000-0000-0000-0000-000000000001'::uuid
  else 'f8892000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f8891000-0000-0000-0000-000000000001','f8891000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','f8800000-0000-4000-8000-000000000003',clock_timestamp(),'f8800000-0000-4000-8000-000000000001','f8891000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f8890000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','f8800000-0000-4000-8000-000000000003',clock_timestamp(),'f8800000-0000-4000-8000-000000000001','f8891000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');



-- Historical inputs are synthetic; the real constraints resolve every source.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f8853000-0000-4000-8000-000000000001','SIGNATURE_218','signature-218','f8810000-0000-4000-8000-000000000001','DRAFT','f8800000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values('f8853000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000001','SIGNATURE_CAT_218','signature-cat-218','DRAFT','f8800000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values('f8853000-0000-4000-8000-000000000003','f8853000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000002','SIGNATURE_SUB_218','signature-sub-218','DRAFT','f8800000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values('f8853000-0000-4000-8000-000000000004','f8853000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000003','SIGNATURE_SERVICE_218','signature-service-218','DRAFT','f8800000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)values('f8854000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000004','CONTRACT_PENDING','f8800000-0000-4000-8000-000000000001');
insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)values('f8854000-0000-4000-8000-000000000002','f8854000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000001',1,'Demande synthétique signature218','NORMAL','MAD','{"region_code":"CASABLANCA"}',true,repeat('1',64),repeat('2',64),'TEST immutable RFQ source',repeat('3',64),'f8800000-0000-4000-8000-000000000001');
update public.service_requests set current_version_id='f8854000-0000-4000-8000-000000000002'where id='f8854000-0000-4000-8000-000000000001';



-- Native service request, reviewed qualification and declared capacity make the
-- invitation eligible from versioned evidence; match booleans are not authority.
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by)values('f8857000-0000-4000-8000-000000000001','f8853000-0000-4000-8000-000000000001','TEST.0218.V1','DRAFT',repeat('e',64),'f8800000-0000-4000-8000-000000000003');
insert into public.questionnaires(id,library_id,code,status,created_by)values('f8857000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000001','TEST_PROVIDER_0218','DRAFT','f8800000-0000-4000-8000-000000000003');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,change_reason,created_by)values('f8857000-0000-4000-8000-000000000003','f8857000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000001','f8857000-0000-4000-8000-000000000001',1,'DRAFT','Questionnaire synthétique fournisseur','استبيان مقدم خدمة للاختبار','Source historique de recette','مصدر تاريخي للاختبار','PROVIDER','1.0.0','TEST-0218',repeat('f',64),'TEST source de qualification','f8800000-0000-4000-8000-000000000003');
do $$declare requested jsonb;begin
 perform set_config('request.jwt.claim.sub','f8800000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 requested:=public.request_provider_service('f8810000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000004','TEST-0218-service-request');
 insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,submitted_at,answer_manifest,answer_manifest_hash)values('f8857000-0000-4000-8000-000000000004','f8810000-0000-4000-8000-000000000002','f8800000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000001','f8857000-0000-4000-8000-000000000001','f8857000-0000-4000-8000-000000000003','PROVIDER','fr-MA','SUBMITTED',clock_timestamp(),'{}',repeat('1',64));
 perform set_config('request.jwt.claim.sub','f8800000-0000-4000-8000-000000000003',true);
 perform set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_provider_qualification((requested->>'qualification_id')::uuid,'APPROVED','f8857000-0000-4000-8000-000000000004',8000,'[{"key":"IDENTITY","passed":true}]','[]','TEST independent synthetic qualification','TEST-0218',clock_timestamp()+interval'1 year',1,'TEST-0218-qualification');
 perform set_config('request.jwt.claim.sub','f8800000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.declare_provider_capacity('f8810000-0000-4000-8000-000000000002','f8853000-0000-4000-8000-000000000004','AVAILABLE',5,2,'TEST provider capacity declaration','TEST-0218-capacity');
end$$;
insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)values('f8855000-0000-4000-8000-000000000001','f8854000-0000-4000-8000-000000000001','f8854000-0000-4000-8000-000000000002','MATCH-V1','COMPLETED',1,'f8800000-0000-4000-8000-000000000001',clock_timestamp());
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)values('f8855000-0000-4000-8000-000000000002','f8855000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002',true,9000,'{}',50);
insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,invited_count,opened_by)values('f8852000-0000-4000-8000-000000000001','f8854000-0000-4000-8000-000000000001','f8854000-0000-4000-8000-000000000002','f8855000-0000-4000-8000-000000000001','OPEN',clock_timestamp()+interval'1 day',1,'f8800000-0000-4000-8000-000000000001');
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)values('f8856000-0000-4000-8000-000000000001','f8852000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002','f8855000-0000-4000-8000-000000000002','ACCEPTED',clock_timestamp());
insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)values('f8851000-0000-4000-8000-000000000001','f8852000-0000-4000-8000-000000000001','f8856000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002','DRAFT','f8800000-0000-4000-8000-000000000002');
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values('f8850000-0000-4000-8000-000000000001','f8851000-0000-4000-8000-000000000001','f8852000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002',1,'SUBMITTED','Fixture mission P216','MAD','Solution fixture','["Livrable"]','Garantie fixture','Corrections fixture',current_date,1,clock_timestamp()+interval'1 day',10000,0,10000,0,'{}',repeat('f',64),clock_timestamp(),'f8800000-0000-4000-8000-000000000002');
update public.quotes set status='SELECTED',current_version_id='f8850000-0000-4000-8000-000000000001',selected_version_id='f8850000-0000-4000-8000-000000000001'where id='f8851000-0000-4000-8000-000000000001';
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values('f8840000-0000-4000-8000-000000000001','f8830000-0000-4000-8000-000000000001',1,'f8850000-0000-4000-8000-000000000001','{}','{"quote_version_id":"f8850000-0000-4000-8000-000000000001"}','{}',10000,'MAD','{}',repeat('a',64),'Fixture comportementale','f8800000-0000-4000-8000-000000000001');


select set_config('request.jwt.claim.sub','f8800000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)values('f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','CLIENT',private.current_client_contract_party_v1('f8810000-0000-4000-8000-000000000001')),('f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002','PROVIDER',private.provider_current_identity_snapshot_v1('f8810000-0000-4000-8000-000000000002')||jsonb_build_object('verified_identity_hash',private.canonical_request_hash(private.provider_current_identity_snapshot_v1('f8810000-0000-4000-8000-000000000002'))));
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-test-p218',configured_at=clock_timestamp()where singleton;
create temporary table p218(k text primary key,v jsonb);
create function pg_temp.as_user(p_user uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aal','aal2')::text,true);end$$;
create function pg_temp.as_service()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
select pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
select is(public.get_contract_signature_readiness_v1('f8830000-0000-4000-8000-000000000001')->>'status','NOT_CONFIGURED','a draft remains readable without inventing provider or legal level');
select throws_ok($$select public.submit_contract_for_signature('f8830000-0000-4000-8000-000000000001',1,'p218-unconfigured-submit')$$,'55000','SIGNATURE_PROVIDER_NOT_CONFIGURED','unconfigured provider blocks legacy submission without changing state');
select is((select status from public.contracts where id='f8830000-0000-4000-8000-000000000001'),'DRAFT','blocked signature submission preserves draft');
select throws_ok($$select public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',jsonb_build_object('method','EXPLICIT_CONFIRMATION','signed_at',now(),'evidence_hash',repeat('a',64)),'p218-forged-proof')$$,'55000','SIGNATURE_PROVIDER_EVIDENCE_REQUIRED','caller-supplied JSON can never create a contract signature');
insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at)
select'DEVELOPMENT',kind,1,id,'SIMPLE',true,false,false,'transactional-test-only-not-legal-approval','transactional-development-mock','f8800000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002',clock_timestamp()-interval'1 second'from public.signature_provider_configs cross join(values('CONTRACT'),('AMENDMENT'))k(kind)where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT';
insert into p218 values('contract',public.create_signature_envelope('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-contract.pdf','test-contracts/p218.pdf',repeat('b',64),'p218-create-envelope'));
create function pg_temp.env(p_kind text)returns uuid language sql as $$select(v->>'envelope_id')::uuid from p218 where k=p_kind$$;
select is(public.get_contract_signature_readiness_v1('f8830000-0000-4000-8000-000000000001')->>'status','AUTHORITIES_REQUIRED','an envelope alone is not signature readiness');
select throws_ok($$select public.add_signature_signer(pg_temp.env('contract'),'f8810000-0000-4000-8000-000000000002','f8800000-0000-4000-8000-000000000003','PROVIDER_OWNER',repeat('a',64),2,'p218-foreign-signer')$$,'22023','INVALID_SIGNATURE_SIGNER','cross-party user cannot be configured as the provider signer');
create function pg_temp.prepare_signers(p_kind text)returns void language plpgsql as $$declare envelope uuid:=pg_temp.env(p_kind);s uuid;begin
 perform pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
 s:=(public.add_signature_signer(envelope,'f8810000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest('p216-client@example.invalid','sha256'),'hex'),1,'p218-client:'||p_kind)->>'signer_id')::uuid;
 insert into p218 values(p_kind||'-client',jsonb_build_object('id',s));
 perform public.authorize_signature_signer(s,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'test-authorities/client.pdf',repeat('c',64),'p218-client-authority:'||p_kind);
 s:=(public.add_signature_signer(envelope,'f8810000-0000-4000-8000-000000000002','f8800000-0000-4000-8000-000000000002','PROVIDER_OWNER',encode(extensions.digest('p216-provider@example.invalid','sha256'),'hex'),2,'p218-provider:'||p_kind)->>'signer_id')::uuid;
 insert into p218 values(p_kind||'-provider',jsonb_build_object('id',s));
 perform pg_temp.as_user('f8800000-0000-4000-8000-000000000002');
 perform public.authorize_signature_signer(s,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'test-authorities/provider.pdf',repeat('d',64),'p218-provider-authority:'||p_kind);
 perform pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
end$$;
select pg_temp.prepare_signers('contract');
select throws_ok($$select public.add_signature_signer(pg_temp.env('contract'),'f8810000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000001','CLIENT_ADMIN',repeat('e',64),1,'p218-client:contract')$$,'22000','SIGNATURE_SIGNER_IDEMPOTENCY_MISMATCH','signer retries cannot silently change role or verified mailbox');
select throws_ok($$select public.authorize_signature_signer((select(v->>'id')::uuid from p218 where k='contract-client'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],999999,'MAD',current_date-1,current_date+1,'test-authorities/client.pdf',repeat('c',64),'p218-client-authority:contract')$$,'22000','SIGNATURE_AUTHORITY_IDEMPOTENCY_MISMATCH','authority retry cannot silently broaden the amount ceiling');
select is(public.get_contract_signature_readiness_v1('f8830000-0000-4000-8000-000000000001')->>'status','READY_TO_SUBMIT','exact parties with verified mailboxes and adequate authorities can submit explicitly configured mock');
select is(public.submit_contract_for_signature('f8830000-0000-4000-8000-000000000001',1,'p218-submit')->>'outcome','CONTRACT_PENDING_SIGNATURE','legacy submit delegates to actual mandatory ready transition');
select ok((select source_hash=repeat('a',64)and pdf_sha256=repeat('b',64)and policy_version_id is not null from private.contract_signature_bindings_v1 where envelope_id=pg_temp.env('contract')),'canonical contract hash, distinct PDF hash and approved policy version are bound separately');
select pg_temp.as_service();
-- Negative pre-send inputs are changed only inside this synthetic fixture; no review effect is claimed.
update public.client_compliance_cases set status='UNDER_REVIEW',verified_at=null,activated_at=null where organization_id='f8810000-0000-4000-8000-000000000001';
select throws_ok($$select public.run_mock_signature_provider(pg_temp.env('contract'),'SENT',null,'p218-current-client-denied')$$,'55000','SIGNATURE_CURRENT_CLIENT_IDENTITY_REQUIRED','identity returned to review after draft blocks a new signature send');
update public.client_compliance_cases set status='VERIFIED',verified_at=now()-interval'1 day',activated_at=now()-interval'1 day'where organization_id='f8810000-0000-4000-8000-000000000001';
update public.organization_identifiers set verification_status='PENDING'where organization_id='f8810000-0000-4000-8000-000000000002'and identifier_type='ICE';
select throws_ok($$select public.run_mock_signature_provider(pg_temp.env('contract'),'SENT',null,'p218-current-provider-denied')$$,'55000','SIGNATURE_CURRENT_PROVIDER_IDENTITY_REQUIRED','provider identity becoming unverified after draft blocks the actual send');
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='f8810000-0000-4000-8000-000000000002'and identifier_type='ICE';
-- Transaction-only SANDBOX receipt: native checkout, independent approved
-- cash/suspense mapping and verified-service SQL callback. No real PSP signature,
-- commercial cost, fiscal approval or external captured funds are asserted.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f8800000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p218-finance-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('f8800000-0000-4000-8000-000000000004','FINANCE_MANAGER');
insert into public.subscription_plans(id,code,status,created_by)values('f8894000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','f8800000-0000-4000-8000-000000000003');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('f8894000-0000-4000-8000-000000000002','f8894000-0000-4000-8000-000000000001',1,'ACTIVE','MAD',10000,120000,1,5000,5000,'{}',current_date-1,repeat('c',64),'f8800000-0000-4000-8000-000000000003');
insert into public.subscriptions(id,organization_id,status)values('f8894000-0000-4000-8000-000000000005','f8810000-0000-4000-8000-000000000001','TRIAL_EXPIRED');
select pg_temp.as_user('f8800000-0000-4000-8000-000000000003');
insert into p218 values('posting',public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','f8894000-0000-4000-8000-000000000002',null,'MAD','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('cash_account_code','TEST218_CASH_MAD','cash_name_fr','TEST cash','cash_name_ar','خزينة اختبار','suspense_account_code','TEST218_PENDING_MAD','suspense_name_fr','TEST pending','suspense_name_ar','قيد اختبار'),'TEST synthetic cash posting only','TEST-218-posting'));
select pg_temp.as_user('f8800000-0000-4000-8000-000000000004');
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p218 where k='posting'),true,(select v->>'request_hash'from p218 where k='posting'),'TEST independent synthetic posting approval');
-- Checkout freezes the native independently approved TEST Box before any PSP authority.
create function pg_temp.approve_checkout_box_fixture(
 p_audit_org uuid,p_plan_version uuid,p_maker uuid,p_reviewer uuid,p_code text,
 p_currency text,p_credit_budget bigint,p_rollover_months integer
)returns jsonb language plpgsql as $$
declare benefit jsonb;box jsonb;rule jsonb;context jsonb;approval jsonb;begin
 if p_maker=p_reviewer then raise exception'TEST_REQUIRES_INDEPENDENT_FINANCE';end if;
 perform set_config('request.jwt.claim.sub',p_maker::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_maker,'role','authenticated','aal','aal2')::text,true);
 benefit:=public.create_benefit_version(p_audit_org,p_code||'_BENEFIT','CREDIT_SERVICE','MATRICIA_INTERNAL','Avantage synthétique de recette','ميزة اصطناعية للاختبار','Données exclusivement synthétiques de recette','بيانات اختبار اصطناعية فقط',p_credit_budget,0,0,p_currency,null,null,null,'{}','{}','TEST_CANCELLATION_V1',clock_timestamp()-interval'1 minute',p_code||'-benefit');
 perform public.activate_benefit_version(p_audit_org,(benefit->>'benefit_version_id')::uuid,p_code||'-activate-benefit');
 box:=public.create_box_version(p_audit_org,p_code,'FIXED','Box synthétique de recette','صندوق اصطناعي للاختبار',p_credit_budget,p_rollover_months,'{}',0,0,0,p_currency,clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array(benefit->>'benefit_version_id'))),p_code||'-create');
 perform public.activate_box_version(p_audit_org,(box->>'box_version_id')::uuid,null,p_code||'-activate');
 rule:=public.link_plan_box_rule(p_audit_org,p_plan_version,(box->>'box_version_id')::uuid,'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute',p_code||'-link');
 context:=public.get_box_configuration_approval_context_v1((rule->>'plan_box_rule_id')::uuid);
 perform set_config('request.jwt.claim.sub',p_reviewer::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_reviewer,'role','authenticated','aal','aal2')::text,true);
 approval:=public.approve_box_configuration_v1((rule->>'plan_box_rule_id')::uuid,context->>'source_hash','Approbation indépendante exclusivement synthétique de recette',p_code||'-approve');
 perform set_config('request.jwt.claim.sub',p_maker::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_maker,'role','authenticated','aal','aal2')::text,true);
 return jsonb_build_object('box',box,'rule',rule,'approval',approval);
end$$;
insert into p218 values('checkout-box',pg_temp.approve_checkout_box_fixture('f8810000-0000-4000-8000-000000000001','f8894000-0000-4000-8000-000000000002','f8800000-0000-4000-8000-000000000003','f8800000-0000-4000-8000-000000000004','TEST_SIGNATURE_HOLD218','MAD',1,1));
select pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
insert into p218 values('payment-prepared',public.prepare_subscription_payment_intent_v2('f8810000-0000-4000-8000-000000000001','f8894000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','TEST-218-prepare'));
select pg_temp.as_service();
insert into p218 values('payment-registered',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p218 where k='payment-prepared'),'SANDBOX','SYNTHETIC-218-ORDER',10000,'MAD'));
insert into p218 values('payment-paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-218-CAPTURE-EVENT','SYNTHETIC-218-ORDER','PAYMENT_SUCCEEDED',10000,'MAD',clock_timestamp(),'SYNTHETIC-218-CAPTURE',repeat('c',64),repeat('d',64)));
select ok(exists(select 1 from public.credit_economic_funding_sources_v1 f join public.financial_journals j on j.id=f.financial_journal_id where f.organization_id='f8810000-0000-4000-8000-000000000001'and f.gross_minor=10000 and j.status='POSTED'),'signature financial context has a native captured receipt and posted cash journal');
insert into p218 values('payment-dispute',public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-218-DISPUTE-OPEN','SYNTHETIC-218-CAPTURE','SYNTHETIC-218-DISPUTE','DISPUTE_OPENED',10000,'MAD',clock_timestamp(),repeat('e',64),repeat('f',64)));
select throws_ok($$select public.run_mock_signature_provider(pg_temp.env('contract'),'SENT',null,'p218-held-client-denied')$$,'55000','CLIENT_FINANCIAL_HOLD_ACTIVE','financial hold after draft blocks send before any native signature event');
select is((select count(*)from public.signature_provider_events where envelope_id=pg_temp.env('contract')),0::bigint,'blocked current identities or money never produce a fictional native send');
insert into p218 values('payment-dispute-won',public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-218-DISPUTE-WON','SYNTHETIC-218-CAPTURE','SYNTHETIC-218-DISPUTE','DISPUTE_WON',10000,'MAD',clock_timestamp()+interval'1 second',repeat('a',64),repeat('b',64)));
select ok(private.subscription_financially_clear('f8810000-0000-4000-8000-000000000001'),'native dispute resolution releases the hold before signature send');
select is(public.run_mock_signature_provider(pg_temp.env('contract'),'SENT',null,'p218-contract-sent')->>'outcome','SIGNATURE_ENVELOPE_SENT','configured development mock uses actual sent transition');
select is(public.run_mock_signature_provider(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p218 where k='contract-client'),'p218-client-signed')->>'outcome','SIGNATURE_ENVELOPE_PARTIALLY_SIGNED','first native signature does not activate contract');
select is((select status from public.contracts where id='f8830000-0000-4000-8000-000000000001'),'PENDING_SIGNATURE','contract remains pending after only one party');
select is((select count(*)from public.contract_signatures where contract_id='f8830000-0000-4000-8000-000000000001'),0::bigint,'unsealed partial evidence does not become a completed legacy signature fact');
insert into p218 values('completed',public.run_mock_signature_provider(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p218 where k='contract-provider'),'p218-provider-signed'));
select is((select status from public.contracts where id='f8830000-0000-4000-8000-000000000001'),'ACTIVE','only completed sealed two-party envelope activates contract');
select is(public.process_marketing_contract_conversion_v2(pg_temp.env('contract'))->>'outcome','MARKETING_BUSINESS_SKIPPED_SIMULATION','a real sealed mock protocol run is explicitly excluded from real marketing contract conversions');
select ok((select count(*)=2 and bool_and(contract_hash=repeat('a',64)and proof->>'pdf_sha256'=repeat('b',64)and(proof->>'development_mock')::boolean)from public.contract_signatures where contract_id='f8830000-0000-4000-8000-000000000001'),'legacy facts keep canonical hash and honest mock/PDF evidence separately');
select is(public.run_mock_signature_provider(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p218 where k='contract-provider'),'p218-provider-signed')->>'replayed','true','verified callback replay is idempotent');
select is((select count(*)from public.contract_signatures where contract_id='f8830000-0000-4000-8000-000000000001'),2::bigint,'callback retry never creates more signatures');
select pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
insert into p218 select'proof',jsonb_build_object('envelope_id',pg_temp.env('contract'),'evidence_package_id',v->>'evidence_package_id','final_hash',v->>'final_hash')from p218 where k='completed';
select throws_ok($$select public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',repeat('b',64),'CLIENT_OWNER',(select v from p218 where k='proof'),'p218-wrong-sourcehash')$$,'40001','STALE_CONTRACT_VERSION','a PDF hash cannot stand in for the canonical contract source hash');
select throws_ok($$select public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v||jsonb_build_object('final_hash',repeat('f',64))from p218 where k='proof'),'p218-forged-finalhash')$$,'23514','SIGNATURE_EVIDENCE_HASH_MISMATCH','client cannot substitute a final evidence hash');
select is(public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v from p218 where k='proof'),'p218-verify-existing')->>'outcome','CONTRACT_SIGNED','legacy API can read only the verified imported fact');
select throws_ok($$select public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002',repeat('a',64),'PROVIDER_OWNER',(select v from p218 where k='proof'),'p218-cross-party-proof')$$,'42501','CONTRACT_SIGN_DENIED','client cannot claim the other party signature');
select is(public.list_contract_signature_readiness_v1(array['f8830000-0000-4000-8000-000000000001']::uuid[])->0->>'status','SIGNED','batch projection reports only completed verified signatures');
select is(public.revoke_signature_signer_authority_v1((select id from public.signature_signer_authorities where signer_id=(select(v->>'id')::uuid from p218 where k='contract-client')),'Authority withdrawn after completed signed fact','f8880000-0000-4000-8000-000000000002')->>'outcome','SIGNATURE_AUTHORITY_REVOKED','authority withdrawal is append-only even after a completed contract');
select is(public.get_contract_signature_readiness_v1('f8830000-0000-4000-8000-000000000001')->>'status','SIGNED','later authority withdrawal does not rewrite an already verified native signature fact');
select ok(private.contract_version_signature_effective_v1('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001'),'later authority withdrawal does not invalidate a completed native fact in its explicit development context');
select is(public.get_contract_signature_readiness_v1('f8830000-0000-4000-8000-000000000001')->>'development_mock','true','completed development mock is explicitly projected as non-contractual simulation');
select throws_ok($$select public.list_contract_signature_readiness_v1(array_fill('f8830000-0000-4000-8000-000000000001'::uuid,array[101]))$$,'22023','SIGNATURE_READINESS_BATCH_LIMIT','signature projection has bounded batch size');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select throws_ok($$select public.sign_contract('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v from p218 where k='proof'),'p218-mock-prod-proof')$$,'42501','SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH','a mock-completed development proof cannot be reused as production legal evidence');
select ok(not private.contract_version_signature_effective_v1('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001'),'retagging development mock ACTIVE data to production cannot admit a new contractual effect');
update private.admin_execution_environment_v1 set environment=null where singleton;
select ok(not private.contract_version_signature_effective_v1('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001'),'unconfigured database environment cannot admit a new contractual effect');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
-- Identity/selected-quote generation is exercised separately in0220. Seed pre-existing DRAFT amendments only; every signature guard and actual activation remains enabled.
create function pg_temp.draft_amendment(p_delta bigint,p_key text)returns jsonb language plpgsql as $$declare c public.contracts%rowtype;v public.contract_versions%rowtype;change_id uuid;amend_id uuid;n integer;begin
 select*into c from public.contracts where id='f8830000-0000-4000-8000-000000000001';select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 insert into public.change_requests(contract_id,requested_by,reason,scope_delta)values(c.id,auth.uid(),'Synthetic draft amendment fixture','{}')returning id into change_id;
 select coalesce(max(amendment_number),0)+1 into n from public.contract_amendments where contract_id=c.id;
 insert into public.contract_amendments(contract_id,change_request_id,base_contract_version_id,amendment_number,price_delta_minor,deadline_delta_days,deliverables_delta,commission_rule_snapshot,content_hash,created_by)values(c.id,change_id,v.id,n,p_delta,1,'[]',v.commission_rule_snapshot,private.canonical_request_hash(jsonb_build_object('fixture_key',p_key,'base',v.id,'delta',p_delta)),auth.uid())returning id into amend_id;
 return jsonb_build_object('amendment_id',amend_id);
end$$;
insert into p218 values('amendment-source',pg_temp.draft_amendment(500,'p218-amendment'));
insert into p218 select'amendment',public.create_amendment_signature_envelope((v->>'amendment_id')::uuid,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-amendment.pdf','test-contracts/p218-amendment.pdf',repeat('e',64),'p218-amendment-envelope')from p218 where k='amendment-source';
select pg_temp.prepare_signers('amendment');
select is(public.get_amendment_signature_readiness_v1((select(v->>'amendment_id')::uuid from p218 where k='amendment-source'))->>'status','READY_TO_SUBMIT','amendment has its own source-bound readiness');
select is(public.submit_contract_amendment_for_signature((select(v->>'amendment_id')::uuid from p218 where k='amendment-source'),(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p218 where k='amendment-source')),'p218-amendment-submit')->>'outcome','CONTRACT_AMENDMENT_PENDING_SIGNATURE','amendment submit binds its own mandate and source before send');
select throws_ok($$select public.sign_and_activate_contract_amendment((select(v->>'amendment_id')::uuid from p218 where k='amendment-source'),'f8810000-0000-4000-8000-000000000001',(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p218 where k='amendment-source')),'CLIENT_OWNER',(select v from p218 where k='proof'),'p218-reuse-contract-proof-for-amendment')$$,'23514','SIGNATURE_SOURCE_BINDING_MISMATCH','a signed base contract is never a signature of its later amendment');
select pg_temp.as_service();
select public.run_mock_signature_provider(pg_temp.env('amendment'),'SENT',null,'p218-amendment-sent');
select public.run_mock_signature_provider(pg_temp.env('amendment'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p218 where k='amendment-client'),'p218-amendment-client');
select is((select current_version from public.contracts where id='f8830000-0000-4000-8000-000000000001'),1,'partial amendment does not alter the original version');
select public.run_mock_signature_provider(pg_temp.env('amendment'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p218 where k='amendment-provider'),'p218-amendment-provider');
select is((select current_version from public.contracts where id='f8830000-0000-4000-8000-000000000001'),2,'completed exact amendment creates and selects the next immutable contract version');
select is((select price_minor from public.contract_versions where contract_id='f8830000-0000-4000-8000-000000000001'and version=2),10500::bigint,'verified amendment activation preserves exact-money delta');

select ok(private.contract_version_signature_effective_v1('f8830000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='f8830000-0000-4000-8000-000000000001'and version=2)),'amended contract effectivity follows the complete native base and amendment chain');
select ok(not has_function_privilege('authenticated','private.contract_version_signature_effective_v1(uuid,uuid)','EXECUTE')and not has_function_privilege('service_role','private.contract_version_signature_effective_v1(uuid,uuid)','EXECUTE'),'effectivity helper is available only to guarded SQL business commands');
-- A later explicit authority withdrawal blocks any subsequent native send.
select pg_temp.as_user('f8800000-0000-4000-8000-000000000001');
insert into p218 values('withdrawal-source',pg_temp.draft_amendment(100,'p218-withdrawal-amendment'));
insert into p218 select'withdrawal',public.create_amendment_signature_envelope((v->>'amendment_id')::uuid,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-amendment2.pdf','test-contracts/p218-amendment2.pdf',repeat('f',64),'p218-withdrawal-envelope')from p218 where k='withdrawal-source';
select pg_temp.prepare_signers('withdrawal');
select public.submit_contract_amendment_for_signature((select(v->>'amendment_id')::uuid from p218 where k='withdrawal-source'),(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p218 where k='withdrawal-source')),'p218-withdrawal-submit');
select is(public.revoke_signature_signer_authority_v1((select id from public.signature_signer_authorities where signer_id=(select(v->>'id')::uuid from p218 where k='withdrawal-client')),'Authority withdrawn before any provider send','f8880000-0000-4000-8000-000000000001')->>'outcome','SIGNATURE_AUTHORITY_REVOKED','authority withdrawal is an actual immutable command');
select pg_temp.as_service();
select throws_ok($$select public.run_mock_signature_provider(pg_temp.env('withdrawal'),'SENT',null,'p218-withdrawn-send')$$,'23514','SIGNER_AUTHORITY_REQUIRED','withdrawn authority blocks send even after ready and submission');
select is((select count(*)from public.signature_provider_events where envelope_id=pg_temp.env('withdrawal')),0::bigint,'revoked authority cannot produce a fictional provider event');
select ok(not has_function_privilege('authenticated','private.apply_verified_contract_amendment_v1(uuid,uuid,uuid,text,text,jsonb,text,uuid)','EXECUTE')and not has_function_privilege('service_role','private.complete_contract_signatures_from_envelope_v1(uuid,uuid)','EXECUTE'),'raw proof import cores are private to verified callback orchestration');
select ok(not has_table_privilege('authenticated','private.contract_signature_policy_versions_v1','INSERT')and not has_table_privilege('service_role','private.contract_signature_bindings_v1','INSERT'),'neither tenant nor service client can forge policy or source bindings directly');
select*from finish();rollback;
