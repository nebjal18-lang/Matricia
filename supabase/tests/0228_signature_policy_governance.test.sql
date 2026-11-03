begin;
set local search_path=public,extensions;
select no_plan();
-- Only unrelated upstream quote selection is abbreviated in the fixture.
-- All signature deployment, level and transition guards remain enabled.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f9800000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p228-client@example.invalid','',now(),'{}','{}',now(),now()),
('f9800000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p228-provider@example.invalid','',now(),'{}','{}',now(),now()),
('f9800000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p228-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('f9810000-0000-4000-8000-000000000001','P228 Client','P228 Client','ACTIVE','f9800000-0000-4000-8000-000000000001'),
('f9810000-0000-4000-8000-000000000002','P228 Provider','P228 Provider','ACTIVE','f9800000-0000-4000-8000-000000000002'),
('f9810000-0000-4000-8000-000000000003','P228 Foreign','P228 Foreign','ACTIVE','f9800000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('f9820000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','f9800000-0000-4000-8000-000000000001','ACTIVE'),
('f9820000-0000-4000-8000-000000000002','f9810000-0000-4000-8000-000000000002','f9800000-0000-4000-8000-000000000002','ACTIVE'),
('f9820000-0000-4000-8000-000000000003','f9810000-0000-4000-8000-000000000003','f9800000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('f9820000-0000-4000-8000-000000000001','CLIENT_OWNER'),('f9820000-0000-4000-8000-000000000002','PROVIDER_OWNER'),('f9820000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values('f9830000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000002','DRAFT',1,'f9800000-0000-4000-8000-000000000001');
-- This test exercises mission/proof behavior, not quote selection. Seed only the
-- immutable FK target while replication role bypasses its unrelated upstream graph.
set local session_replication_role=replica;
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values('f9850000-0000-4000-8000-000000000001','f9851000-0000-4000-8000-000000000001','f9852000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000002',1,'SUBMITTED','Fixture mission P216','MAD','Solution fixture','["Livrable"]','Garantie fixture','Corrections fixture',current_date,1,clock_timestamp()+interval'1 day',10000,0,10000,0,'{}',repeat('f',64),clock_timestamp(),'f9800000-0000-4000-8000-000000000002');
set local session_replication_role=origin;
alter table public.contract_versions disable trigger contract_versions_bind_selected_quote;
insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values('f9840000-0000-4000-8000-000000000001','f9830000-0000-4000-8000-000000000001',1,'f9850000-0000-4000-8000-000000000001','{}','{"quote_version_id":"f9850000-0000-4000-8000-000000000001"}','{}',10000,'MAD','{}',repeat('a',64),'Fixture comportementale','f9800000-0000-4000-8000-000000000001');
alter table public.contract_versions enable trigger contract_versions_bind_selected_quote;


-- Current identity fixtures retain real checks; only upstream review records are seeded.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-identity-signature-fixture',configured_at=clock_timestamp()where singleton;
insert into public.platform_user_roles(user_id,role_code)values('f9800000-0000-4000-8000-000000000003','SUPER_ADMIN');
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('f9810000-0000-4000-8000-000000000002','VERIFIED','ACTIVE','Provider identity test fixture',1,1,'SIGNED','f9800000-0000-4000-8000-000000000002');
insert into public.provider_match_profiles(provider_organization_id)values('f9810000-0000-4000-8000-000000000002');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('f9810000-0000-4000-8000-000000000002',1,'VERIFIED','SIGNED','Synthetic company review','TEST-ANCHOR','f9800000-0000-4000-8000-000000000003',extensions.gen_random_uuid());
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('f9810000-0000-4000-8000-000000000002','ICE','997218000000002'),('f9810000-0000-4000-8000-000000000002','IF','99721802'),('f9810000-0000-4000-8000-000000000002','RC','TEST-218-PROVIDER');
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='f9800000-0000-4000-8000-000000000003';org uuid:='f9810000-0000-4000-8000-000000000002';begin
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
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('f9810000-0000-4000-8000-000000000001','ICE','997218000000001','VERIFIED'),('f9810000-0000-4000-8000-000000000001','IF','99721801','VERIFIED'),('f9810000-0000-4000-8000-000000000001','RC','TEST218','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','VERIFIED',1,'f9800000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99721801","rc_number":"TEST218","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"P228 Client","display_name":"P228 Client","country_code":"MA","identifiers":{"ICE":"997218000000001","IF":"99721801","RC":"TEST218"}}',1,'f9800000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',1,now()-interval'1 day','f9800000-0000-4000-8000-000000000003','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f9891000-0000-0000-0000-000000000001','f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'f9810000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f9800000-0000-4000-8000-000000000003',clock_timestamp(),'f9800000-0000-4000-8000-000000000001'),
('f9891000-0000-0000-0000-000000000002','f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'f9810000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'f9800000-0000-4000-8000-000000000003',clock_timestamp(),'f9800000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f9892000-0000-0000-0000-000000000001','f9891000-0000-0000-0000-000000000001','f9810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f9893000-0000-0000-0000-000000000001'),
('f9892000-0000-0000-0000-000000000002','f9891000-0000-0000-0000-000000000002','f9810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f9893000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f9891000-0000-0000-0000-000000000001' then 'f9892000-0000-0000-0000-000000000001'::uuid
  else 'f9892000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f9891000-0000-0000-0000-000000000001','f9891000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','f9800000-0000-4000-8000-000000000003',clock_timestamp(),'f9800000-0000-4000-8000-000000000001','f9891000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f9890000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','f9800000-0000-4000-8000-000000000003',clock_timestamp(),'f9800000-0000-4000-8000-000000000001','f9891000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


set local session_replication_role=origin;
select set_config('request.jwt.claim.sub','f9800000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f9800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into public.contract_parties(contract_version_id,organization_id,party_role,legal_snapshot)values('f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001','CLIENT',private.current_client_contract_party_v1('f9810000-0000-4000-8000-000000000001')),('f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000002','PROVIDER',private.provider_current_identity_snapshot_v1('f9810000-0000-4000-8000-000000000002')||jsonb_build_object('verified_identity_hash',private.canonical_request_hash(private.provider_current_identity_snapshot_v1('f9810000-0000-4000-8000-000000000002'))));
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-test-p228',configured_at=clock_timestamp()where singleton;
create temporary table p228(k text primary key,v jsonb);
create function pg_temp.as_user(p_user uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_user::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aal','aal2')::text,true);end$$;
create function pg_temp.as_service()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
select is(public.get_contract_signature_readiness_v1('f9830000-0000-4000-8000-000000000001')->>'status','NOT_CONFIGURED','a draft remains readable without inventing provider or legal level');
select throws_ok($$select public.submit_contract_for_signature('f9830000-0000-4000-8000-000000000001',1,'p228-unconfigured-submit')$$,'55000','SIGNATURE_PROVIDER_NOT_CONFIGURED','unconfigured provider blocks legacy submission without changing state');
select is((select status from public.contracts where id='f9830000-0000-4000-8000-000000000001'),'DRAFT','blocked signature submission preserves draft');
select throws_ok($$select public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',jsonb_build_object('method','EXPLICIT_CONFIRMATION','signed_at',now(),'evidence_hash',repeat('a',64)),'p228-forged-proof')$$,'55000','SIGNATURE_PROVIDER_EVIDENCE_REQUIRED','caller-supplied JSON can never create a contract signature');
insert into public.platform_user_roles(user_id,role_code)values('f9800000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),('f9800000-0000-4000-8000-000000000002','COMPLIANCE_MANAGER');
create function pg_temp.propose_policy(p_kind text,p_hours integer,p_key text)returns jsonb language sql as $$select public.propose_signature_policy_v1('f9810000-0000-4000-8000-000000000001',p_kind,(select id from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT'order by version desc limit 1),'SIMPLE',false,false,'DEV-NON-CONTRACTUAL-TEST','DEV-INSTALLED-MOCK',p_hours,'Temporary noncontractual governed test policy',md5(p_key)::uuid)$$;
select throws_ok($$select pg_temp.propose_policy('CONTRACT',25,'p228-too-long')$$,'42501','SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY','simulation policy has an enforced maximum lifetime of24hours');
select throws_ok($$select pg_temp.propose_policy('FRANCHISE_MANDATE',1,'p228-no-mandate-mock')$$,'42501','SIGNATURE_MOCK_NON_CONTRACTUAL_ONLY','simulation policy cannot authorize a real franchise mandate');
insert into p228 values('contract-policy',pg_temp.propose_policy('CONTRACT',1,'p228-contract-policy'));
select is(pg_temp.propose_policy('CONTRACT',1,'p228-contract-policy')->>'proposal_id',(select v->>'proposal_id'from p228 where k='contract-policy'),'policy proposal retry has the same immutable identity');
select throws_ok($$select pg_temp.propose_policy('CONTRACT',2,'p228-contract-policy')$$,'22000','SIGNATURE_POLICY_IDEMPOTENCY_MISMATCH','retry cannot silently change policy lifetime');
select throws_ok($$select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='contract-policy'),(select v->>'content_hash'from p228 where k='contract-policy'),true,'Independent validation is required here')$$,'42501','FOUR_EYES_REQUIRED','proposer cannot approve their own signature policy');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('f9800000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider228@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status)values('f9820000-0000-4000-8000-000000000004','f9810000-0000-4000-8000-000000000003','f9800000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('f9820000-0000-4000-8000-000000000004','CLIENT_OWNER');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000004');
select throws_ok($$select public.list_signature_policy_governance_v1()$$,'42501','SIGNATURE_POLICY_ADMIN_AAL2_REQUIRED','tenant owner cannot inspect private platform signature governance');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select throws_ok($$select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='contract-policy'),repeat('0',64),true,'Independent review of a changed hash denied')$$,'23514','SIGNATURE_POLICY_REVIEW_MISMATCH','review pins the exact immutable policy hash');
select is(public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='contract-policy'),(select v->>'content_hash'from p228 where k='contract-policy'),true,'Reviewed temporary noncontractual simulation policy')->>'outcome','SIGNATURE_POLICY_APPROVED','different authorized AAL2 reviewer activates the exact mock policy');
select is(public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='contract-policy'),(select v->>'content_hash'from p228 where k='contract-policy'),true,'Reviewed temporary noncontractual simulation policy')->>'replayed','true','approval retry creates no extra policy version');
select ok((select count(*)=1 and bool_and(valid_until<=approved_at+interval'24 hours'and governance_content_hash is not null and issuer_organization_id='f9810000-0000-4000-8000-000000000001')from private.contract_signature_policy_versions_v1 where governance_proposal_id=(select(v->>'proposal_id')::uuid from p228 where k='contract-policy')),'runtime policy keeps approved source, issuer, hash and bounded expiry');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
insert into p228 values('amendment-policy',pg_temp.propose_policy('AMENDMENT',1,'p228-amendment-policy'));
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='amendment-policy'),(select v->>'content_hash'from p228 where k='amendment-policy'),true,'Reviewed separate temporary amendment policy');
-- A configured URL is not evidence of an installed native adapter or legal approval.
insert into public.signature_provider_configs(id,provider_code,environment,version,status,supported_levels,endpoint_base_url)values('f9890000-0000-4000-8000-000000000001','UNINSTALLED_TEST_ONLY','DEVELOPMENT',1,'ACTIVE',array['SIMPLE'],'https://not-contacted.example.invalid');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
insert into p228 values('real-policy',public.propose_signature_policy_v1('f9810000-0000-4000-8000-000000000001','CONTRACT','f9890000-0000-4000-8000-000000000001','SIMPLE',true,true,'LEGAL-UNVERIFIED-REFERENCE','ADAPTER-UNVERIFIED-REFERENCE',1,'Real configuration remains blocked without actual attestations','f9890000-0000-4000-8000-000000000002'));
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select throws_ok($$select public.decide_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='real-policy'),(select v->>'content_hash'from p228 where k='real-policy'),true,'No real native adapter or legal evidence supplied')$$,'55000','SIGNATURE_REAL_ADAPTER_VALIDATION_REQUIRED','two administrators and reference strings cannot invent an installed real provider or legal approval');
select ok(not exists(select 1 from private.contract_signature_policy_versions_v1 where provider_config_id='f9890000-0000-4000-8000-000000000001'),'unverified real proposal creates no enabled runtime policy');
select is(public.list_signature_policy_governance_v1()->>'environment','DEVELOPMENT','governance reads trusted database environment');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
create function pg_temp.governed_mock(p_envelope uuid,p_action text,p_signer uuid,p_key text)returns jsonb language plpgsql as $$declare cmd jsonb;r jsonb;begin
 perform pg_temp.as_user('f9800000-0000-4000-8000-000000000001');cmd:=public.request_signature_mock_step_v1(p_envelope,p_action,p_signer,md5(p_key)::uuid);
 perform pg_temp.as_service();r:=public.execute_signature_mock_step_v1((cmd->>'command_id')::uuid);return r;
