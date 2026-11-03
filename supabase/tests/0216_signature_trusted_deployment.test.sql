begin;
set local search_path=public,extensions;
select no_plan();
-- Only unrelated upstream quote selection is abbreviated in the fixture.
-- All signature deployment, level and transition guards remain enabled.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fe600000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-client@example.invalid','',now(),'{}','{}',now(),now()),
('fe600000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-provider@example.invalid','',now(),'{}','{}',now(),now()),
('fe600000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p216-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('fe610000-0000-4000-8000-000000000001','P216 Client','P216 Client','ACTIVE','fe600000-0000-4000-8000-000000000001'),
('fe610000-0000-4000-8000-000000000002','P216 Provider','P216 Provider','ACTIVE','fe600000-0000-4000-8000-000000000002'),
('fe610000-0000-4000-8000-000000000003','P216 Foreign','P216 Foreign','ACTIVE','fe600000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('fe620000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','ACTIVE'),
('fe620000-0000-4000-8000-000000000002','fe610000-0000-4000-8000-000000000002','fe600000-0000-4000-8000-000000000002','ACTIVE'),
('fe620000-0000-4000-8000-000000000003','fe610000-0000-4000-8000-000000000003','fe600000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('fe620000-0000-4000-8000-000000000001','CLIENT_OWNER'),('fe620000-0000-4000-8000-000000000002','PROVIDER_OWNER'),('fe620000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values('fe630000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000002','PENDING_SIGNATURE',1,'fe600000-0000-4000-8000-000000000001');
-- This test exercises mission/proof behavior, not quote selection. Seed only the
-- immutable FK target while replication role bypasses its unrelated upstream graph.
set local session_replication_role=replica;
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values('fe650000-0000-4000-8000-000000000001','fe651000-0000-4000-8000-000000000001','fe652000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000002',1,'SUBMITTED','Fixture mission P216','MAD','Solution fixture','["Livrable"]','Garantie fixture','Corrections fixture',current_date,1,clock_timestamp()+interval'1 day',10000,0,10000,0,'{}',repeat('f',64),clock_timestamp(),'fe600000-0000-4000-8000-000000000002');
set local session_replication_role=origin;
alter table public.contract_versions disable trigger contract_versions_bind_selected_quote;
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values('fe640000-0000-4000-8000-000000000001','fe630000-0000-4000-8000-000000000001',1,'fe650000-0000-4000-8000-000000000001','{}','{"quote_version_id":"fe650000-0000-4000-8000-000000000001"}','{}',10000,'MAD','{}',repeat('a',64),'Fixture comportementale','fe600000-0000-4000-8000-000000000001');
alter table public.contract_versions enable trigger contract_versions_bind_selected_quote;

-- Current identity fixtures retain real checks; only upstream review records are seeded.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-identity-signature-fixture',configured_at=clock_timestamp()where singleton;
insert into public.platform_user_roles(user_id,role_code)values('fe600000-0000-4000-8000-000000000003','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('fe610000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','fe600000-0000-4000-8000-000000000002');
insert into public.provider_match_profiles(provider_organization_id)values('fe610000-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('fe610000-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','fe600000-0000-4000-8000-000000000003',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fe610000-0000-4000-8000-000000000002','ICE','997216000000002'),('fe610000-0000-4000-8000-000000000002','IF','99721602'),('fe610000-0000-4000-8000-000000000002','RC','TEST-216-PROVIDER');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='fe600000-0000-4000-8000-000000000003';org uuid:='fe610000-0000-4000-8000-000000000002';begin
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
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('fe610000-0000-4000-8000-000000000001','ICE','997216000000001','VERIFIED'),('fe610000-0000-4000-8000-000000000001','IF','99721601','VERIFIED'),('fe610000-0000-4000-8000-000000000001','RC','TEST216','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','VERIFIED',1,'fe600000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99721601","rc_number":"TEST216","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"P216 Client","display_name":"P216 Client","country_code":"MA","identifiers":{"ICE":"997216000000001","IF":"99721601","RC":"TEST216"}}',1,'fe600000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001',1,now()-interval'1 day','fe600000-0000-4000-8000-000000000003','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('fe691000-0000-0000-0000-000000000001','fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'fe610000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'fe600000-0000-4000-8000-000000000003',clock_timestamp(),'fe600000-0000-4000-8000-000000000001'),
('fe691000-0000-0000-0000-000000000002','fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'fe610000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'fe600000-0000-4000-8000-000000000003',clock_timestamp(),'fe600000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('fe692000-0000-0000-0000-000000000001','fe691000-0000-0000-0000-000000000001','fe610000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','fe693000-0000-0000-0000-000000000001'),
('fe692000-0000-0000-0000-000000000002','fe691000-0000-0000-0000-000000000002','fe610000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','fe693000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'fe691000-0000-0000-0000-000000000001' then 'fe692000-0000-0000-0000-000000000001'::uuid
  else 'fe692000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('fe691000-0000-0000-0000-000000000001','fe691000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','fe600000-0000-4000-8000-000000000003',clock_timestamp(),'fe600000-0000-4000-8000-000000000001','fe691000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('fe690000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','fe600000-0000-4000-8000-000000000003',clock_timestamp(),'fe600000-0000-4000-8000-000000000001','fe691000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


set local session_replication_role=origin;
select set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)values('fe640000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000001','CLIENT',private.current_client_contract_party_v1('fe610000-0000-4000-8000-000000000001')),('fe640000-0000-4000-8000-000000000001','fe610000-0000-4000-8000-000000000002','PROVIDER',private.provider_current_identity_snapshot_v1('fe610000-0000-4000-8000-000000000002')||jsonb_build_object('verified_identity_hash',private.canonical_request_hash(private.provider_current_identity_snapshot_v1('fe610000-0000-4000-8000-000000000002'))));
insert into public.platform_user_roles(user_id,role_code)values('fe600000-0000-4000-8000-000000000001','COMPLIANCE_MANAGER');
do $$declare proposal jsonb;cfg uuid;begin
 select id into cfg from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT'and status='ACTIVE'order by version desc limit 1;
 perform set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.propose_signature_policy_v1('fe610000-0000-4000-8000-000000000001','CONTRACT',cfg,'SIMPLE',false,false,'DEV-NON-CONTRACTUAL-DEPLOYMENT-FIXTURE','DEV-INSTALLED-MOCK',1,'Transactional noncontractual deployment fixture',extensions.gen_random_uuid());
 perform set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000003',true);perform set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_signature_policy_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'Independent review of noncontractual deployment fixture');
end$$;
select ok(private.current_client_contract_party_v1('fe610000-0000-4000-8000-000000000001')is not null,'actual verified Client identity exists before READY');
select ok(private.provider_current_identity_is_verified_v1('fe610000-0000-4000-8000-000000000002'),'actual reviewed Provider identity exists before READY');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-test-p216',configured_at=clock_timestamp()where singleton;
create temporary table p216(kind text primary key,value jsonb);
select set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p216 values('envelope',public.create_signature_envelope('fe630000-0000-4000-8000-000000000001','fe640000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','contract.pdf','contracts/p216.pdf',repeat('a',64),'p216-create-envelope'));
select is((select value->>'outcome'from p216 where kind='envelope'),'SIGNATURE_ENVELOPE_CREATED','explicit development mock can create a SIMPLE envelope');
select throws_ok($$select public.create_signature_envelope('fe630000-0000-4000-8000-000000000001','fe640000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','DEVELOPMENT','QUALIFIED','contract.pdf','contracts/p216.pdf',repeat('a',64),'p216-qualified-envelope')$$,'23514','SIGNATURE_LEVEL_NOT_SUPPORTED','mock never claims a qualified level');
-- Prepare the real signer/authority/ready workflow; no signature guard is disabled.
insert into p216 values('client-signer',public.add_signature_signer((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'fe610000-0000-4000-8000-000000000001','fe600000-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest('p216-client@example.invalid','sha256'),'hex'),1,'p216-client-signer'));
insert into p216 values('provider-signer',public.add_signature_signer((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'fe610000-0000-4000-8000-000000000002','fe600000-0000-4000-8000-000000000002','PROVIDER_OWNER',encode(extensions.digest('p216-provider@example.invalid','sha256'),'hex'),2,'p216-provider-signer'));
select public.authorize_signature_signer((select(value->>'signer_id')::uuid from p216 where kind='client-signer'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],10000,'MAD',current_date-1,current_date+1,'test-authority/client.pdf',repeat('c',64),'p216-client-authority');
select set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.authorize_signature_signer((select(value->>'signer_id')::uuid from p216 where kind='provider-signer'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],10000,'MAD',current_date-1,current_date+1,'test-authority/provider.pdf',repeat('d',64),'p216-provider-authority');
select set_config('request.jwt.claim.sub','fe600000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.ready_signature_envelope((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),1,'p216-ready-envelope');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select set_config('matricia.environment','DEVELOPMENT',true);
select throws_ok($$select public.create_signature_envelope('fe630000-0000-4000-8000-000000000001','fe640000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','contract.pdf','contracts/p216.pdf',repeat('a',64),'p216-spoof-environment')$$,'42501','SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH','caller development hint cannot spoof production database tag');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.run_mock_signature_provider((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'SENT',null,'p216-prod-send')$$,'42501','SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH','worker cannot execute a mock against production database');
select is((select status from public.signature_envelopes where id=(select(value->>'envelope_id')::uuid from p216 where kind='envelope')),'READY_FOR_SIGNATURE','production refusal changes no envelope state');
select is((select count(*)from public.signature_provider_events where envelope_id=(select(value->>'envelope_id')::uuid from p216 where kind='envelope')),0::bigint,'production refusal records no fictional provider event');
update private.admin_execution_environment_v1 set environment=null where singleton;
select throws_ok($$select public.run_mock_signature_provider((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'SENT',null,'p216-unconfigured-send')$$,'55000','SIGNATURE_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED','unconfigured deployment is fail-closed');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select is(public.run_mock_signature_provider((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'SENT',null,'p216-development-send')->>'outcome','SIGNATURE_ENVELOPE_SENT','mock executes only after explicit non-production provisioning');
select is(public.run_mock_signature_provider((select(value->>'envelope_id')::uuid from p216 where kind='envelope'),'VOIDED',null,'p216-development-void')->>'outcome','SIGNATURE_ENVELOPE_VOIDED','development mock retains real transition checks');
select throws_ok($$insert into public.signature_provider_configs(provider_code,environment,version,status,supported_levels,config_metadata)values('MATRICIA_DEV_MOCK','STAGING',1,'ACTIVE',array['QUALIFIED'],'{}')$$,'23514',null,'mock config cannot advertise qualified capability');
insert into public.signature_provider_configs(provider_code,environment,version,status,supported_levels,config_metadata)values('MATRICIA_DEV_MOCK','STAGING',1,'ACTIVE',array['SIMPLE'],'{"development_only":true}');
update private.admin_execution_environment_v1 set environment='STAGING'where singleton;
select set_config('request.jwt.claims','{"sub":"fe600000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p216 values('stage',public.create_signature_envelope('fe630000-0000-4000-8000-000000000001','fe640000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','STAGING','SIMPLE','contract.pdf','contracts/p216.pdf',repeat('a',64),'p216-staging-envelope'));
select is((select value->>'outcome'from p216 where kind='stage'),'SIGNATURE_ENVELOPE_CREATED','staging requires its own explicit SIMPLE-only mock configuration');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.run_mock_signature_provider((select(value->>'envelope_id')::uuid from p216 where kind='stage'),'SENT',null,'p216-stage-unready-send')$$,'55000','INVALID_SIGNATURE_EVENT_TRANSITION','non-production permission does not bypass mandatory ready workflow');
select ok(not has_table_privilege('authenticated','private.admin_execution_environment_v1','UPDATE')and not has_table_privilege('service_role','private.admin_execution_environment_v1','UPDATE'),'application roles cannot change trusted deployment metadata');
select ok(not has_function_privilege('service_role','private.require_signature_environment_v1(text,text)','EXECUTE'),'worker cannot invoke private deployment guard as an arbitrary API');
select is((select count(*)from public.signature_certificates where qualification_status='QUALIFIED'),0::bigint,'mock does not create qualified certificate evidence');
select*from finish();
rollback;
