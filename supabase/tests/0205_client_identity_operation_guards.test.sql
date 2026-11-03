begin;
set local search_path=public,extensions;
-- Synthetic checkout prerequisite, executed through the actual public commands.
-- Two dedicated Finance actors keep content authorship and approval independent;
-- both their fixture identities and the resulting audit/outbox roll back below.
create function pg_temp.seed_approved_box_checkout(
  p_organization_id uuid, p_plan_version_id uuid, p_rollover_months integer default 3
) returns void language plpgsql as $$
declare
  author_id uuid := 'ff850000-0000-4000-8000-000000000001';
  reviewer_id uuid := 'ff850000-0000-4000-8000-000000000002';
  prior_sub text := current_setting('request.jwt.claim.sub', true);
  prior_claims text := current_setting('request.jwt.claims', true);
  plan public.subscription_plan_versions%rowtype;
  benefit jsonb; box jsonb; rule jsonb; approval_context jsonb;
  fixture_key text := 'checkout-fixture-' || p_plan_version_id::text;
begin
  select * into strict plan from public.subscription_plan_versions where id = p_plan_version_id;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(author_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-author@example.invalid','',now(),'{}','{}',now(),now()),
        (reviewer_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-reviewer@example.invalid','',now(),'{}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.platform_user_roles(user_id,role_code) values(author_id,'FINANCE_MANAGER'),(reviewer_id,'FINANCE_MANAGER') on conflict do nothing;
  perform set_config('request.jwt.claim.sub',author_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated','aal','aal2')::text,true);
  benefit := public.create_benefit_version(p_organization_id,'CHECKOUT_FIXTURE_BENEFIT','CREDIT_SERVICE','MATRICIA_INTERNAL',
    'Avantage synthétique de recette','ميزة اختبار اصطناعية','Prérequis de recette uniquement','شرط للاختبار فقط',
    1,0,0,plan.currency,null,null,null,'{}','{}','TEST_ONLY_CHECKOUT',clock_timestamp()-interval '1 minute',fixture_key||'-benefit');
  perform public.activate_benefit_version(p_organization_id,(benefit->>'benefit_version_id')::uuid,fixture_key||'-benefit-active');
  box := public.create_box_version(p_organization_id,'CHECKOUT_FIXTURE_BOX','FIXED','Box synthétique de recette','صندوق اختبار اصطناعي',
    plan.monthly_credit_grant,p_rollover_months,'{}',0,0,0,plan.currency,clock_timestamp()-interval '1 minute',
    jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,
      'allowed_benefit_version_ids',jsonb_build_array(benefit->>'benefit_version_id'))),fixture_key||'-box');
  perform public.activate_box_version(p_organization_id,(box->>'box_version_id')::uuid,null,fixture_key||'-box-active');
  rule := public.link_plan_box_rule(p_organization_id,p_plan_version_id,(box->>'box_version_id')::uuid,
    '{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"AT_MOST"}',clock_timestamp()-interval '1 minute',fixture_key||'-rule');
  approval_context := public.get_box_configuration_approval_context_v1((rule->>'plan_box_rule_id')::uuid);
  perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated','aal','aal2')::text,true);
  perform public.approve_box_configuration_v1((rule->>'plan_box_rule_id')::uuid,approval_context->>'source_hash',
    'TEST ONLY independent approval of synthetic checkout terms',fixture_key||'-approve');
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,'{}'),true);
end;
$$;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST_ONLY_IDENTITY205'where singleton;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select format('a2050000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','identity205-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2050000-0000-4000-8000-000000000001','Identity buyer 205','Identity 205','ACTIVE','a2050000-0000-4000-8000-000000000001'),('b2050000-0000-4000-8000-000000000002','New onboarding 205','Pending 205','PENDING','a2050000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001','a2050000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2050000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a2050000-0000-4000-8000-000000000002','FINANCE_MANAGER');
insert into public.platform_user_roles(user_id,role_code)values('a2050000-0000-4000-8000-000000000003','FINANCE_MANAGER');
insert into public.platform_user_roles(user_id,role_code)select('a2050000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'SUPER_ADMIN'from generate_series(2,4)i;
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b2050000-0000-4000-8000-000000000001','ICE','205000000000001','VERIFIED'),('b2050000-0000-4000-8000-000000000001','IF','20500001','VERIFIED'),('b2050000-0000-4000-8000-000000000001','RC','RC-205','VERIFIED');
insert into public.credit_wallets(id,organization_id,wallet_type)values('d2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001','CLIENT');
insert into public.benefit_definitions(id,code,status,created_by)values('e2050000-0000-4000-8000-000000000001','IDENTITY_TEST_205','ACTIVE','a2050000-0000-4000-8000-000000000002');
insert into public.benefit_versions(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,credit_cost,reference_value_minor,internal_cost_minor,currency,cancellation_rule_version,effective_from,content_hash,created_by)values('e2050000-0000-4000-8000-000000000002','e2050000-0000-4000-8000-000000000001',1,'ACTIVE','CONSULTATION','MATRICIA_INTERNAL','Conseil de recette','استشارة اختبار','Conseil de recette','استشارة اختبار',1,100,50,'MAD','v1',now()-interval'1 day',repeat('a',64),'a2050000-0000-4000-8000-000000000002');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,configuration,effective_from,content_hash,created_by)values('IDENTITY_TEST_205',1,'ACTIVE',true,'{}',now()-interval'1 day',repeat('a',64),'a2050000-0000-4000-8000-000000000002');
-- Verified source facts are supplied independently of the approval workflow (0194 tests that workflow).
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,verified_at,activated_at,decided_by,created_by)values('f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001','VERIFIED',1,now()-interval'1 day',now()-interval'1 day','a2050000-0000-4000-8000-000000000002','a2050000-0000-4000-8000-000000000001');
insert into public.client_profile_versions(id,compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by,created_at)values('f2050000-0000-4000-8000-000000000002','f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"20500001","rc_number":"RC-205","registered_city":"Casablanca","registered_address":{"line1":"Adresse de recette"}}','{"legal_name":"Identity buyer 205","country_code":"MA","identifiers":{"ICE":"205000000000001"}}',1,'a2050000-0000-4000-8000-000000000001',now()-interval'2 days');
insert into public.client_trials(organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('b2050000-0000-4000-8000-000000000001','f2050000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'1 day',now()+interval'29 days','a2050000-0000-4000-8000-000000000002');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001',1,now()-interval'1 day','a2050000-0000-4000-8000-000000000002','HISTORICAL_TRIAL');
insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,status,uploaded_at,reviewed_by,reviewed_at,created_by,scan_status,current_scan_result_id,scanned_at,detected_mime_type,detected_size_bytes)
select format('d2051000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001',kind,1,(select id from public.client_document_policy_versions where document_type=kind and status='ACTIVE'),'DOC-205-'||i,'Fixture officielle','2020-01-01','identity-205-'||i||'.pdf','pdf','application/pdf',100,repeat('a',64),repeat('b',32)||'/identity-205-'||i||'.pdf','VERIFIED',now(),'a2050000-0000-4000-8000-000000000002',now(),'a2050000-0000-4000-8000-000000000001','PENDING',null,null,'application/pdf',100 from(values(1,'REGISTRATION_DOCUMENT'),(2,'REPRESENTATIVE_AUTHORITY'),(3,'TAX_DOCUMENT'))x(i,kind);
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,scanner_principal,correlation_id)
select format('d2052000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,format('d2051000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'b2050000-0000-4000-8000-000000000001',1,'CLEAN','TEST_SCANNER','test-v1',repeat('a',64),'application/pdf',100,'SUPABASE_SERVICE_ROLE','d2051000-0000-4000-9000-000000000002'from generate_series(1,3)i;
update public.client_compliance_documents document
set current_scan_result_id=scan.id,scan_status='CLEAN',scanned_at=clock_timestamp()
from private.client_document_scan_results scan
where scan.document_id=document.id and document.compliance_case_id='f2050000-0000-4000-8000-000000000001';
insert into public.client_compliance_evidence(compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,reviewed_by,reviewed_at,created_by,validation_state,source_document_id)
select compliance_case_id,organization_id,document_type,storage_object_path,declared_sha256,'VERIFIED','a2050000-0000-4000-8000-000000000002',now(),'a2050000-0000-4000-8000-000000000001','SCANNED_CLEAN',id from public.client_compliance_documents where compliance_case_id='f2050000-0000-4000-8000-000000000001';

-- Explicit historical published plan/rollover Box; no customer Box assignment or
-- real commercial approval is claimed by this setup. PSP callbacks below are a
-- synthetic trusted service boundary, not an external payment certification.
insert into public.subscription_plans(id,code,status,created_by)values('d2059000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2050000-0000-4000-8000-000000000002');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('d2059000-0000-4000-8000-000000000002','d2059000-0000-4000-8000-000000000001',1,'ACTIVE','MAD',1000,10000,10,5000,5000,'{}',current_date-365,repeat('c',64),'a2050000-0000-4000-8000-000000000002');
insert into public.box_definitions(id,code,status,created_by)values('d2059000-0000-4000-8000-000000000003','TEST_ROLLOVER_205','ACTIVE','a2050000-0000-4000-8000-000000000002');
insert into public.box_versions(id,box_id,version,status,box_type,name_fr,name_ar,credit_budget,rollover_months,rules_snapshot,cost_low_minor,cost_expected_minor,cost_full_minor,currency,content_hash,effective_from,created_by,created_at)values('d2059000-0000-4000-8000-000000000004','d2059000-0000-4000-8000-000000000003',1,'ACTIVE','FIXED','TEST rollover205','ترحيل اختبار205',10,1,'{}',0,0,0,'MAD',repeat('b',64),now()-interval'1 year','a2050000-0000-4000-8000-000000000002',now()-interval'1 year');
insert into public.plan_box_rules(plan_version_id,box_version_id,status,effective_from,rule_snapshot,created_at)values('d2059000-0000-4000-8000-000000000002','d2059000-0000-4000-8000-000000000004','ACTIVE',now()-interval'1 year','{}',now()-interval'1 year');
insert into public.subscriptions(id,organization_id,status)values('d2059000-0000-4000-8000-000000000005','b2050000-0000-4000-8000-000000000001','TRIAL_EXPIRED');
select pg_temp.seed_approved_box_checkout('b2050000-0000-4000-8000-000000000001','d2059000-0000-4000-8000-000000000002',1);
create temporary table funding205(k text primary key,v jsonb);
create function pg_temp.actor205(p_uid uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_uid,'role','authenticated','aal','aal2')::text,true);end$$;
select pg_temp.actor205('a2050000-0000-4000-8000-000000000002');
insert into funding205 values('posting',public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2059000-0000-4000-8000-000000000002',null,'MAD','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('cash_account_code','TEST205_CASH_MAD','cash_name_fr','TEST cash','cash_name_ar','خزينة اختبار','suspense_account_code','TEST205_PENDING_MAD','suspense_name_fr','TEST pending','suspense_name_ar','قيد اختبار'),'TEST synthetic posting only','TEST-205-posting'));
select pg_temp.actor205('a2050000-0000-4000-8000-000000000003');
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from funding205 where k='posting'),true,(select v->>'request_hash'from funding205 where k='posting'),'TEST independent synthetic posting approval');
select pg_temp.actor205('a2050000-0000-4000-8000-000000000001');
insert into funding205 values('prepared',public.prepare_subscription_payment_intent_v2('b2050000-0000-4000-8000-000000000001','d2059000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','TEST-205-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into funding205 values('registered',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from funding205 where k='prepared'),'SANDBOX','SYNTHETIC-205-ORDER',1000,'MAD'));
insert into funding205 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-205-CAPTURE-EVENT','SYNTHETIC-205-ORDER','PAYMENT_SUCCEEDED',1000,'MAD',clock_timestamp(),'SYNTHETIC-205-CAPTURE',repeat('d',64),repeat('e',64)));
select pg_temp.actor205('a2050000-0000-4000-8000-000000000002');
insert into funding205 select'payment-id',to_jsonb(id::text)from public.subscription_payment_events where provider_event_id='SYNTHETIC-205-CAPTURE-EVENT';
insert into funding205 values('terms',public.get_subscription_credit_grant_context_v1('b2050000-0000-4000-8000-000000000001',(select(v#>>'{}')::bigint from funding205 where k='payment-id'),1));
insert into funding205 values('grant',public.issue_subscription_credit_grant_v1('b2050000-0000-4000-8000-000000000001',(select(v#>>'{}')::bigint from funding205 where k='payment-id'),1,(select v#>>'{terms,terms_hash}'from funding205 where k='terms'),'grant-before-205'));
insert into funding205 values('policy-context',public.get_admin_benefit_admission_context_v1('e2050000-0000-4000-8000-000000000002'));
insert into funding205 values('policy',public.propose_benefit_admission_policy_v1('e2050000-0000-4000-8000-000000000002',(select v->>'source_hash'from funding205 where k='policy-context'),null,'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,'TEST explicit human report and independent Client receipt policy','TEST_POLICY_205','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','e2059000-0000-4000-8000-000000000001'));
select pg_temp.actor205('a2050000-0000-4000-8000-000000000003');
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from funding205 where k='policy'),(select v->>'content_hash'from funding205 where k='policy'),true,'TEST_POLICY_REVIEW_205','TEST independent admission policy approval');
select pg_temp.actor205('a2050000-0000-4000-8000-000000000001');
insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2059000-0000-4000-8000-000000000001','d2059000-0000-4000-8000-000000000002','IDENTITY_TEST_205',true);

select ok(private.current_subscription_funding_v1('b2050000-0000-4000-8000-000000000001')is not null,'credit source is the real PSPv2-funded immutable plan/cycle/journal');
select ok(private.client_may_open_new_service_request('b2050000-0000-4000-8000-000000000001'),'verified identity allows new requests before the change');
select ok(public.subscription_has_entitlement('b2050000-0000-4000-8000-000000000001','IDENTITY_TEST_205'),'verified identity allows the current entitlement');
select set_config('test.previous_reservation',(public.reserve_benefit_credits('b2050000-0000-4000-8000-000000000001','d2050000-0000-4000-8000-000000000001','e2050000-0000-4000-8000-000000000002',2,now()+interval'1 day','reserve-before-identity-205')->>'redemption_id'),true);
-- Mirror the canonical invalidation facts; never modify an old profile or paid trial.
update public.organizations set status='PENDING',row_version=row_version+1 where id='b2050000-0000-4000-8000-000000000001';
update public.organization_identifiers set is_active=false where organization_id='b2050000-0000-4000-8000-000000000001'and identifier_type='ICE';
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b2050000-0000-4000-8000-000000000001','ICE','205000000000002','PENDING');
update public.organization_identifiers set verification_status='PENDING'where organization_id='b2050000-0000-4000-8000-000000000001'and identifier_type in('IF','RC');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)
select compliance_case_id,organization_id,2,profile_data,jsonb_set(organization_snapshot,'{identifiers,ICE}','"205000000000002"'),2,created_by from public.client_profile_versions where id='f2050000-0000-4000-8000-000000000002';
update public.client_compliance_cases set current_profile_version=2,status='DOCUMENTS_REQUIRED',verified_at=null,activated_at=null where id='f2050000-0000-4000-8000-000000000001';
select private.set_client_compliance_anomaly('f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001','ICE_NOT_VERIFIED','identifiers.ice',true,'ICE à revérifier','يجب التحقق من المعرف','a2050000-0000-4000-8000-000000000002');
select ok(not private.client_may_open_new_service_request('b2050000-0000-4000-8000-000000000001'),'identity invalidation blocks new requests');
select ok(not public.subscription_has_entitlement('b2050000-0000-4000-8000-000000000001','IDENTITY_TEST_205'),'identity invalidation blocks new entitlements');
select throws_ok($$select public.create_service_request('b2050000-0000-4000-8000-000000000001','e2050000-0000-4000-9000-000000000001','e2050000-0000-4000-9000-000000000002',null,'{}','Test identité','request-during-identity-205')$$,'42501','CLIENT_REQUEST_NOT_ENTITLED','the actual request command enforces invalidated identity');
select throws_ok($$select public.reserve_benefit_credits('b2050000-0000-4000-8000-000000000001','d2050000-0000-4000-8000-000000000001','e2050000-0000-4000-8000-000000000002',1,now()+interval'1 day','reserve-during-identity-205')$$,'55000','BENEFIT_ORGANIZATION_NOT_ACTIVE','new credit reservation is refused while the organisation is pending identity review');
select set_config('request.jwt.claims','{"sub":"a2050000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select pg_temp.actor205('a2050000-0000-4000-8000-000000000002');
select throws_ok($$select public.issue_credits('b2050000-0000-4000-8000-000000000001',(select wallet_id from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from funding205 where k='grant')),'SUBSCRIPTION_GRANT',(select(v#>>'{terms,quantity}')::bigint from funding205 where k='terms'),(select(v#>>'{terms,expires_at}')::timestamptz from funding205 where k='terms'),null,(select v#>>'{terms,source_reference}'from funding205 where k='terms'),0,(select v#>>'{terms,rule_version}'from funding205 where k='terms'),null,'grant-during-identity-205')$$,'55000','CLIENT_IDENTITY_REVIEW_REQUIRED','new canonical grant command is refused during identity review');
select is((select sum(quantity)::bigint from public.credit_ledger_entries where wallet_id='d2050000-0000-4000-8000-000000000001'),8::bigint,'rejected operations preserve the historical credit balance');
select pg_temp.actor205('a2050000-0000-4000-8000-000000000001');
select lives_ok(format('select public.release_benefit_credits(%L::uuid,%L,%L)',current_setting('test.previous_reservation'),'CLIENT_CANCELLATION','release-during-identity-205'),'return of a previous reservation remains allowed');
select ok(private.client_identity_allows_new_operations('b2050000-0000-4000-8000-000000000002'),'an unrelated PENDING onboarding organization is not blocked by principle');
-- Canonical verification and the real case guard must both succeed for the new profile.
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='b2050000-0000-4000-8000-000000000001'and is_active;
select private.set_client_compliance_anomaly('f2050000-0000-4000-8000-000000000001','b2050000-0000-4000-8000-000000000001','ICE_NOT_VERIFIED','identifiers.ice',false,'ICE à revérifier','يجب التحقق من المعرف','a2050000-0000-4000-8000-000000000002');
select lives_ok($$update public.client_compliance_cases set status='VERIFIED',verified_at=clock_timestamp(),activated_at=clock_timestamp(),decided_by='a2050000-0000-4000-8000-000000000002'where id='f2050000-0000-4000-8000-000000000001'$$,'revalidation records the new identity without resetting the old trial');
select ok(private.client_may_open_new_service_request('b2050000-0000-4000-8000-000000000001'),'revalidated current profile restores request eligibility');
select ok(public.subscription_has_entitlement('b2050000-0000-4000-8000-000000000001','IDENTITY_TEST_205'),'revalidated current profile restores entitlement');

-- Canonical identity revalidation is a prerequisite, not an automatic status
-- mutation. The organisation is reactivated through the real governed Admin
-- request, two different reviewers and the trusted execution boundary.
select pg_temp.actor205('a2050000-0000-4000-8000-000000000002');
insert into funding205 select'reactivation-summary',jsonb_build_object('expectedRowVersion',row_version,'expectedIce','205000000000002','intent','CHANGE_CONFIGURATION','status','ACTIVE','draft',false)from public.organizations where id='b2050000-0000-4000-8000-000000000001';
insert into funding205 values('reactivation',public.request_admin_operational_action(null,'b2050000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION','b2050000-0000-4000-8000-000000000001',private.canonical_request_hash((select v from funding205 where k='reactivation-summary')),(select v from funding205 where k='reactivation-summary'),'TEST identity revalidated; independent organisation reactivation',null,null,null,null,'TEST-205-reactivation'));
select pg_temp.actor205('a2050000-0000-4000-8000-000000000003');
select public.decide_admin_operational_action((select(v->>'action_request_id')::uuid from funding205 where k='reactivation'),'APPROVE','TEST first independent reactivation review',1,'TEST-205-reactivation-review1');
select pg_temp.actor205('a2050000-0000-4000-8000-000000000004');
select public.decide_admin_operational_action((select(v->>'action_request_id')::uuid from funding205 where k='reactivation'),'APPROVE','TEST second independent reactivation review',2,'TEST-205-reactivation-review2');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is((public.execute_admin_operational_action_v1((select(v->>'action_request_id')::uuid from funding205 where k='reactivation'))->>'outcome'),'ADMIN_ACTION_EXECUTED','true governed organisation reactivation follows identity revalidation');
select pg_temp.actor205('a2050000-0000-4000-8000-000000000001');
select lives_ok($$select public.reserve_benefit_credits('b2050000-0000-4000-8000-000000000001','d2050000-0000-4000-8000-000000000001','e2050000-0000-4000-8000-000000000002',1,now()+interval'1 day','reserve-after-identity-205')$$,'new reservation works after verified profile revision');
select is((select verified_profile_version from public.client_trials where organization_id='b2050000-0000-4000-8000-000000000001'),1,'the original verified trial snapshot stays unchanged');
select is((select count(*)::integer from public.client_identity_verification_history where organization_id='b2050000-0000-4000-8000-000000000001'),2,'both verified profile revisions remain in history');
select ok(not has_function_privilege('authenticated','private.client_identity_allows_new_operations(uuid)','EXECUTE'),'identity eligibility helper is not a direct client API');
select * from finish();
rollback;