end$$;
insert into p228 values('contract',public.create_signature_envelope('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-contract.pdf','test-contracts/p228.pdf',repeat('b',64),'p228-create-envelope'));
create function pg_temp.env(p_kind text)returns uuid language sql as $$select(v->>'envelope_id')::uuid from p228 where k=p_kind$$;
select is(public.get_contract_signature_readiness_v1('f9830000-0000-4000-8000-000000000001')->>'status','AUTHORITIES_REQUIRED','an envelope alone is not signature readiness');
select throws_ok($$select public.add_signature_signer(pg_temp.env('contract'),'f9810000-0000-4000-8000-000000000002','f9800000-0000-4000-8000-000000000003','PROVIDER_OWNER',repeat('a',64),2,'p228-foreign-signer')$$,'22023','INVALID_SIGNATURE_SIGNER','cross-party user cannot be configured as the provider signer');
create function pg_temp.prepare_signers(p_kind text)returns void language plpgsql as $$declare envelope uuid:=pg_temp.env(p_kind);s uuid;begin
 perform pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
 s:=(public.add_signature_signer(envelope,'f9810000-0000-4000-8000-000000000001','f9800000-0000-4000-8000-000000000001','CLIENT_OWNER',encode(extensions.digest('p228-client@example.invalid','sha256'),'hex'),1,'p228-client:'||p_kind)->>'signer_id')::uuid;
 insert into p228 values(p_kind||'-client',jsonb_build_object('id',s));
 perform public.authorize_signature_signer(s,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'test-authorities/client.pdf',repeat('c',64),'p228-client-authority:'||p_kind);
 s:=(public.add_signature_signer(envelope,'f9810000-0000-4000-8000-000000000002','f9800000-0000-4000-8000-000000000002','PROVIDER_OWNER',encode(extensions.digest('p228-provider@example.invalid','sha256'),'hex'),2,'p228-provider:'||p_kind)->>'signer_id')::uuid;
 insert into p228 values(p_kind||'-provider',jsonb_build_object('id',s));
 perform pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
 perform public.authorize_signature_signer(s,'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],20000,'MAD',current_date-1,current_date+1,'test-authorities/provider.pdf',repeat('d',64),'p228-provider-authority:'||p_kind);
 perform pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
end$$;
select pg_temp.prepare_signers('contract');
select throws_ok($$select public.add_signature_signer(pg_temp.env('contract'),'f9810000-0000-4000-8000-000000000001','f9800000-0000-4000-8000-000000000001','CLIENT_ADMIN',repeat('e',64),1,'p228-client:contract')$$,'22000','SIGNATURE_SIGNER_IDEMPOTENCY_MISMATCH','signer retries cannot silently change role or verified mailbox');
select throws_ok($$select public.authorize_signature_signer((select(v->>'id')::uuid from p228 where k='contract-client'),'LEGAL_REPRESENTATIVE',array['CONTRACT_SIGNATURE'],999999,'MAD',current_date-1,current_date+1,'test-authorities/client.pdf',repeat('c',64),'p228-client-authority:contract')$$,'22000','SIGNATURE_AUTHORITY_IDEMPOTENCY_MISMATCH','authority retry cannot silently broaden the amount ceiling');
select is(public.get_contract_signature_readiness_v1('f9830000-0000-4000-8000-000000000001')->>'status','READY_TO_SUBMIT','exact parties with verified mailboxes and adequate authorities can submit explicitly configured mock');
select is(public.submit_contract_for_signature('f9830000-0000-4000-8000-000000000001',1,'p228-submit')->>'outcome','CONTRACT_PENDING_SIGNATURE','legacy submit delegates to actual mandatory ready transition');
select ok((select source_hash=repeat('a',64)and pdf_sha256=repeat('b',64)and policy_version_id is not null from private.contract_signature_bindings_v1 where envelope_id=pg_temp.env('contract')),'canonical contract hash, distinct PDF hash and approved policy version are bound separately');
select pg_temp.as_service();
select is(public.dispatch_governed_signature_envelope_v1(pg_temp.env('contract'))->>'outcome','SIGNATURE_ENVELOPE_SENT','outbox dispatch executes actual governed mock SDK send');
select is(pg_temp.governed_mock(pg_temp.env('contract'),'SENT',null,'p228-contract-sent')->>'outcome','SIGNATURE_ENVELOPE_SENT','configured development mock uses actual sent transition');
select is(pg_temp.governed_mock(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p228 where k='contract-client'),'p228-client-signed')->>'outcome','SIGNATURE_ENVELOPE_PARTIALLY_SIGNED','first native signature does not activate contract');
select is((select status from public.contracts where id='f9830000-0000-4000-8000-000000000001'),'PENDING_SIGNATURE','contract remains pending after only one party');
select is((select count(*)from public.contract_signatures where contract_id='f9830000-0000-4000-8000-000000000001'),0::bigint,'unsealed partial evidence does not become a completed legacy signature fact');
insert into p228 values('completed',pg_temp.governed_mock(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p228 where k='contract-provider'),'p228-provider-signed'));
select is((select status from public.contracts where id='f9830000-0000-4000-8000-000000000001'),'ACTIVE','only completed sealed two-party envelope activates contract');
select ok((select count(*)=2 and bool_and(contract_hash=repeat('a',64)and proof->>'pdf_sha256'=repeat('b',64)and(proof->>'development_mock')::boolean)from public.contract_signatures where contract_id='f9830000-0000-4000-8000-000000000001'),'legacy facts keep canonical hash and honest mock/PDF evidence separately');
select is(pg_temp.governed_mock(pg_temp.env('contract'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p228 where k='contract-provider'),'p228-provider-signed')->>'replayed','true','verified callback replay is idempotent');
select is((select count(*)from public.contract_signatures where contract_id='f9830000-0000-4000-8000-000000000001'),2::bigint,'callback retry never creates more signatures');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
insert into p228 select'proof',jsonb_build_object('envelope_id',pg_temp.env('contract'),'evidence_package_id',v->>'evidence_package_id','final_hash',v->>'final_hash')from p228 where k='completed';
select throws_ok($$select public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',repeat('b',64),'CLIENT_OWNER',(select v from p228 where k='proof'),'p228-wrong-sourcehash')$$,'40001','STALE_CONTRACT_VERSION','a PDF hash cannot stand in for the canonical contract source hash');
select throws_ok($$select public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v||jsonb_build_object('final_hash',repeat('f',64))from p228 where k='proof'),'p228-forged-finalhash')$$,'23514','SIGNATURE_EVIDENCE_HASH_MISMATCH','client cannot substitute a final evidence hash');
select is(public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v from p228 where k='proof'),'p228-verify-existing')->>'outcome','CONTRACT_SIGNED','legacy API can read only the verified imported fact');
select throws_ok($$select public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000002',repeat('a',64),'PROVIDER_OWNER',(select v from p228 where k='proof'),'p228-cross-party-proof')$$,'42501','CONTRACT_SIGN_DENIED','client cannot claim the other party signature');
select is(public.list_contract_signature_readiness_v1(array['f9830000-0000-4000-8000-000000000001']::uuid[])->0->>'status','SIGNED','batch projection reports only completed verified signatures');
select is(public.revoke_signature_signer_authority_v1((select id from public.signature_signer_authorities where signer_id=(select(v->>'id')::uuid from p228 where k='contract-client')),'Authority withdrawn after completed signed fact','f9880000-0000-4000-8000-000000000002')->>'outcome','SIGNATURE_AUTHORITY_REVOKED','authority withdrawal is append-only even after a completed contract');
select is(public.get_contract_signature_readiness_v1('f9830000-0000-4000-8000-000000000001')->>'status','SIGNED','later authority withdrawal does not rewrite an already verified native signature fact');
select is(public.get_contract_signature_readiness_v1('f9830000-0000-4000-8000-000000000001')->>'development_mock','true','completed development mock is explicitly projected as non-contractual simulation');
select throws_ok($$select public.list_contract_signature_readiness_v1(array_fill('f9830000-0000-4000-8000-000000000001'::uuid,array[101]))$$,'22023','SIGNATURE_READINESS_BATCH_LIMIT','signature projection has bounded batch size');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select throws_ok($$select public.sign_contract('f9830000-0000-4000-8000-000000000001','f9840000-0000-4000-8000-000000000001','f9810000-0000-4000-8000-000000000001',repeat('a',64),'CLIENT_OWNER',(select v from p228 where k='proof'),'p228-mock-prod-proof')$$,'42501','SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH','a mock-completed development proof cannot be reused as production legal evidence');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
-- Identity/selected-quote generation is exercised separately in0220. Seed pre-existing DRAFT amendments only; every signature guard and actual activation remains enabled.
create function pg_temp.draft_amendment(p_delta bigint,p_key text)returns jsonb language plpgsql as $$declare c public.contracts%rowtype;v public.contract_versions%rowtype;change_id uuid;amend_id uuid;n integer;begin
 select*into c from public.contracts where id='f9830000-0000-4000-8000-000000000001';select*into v from public.contract_versions where contract_id=c.id and version=c.current_version;
 insert into public.change_requests(contract_id,requested_by,reason,scope_delta)values(c.id,auth.uid(),'Synthetic draft amendment fixture','{}')returning id into change_id;
 select coalesce(max(amendment_number),0)+1 into n from public.contract_amendments where contract_id=c.id;
 insert into public.contract_amendments(contract_id,change_request_id,base_contract_version_id,amendment_number,price_delta_minor,deadline_delta_days,deliverables_delta,commission_rule_snapshot,content_hash,created_by)values(c.id,change_id,v.id,n,p_delta,1,'[]',v.commission_rule_snapshot,private.canonical_request_hash(jsonb_build_object('fixture_key',p_key,'base',v.id,'delta',p_delta)),auth.uid())returning id into amend_id;
 return jsonb_build_object('amendment_id',amend_id);
end$$;
insert into p228 values('amendment-source',pg_temp.draft_amendment(500,'p228-amendment'));
insert into p228 select'amendment',public.create_amendment_signature_envelope((v->>'amendment_id')::uuid,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-amendment.pdf','test-contracts/p228-amendment.pdf',repeat('e',64),'p228-amendment-envelope')from p228 where k='amendment-source';
select pg_temp.prepare_signers('amendment');
select is(public.get_amendment_signature_readiness_v1((select(v->>'amendment_id')::uuid from p228 where k='amendment-source'))->>'status','READY_TO_SUBMIT','amendment has its own source-bound readiness');
select is(public.submit_contract_amendment_for_signature((select(v->>'amendment_id')::uuid from p228 where k='amendment-source'),(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p228 where k='amendment-source')),'p228-amendment-submit')->>'outcome','CONTRACT_AMENDMENT_PENDING_SIGNATURE','amendment submit binds its own mandate and source before send');
select throws_ok($$select public.sign_and_activate_contract_amendment((select(v->>'amendment_id')::uuid from p228 where k='amendment-source'),'f9810000-0000-4000-8000-000000000001',(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p228 where k='amendment-source')),'CLIENT_OWNER',(select v from p228 where k='proof'),'p228-reuse-contract-proof-for-amendment')$$,'23514','SIGNATURE_SOURCE_BINDING_MISMATCH','a signed base contract is never a signature of its later amendment');
select pg_temp.as_service();
select pg_temp.governed_mock(pg_temp.env('amendment'),'SENT',null,'p228-amendment-sent');
select pg_temp.governed_mock(pg_temp.env('amendment'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p228 where k='amendment-client'),'p228-amendment-client');
select is((select current_version from public.contracts where id='f9830000-0000-4000-8000-000000000001'),1,'partial amendment does not alter the original version');
select pg_temp.governed_mock(pg_temp.env('amendment'),'SIGNER_SIGNED',(select(v->>'id')::uuid from p228 where k='amendment-provider'),'p228-amendment-provider');
select is((select current_version from public.contracts where id='f9830000-0000-4000-8000-000000000001'),2,'completed exact amendment creates and selects the next immutable contract version');
select is((select price_minor from public.contract_versions where contract_id='f9830000-0000-4000-8000-000000000001'and version=2),10500::bigint,'verified amendment activation preserves exact-money delta');

-- A later explicit authority withdrawal blocks any subsequent native send.
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
insert into p228 values('withdrawal-source',pg_temp.draft_amendment(100,'p228-withdrawal-amendment'));
insert into p228 select'withdrawal',public.create_amendment_signature_envelope((v->>'amendment_id')::uuid,'MATRICIA_DEV_MOCK','DEVELOPMENT','SIMPLE','test-amendment2.pdf','test-contracts/p228-amendment2.pdf',repeat('f',64),'p228-withdrawal-envelope')from p228 where k='withdrawal-source';
select pg_temp.prepare_signers('withdrawal');
select public.submit_contract_amendment_for_signature((select(v->>'amendment_id')::uuid from p228 where k='withdrawal-source'),(select content_hash from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p228 where k='withdrawal-source')),'p228-withdrawal-submit');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000004');
select throws_ok($$select public.cancel_development_signature_envelope_v1(pg_temp.env('withdrawal'),2,'Cannot cancel another organization mock envelope',md5('p228-foreign-cancel')::uuid)$$,'42501','SIGNATURE_LOCAL_MOCK_CANCELLATION_DENIED','a foreign tenant owner cannot cancel an envelope outside their parties');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select throws_ok($$select public.cancel_development_signature_envelope_v1(pg_temp.env('withdrawal'),2,'No local demo cancellation in production context',md5('p228-prod-cancel')::uuid)$$,'42501','SIGNATURE_LOCAL_MOCK_CANCELLATION_DENIED','local mock cancellation cannot operate against a production database');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into p228 values('pending-cancel-command',public.request_signature_mock_step_v1(pg_temp.env('withdrawal'),'SENT',null,md5('p228-pending-local-cancel')::uuid));
select is(public.revoke_signature_signer_authority_v1((select id from public.signature_signer_authorities where signer_id=(select(v->>'id')::uuid from p228 where k='withdrawal-client')),'Authority withdrawn before any provider send','f9880000-0000-4000-8000-000000000001')->>'outcome','SIGNATURE_AUTHORITY_REVOKED','authority withdrawal is an actual immutable command');
select pg_temp.as_service();
select throws_ok($$select pg_temp.governed_mock(pg_temp.env('withdrawal'),'SENT',null,'p228-withdrawn-send')$$,'23514','SIGNER_AUTHORITY_REQUIRED','withdrawn authority blocks send even after ready and submission');
select is((select count(*)from public.signature_provider_events where envelope_id=pg_temp.env('withdrawal')),0::bigint,'revoked authority cannot produce a fictional provider event');
select ok(not has_function_privilege('authenticated','private.apply_verified_contract_amendment_v1(uuid,uuid,uuid,text,text,jsonb,text,uuid)','EXECUTE')and not has_function_privilege('service_role','private.complete_contract_signatures_from_envelope_v1(uuid,uuid)','EXECUTE'),'raw proof import cores are private to verified callback orchestration');
select ok(not has_table_privilege('authenticated','private.contract_signature_policy_versions_v1','INSERT')and not has_table_privilege('service_role','private.contract_signature_bindings_v1','INSERT'),'neither tenant nor service client can forge policy or source bindings directly');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000001');
select is(public.cancel_development_signature_envelope_v1(pg_temp.env('withdrawal'),(select row_version from public.signature_envelopes where id=pg_temp.env('withdrawal')),'Stop a noncontractual mock before any send',md5('p228-local-cancel')::uuid)->>'outcome','SIGNATURE_DEVELOPMENT_ENVELOPE_VOIDED','a current party can cancel the local ready mock even after an authority was withdrawn');
select ok(private.signature_envelope_void_is_recorded_v1(pg_temp.env('withdrawal')),'local cancellation has a durable source-bound proof');
select is((select status from public.contract_amendments where id=(select(v->>'amendment_id')::uuid from p228 where k='withdrawal-source')),'DRAFT','a never-sent cancelled amendment returns to a real editable draft');
select is(public.cancel_development_signature_envelope_v1(pg_temp.env('withdrawal'),2,'Stop a noncontractual mock before any send',md5('p228-local-cancel')::uuid)->>'outcome','SIGNATURE_DEVELOPMENT_ENVELOPE_VOIDED','lost cancellation response can replay without another state mutation');
select is((select count(*)from private.signature_local_cancellations_v1 where envelope_id=pg_temp.env('withdrawal')),1::bigint,'cancellation retries create only one immutable proof');
select throws_ok($$select public.cancel_development_signature_envelope_v1(pg_temp.env('contract'),(select row_version from public.signature_envelopes where id=pg_temp.env('contract')),'Cannot locally void an actually completed native mock',md5('p228-signed-cancel-denied')::uuid)$$,'55000','SIGNATURE_NATIVE_CANCELLATION_REQUIRED','already completed signatures cannot be erased by local cancellation');
select pg_temp.as_service();
select is(public.execute_signature_mock_step_v1((select(v->>'command_id')::uuid from p228 where k='pending-cancel-command'))->>'outcome','SIGNATURE_SIMULATION_CANCELLED','queued send command is honestly cancelled rather than retried or marked SENT');
select is((select count(*)from public.signature_provider_events where envelope_id=pg_temp.env('withdrawal')),0::bigint,'local stop creates no fictional provider cancellation or send event');
select is(public.dispatch_governed_signature_envelope_v1(pg_temp.env('withdrawal'))->>'outcome','SIGNATURE_DISPATCH_CANCELLED','pending ready dispatch observes the proven cancellation without sending');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select is(public.disable_signature_policy_v1((select(v->>'proposal_id')::uuid from p228 where k='amendment-policy'),'Stop and clean up the temporary noncontractual test policy')->>'outcome','SIGNATURE_POLICY_DISABLED','AAL2 safety stop records an immutable revocation');
select is((select status from public.signature_envelopes where id=pg_temp.env('withdrawal')),'VOIDED','disable cleans up pending governed mock envelopes without changing completed evidence');
select throws_ok($$select private.require_contract_signature_policy_v1('AMENDMENT')$$,'55000','SIGNATURE_PROVIDER_NOT_CONFIGURED','disabled policy never falls back to an older policy');
select pg_temp.as_service();
select is(public.dispatch_governed_signature_envelope_v1(pg_temp.env('withdrawal'))->>'outcome','SIGNATURE_DISPATCH_CANCELLED','pending outbox dispatch records an actual policy cancellation instead of fictional send');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select ok(not has_function_privilege('authenticated','public.execute_signature_mock_step_v1(uuid)','EXECUTE')and not has_table_privilege('service_role','private.signature_adapter_attestations_v1','INSERT'),'application clients cannot execute native callbacks or forge adapter attestations');
-- Historical expired policy fixture simulates elapsed time without changing the server clock.
insert into private.contract_signature_policy_versions_v1(environment,source_kind,version,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,approved_at,valid_until)
select environment,source_kind,version+1,provider_config_id,minimum_level,allow_development_mock,require_certificate,require_trusted_timestamp,approval_reference,adapter_registration_reference,approved_by,reviewed_by,clock_timestamp()-interval'2 hours',clock_timestamp()-interval'1 hour'from private.contract_signature_policy_versions_v1 where governance_proposal_id=(select(v->>'proposal_id')::uuid from p228 where k='contract-policy');
select throws_ok($$select private.require_contract_signature_policy_v1('CONTRACT')$$,'55000','SIGNATURE_PROVIDER_NOT_CONFIGURED','an expired latest policy cannot silently restore an older unexpired policy');
select ok(private.contract_version_signature_effective_v1('f9830000-0000-4000-8000-000000000001',(select id from public.contract_versions where contract_id='f9830000-0000-4000-8000-000000000001'and version=2)),'policy disable or later expiry does not erase an already completed native source chain');
select pg_temp.as_service();
select is(public.execute_signature_mock_step_v1((select id from private.signature_mock_commands_v1 where idempotency_key=md5('p228-provider-signed')::uuid))->>'replayed','true','an already executed sealed step remains acknowledged after policy expiry without re-execution');
select is(public.dispatch_governed_signature_envelope_v1(pg_temp.env('contract'))->>'outcome','SIGNATURE_ENVELOPE_SENT','a persisted native send remains acknowledged after expiry without a second send');
select pg_temp.as_user('f9800000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"f9800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.list_signature_policy_governance_v1()$$,'42501','SIGNATURE_POLICY_ADMIN_AAL2_REQUIRED','governance read also requires actual second factor');
select ok((select bool_and(strpos(lower(pg_get_functiondef(oid)),'lock_contract_financial_parties_v1')>0 and strpos(lower(pg_get_functiondef(oid)),'lock_contract_financial_parties_v1')<strpos(lower(pg_get_functiondef(oid)),'for update'))from pg_proc where oid=any(array['public.submit_contract_for_signature(uuid,integer,text,uuid)'::regprocedure,'public.submit_contract_amendment_for_signature(uuid,text,text,uuid)'::regprocedure,'public.ready_signature_envelope(uuid,integer,text,uuid)'::regprocedure,'public.execute_signature_mock_step_v1(uuid)'::regprocedure,'public.dispatch_governed_signature_envelope_v1(uuid)'::regprocedure])),'all producer paths acquire the common ordered financial mutex before row locks');
select*from finish();rollback;
