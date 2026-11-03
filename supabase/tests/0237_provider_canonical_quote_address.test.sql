-- Canonical Admin identity precondition reused from 0231 at 55a34ba.
-- Its real review/execution assertions remain part of this end-to-end regression.
begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(47);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');


insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values('b1810000-0000-4000-8000-000000000001','ICE','124000000000001','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','IF','12345678','VERIFIED',true),('b1810000-0000-4000-8000-000000000001','RC','TEST124','VERIFIED',true);
-- Seed a previously verified account, with genuine immutable profile/trial
-- rows. Only historical setup bypasses decision triggers; all commands below
-- execute with triggers and authorization restored.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','VERIFIED',1,'a1810000-0000-4000-8000-000000000004',now()-interval'10 days',now()-interval'10 days');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,'{"legal_form":"TEST SARL","incorporation_date":"2018-01-01","activity":"TEST conseil","sector":"TEST services","employee_count":2,"registered_city":"Casablanca","registered_address":{"line1":"TEST ancienne adresse","country_code":"MA"},"contact":{"phone":"+212600000000","email":"contact-test@example.invalid"},"representative":{"first_name":"TEST","last_name":"CLIENT","title":"Gérant TEST","phone":"+212600000001","email":"representative-test@example.invalid","power":"Mandat TEST"},"declarations":{"accuracy_confirmed":true,"representation_authorized":true},"if_number":"12345678","rc_number":"TEST124"}','{"legal_name":"Delivery Test","display_name":"Delivery Test","country_code":"MA","identifiers":{"ICE":"124000000000001","IF":"12345678","RC":"TEST124"}}',1,'a1810000-0000-4000-8000-000000000004');
insert into public.client_trials(organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('b1810000-0000-4000-8000-000000000001','f1940000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',now()-interval'10 days',now()+interval'20 days','a1810000-0000-4000-8000-000000000003');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,now()-interval'10 days','a1810000-0000-4000-8000-000000000003','HISTORICAL_TRIAL');
set local session_replication_role=origin;
create temporary table old_trial as select*from public.client_trials where organization_id='b1810000-0000-4000-8000-000000000001';
create temporary table revision_results(k text primary key,v jsonb);grant all on revision_results to authenticated,service_role;
insert into revision_results values('snapshot',private.admin_organization_identity_edit_snapshot_v1('b1810000-0000-4000-8000-000000000001'));
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)
select('e2310000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'b1810000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),jsonb_build_object('intent','CHANGE_CONFIGURATION','extendedIdentity',true,'expectedRowVersion',1,'expectedIdentityHash',case when i=2 then repeat('f',64)else private.canonical_request_hash((select v from revision_results where k='snapshot'))end,'expectedIce','124000000000001','ice','124000000000001','legalName','Delivery Test','country','MA','ifNumber','87654321','rcNumber','NEW124','identityProfile',case when i=3 then '{"representative":{"email":"injected@example.invalid"}}'::jsonb else '{"legal_form":"TEST SAS","registered_city":"Rabat","registered_address":{"line1":"TEST nouvelle adresse","country_code":"MA"}}'::jsonb end),'TEST legal identity revision with two independent reviews',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'from generate_series(1,3)i;
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select x.id,'APPROVE','Independent TEST legal identity review',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u where x.id::text like'e2310000-%'and u.id in('a1810000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000003');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into revision_results values('stale',public.execute_admin_operational_action_v1('e2310000-0000-4000-8000-000000000002',extensions.gen_random_uuid())),('injected',public.execute_admin_operational_action_v1('e2310000-0000-4000-8000-000000000003',extensions.gen_random_uuid()));
reset role;
select is((select v->>'failure_code'from revision_results where k='stale'),'40001','source identity hash mismatch is rejected before any effect');
select is((select v->>'failure_code'from revision_results where k='injected'),'22023','identity revision cannot modify representative/contact fields');
select is((select count(*)from public.client_profile_versions where compliance_case_id='f1940000-0000-4000-8000-000000000001'),1::bigint,'rejected revisions leave the immutable profile history unchanged');
set local role service_role;
insert into revision_results values('changed',public.execute_admin_operational_action_v1('e2310000-0000-4000-8000-000000000001',extensions.gen_random_uuid())),('replayed',public.execute_admin_operational_action_v1('e2310000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
reset role;
select is((select v->>'outcome'from revision_results where k='changed'),'ADMIN_ACTION_EXECUTED','approved full fiscal/legal revision executes actual mutation');
select is((select normalized_value::text from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and identifier_type='IF'and is_active),'87654321','IF is replaced in the canonical identifier registry');
select is((select normalized_value::text from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and identifier_type='RC'and is_active),'NEW124','RC is replaced in the canonical identifier registry');
select is((select profile_data->>'legal_form'from public.client_profile_versions where compliance_case_id='f1940000-0000-4000-8000-000000000001'and version=2),'TEST SAS','legal form changes the new authoritative profile version');
select is((select profile_data#>>'{registered_address,line1}'from public.client_profile_versions where compliance_case_id='f1940000-0000-4000-8000-000000000001'and version=2),'TEST nouvelle adresse','registered legal address changes the new profile rather than administrative notes');
select is((select profile_data->>'legal_form'from public.client_profile_versions where compliance_case_id='f1940000-0000-4000-8000-000000000001'and version=1),'TEST SARL','the prior legal profile remains immutable');
select is((select status from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),'DOCUMENTS_REQUIRED','changed legal profile requires fresh compliance review');
select is((select status from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'PENDING','organization stays pending fresh identity verification');
select ok(not private.client_identity_allows_new_operations('b1810000-0000-4000-8000-000000000001'),'new Client commitments remain blocked until current profile is reverified');
select is((select count(*)from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and is_active and verification_status='PENDING'),3::bigint,'all three canonical identifiers await verification');
select ok((select to_jsonb(t)=to_jsonb(o)from public.client_trials t cross join old_trial o where t.organization_id=o.organization_id),'full identity revision preserves the original trial byte for byte');
select is((select v->>'result_hash'from revision_results where k='changed'),(select v->>'result_hash'from revision_results where k='replayed'),'replay does not create a second profile revision');
set local session_replication_role=replica;
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('b1770000-0000-0000-0000-000000000001','f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b1810000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004'),
('b1770000-0000-0000-0000-000000000002','f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b1810000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('b1780000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000001','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000001'),
('b1780000-0000-0000-0000-000000000002','b1770000-0000-0000-0000-000000000002','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','b1790000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'b1770000-0000-0000-0000-000000000001' then 'b1780000-0000-0000-0000-000000000001'::uuid
  else 'b1780000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('b1770000-0000-0000-0000-000000000001','b1770000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004','b1770000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f1940000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a1810000-0000-4000-8000-000000000002',clock_timestamp(),'a1810000-0000-4000-8000-000000000004','b1770000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


insert into public.client_compliance_documents(id,compliance_case_id,organization_id,document_type,version,policy_version_id,document_number,issuer,issued_on,expires_on,original_file_name,file_extension,declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by,current_scan_result_id,scan_status,scanned_at)
select'f1990000-0000-4000-8000-000000000001',compliance_case_id,organization_id,'TAX_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='TAX_DOCUMENT'and status='ACTIVE'),'TAX-199',issuer,issued_on,expires_on,'tax199.pdf',file_extension,declared_mime_type,declared_size_bytes,repeat('c',64),'b1810000-0000-4000-8000-000000000001/fixture199/tax199.pdf',detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by,'f1990000-0000-4000-8000-000000000002','CLEAN',clock_timestamp()from public.client_compliance_documents where id='b1770000-0000-0000-0000-000000000001';
insert into private.client_document_scan_results(id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id)values('f1990000-0000-4000-8000-000000000002','f1990000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('c',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE',extensions.gen_random_uuid());
set local session_replication_role=origin;

create temporary table identity_results(k text,v jsonb);grant all on identity_results to authenticated;
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into identity_results values('context',public.get_client_identity_review_context_v1('f1940000-0000-4000-8000-000000000001'));
select throws_ok($$select public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',null,(select(v->>'profile_version')::integer from identity_results where k='context'),(select v->>'identity_hash'from identity_results where k='context'),array(select(d->>'id')::uuid from identity_results,jsonb_array_elements(v->'identity_snapshot'->'documents')d where k='context'),'Refuser un CAS manquant dans la fixture','fixture-client-identity199-null-cas')$$,'22023','INVALID_CLIENT_IDENTITY_REVIEW','nullable expected case version cannot bypass optimistic concurrency');
insert into identity_results select'review',public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',(v->>'case_row_version')::integer,(v->>'profile_version')::integer,v->>'identity_hash',array(select(d->>'id')::uuid from jsonb_array_elements(v->'identity_snapshot'->'documents')d),'Contrôle humain synthétique sur trois pièces de fixture','fixture-client-identity199-review')from identity_results where k='context';
insert into identity_results select'replay',public.review_client_canonical_identifiers_v1('f1940000-0000-4000-8000-000000000001',(v->>'case_row_version')::integer,(v->>'profile_version')::integer,v->>'identity_hash',array(select(d->>'id')::uuid from jsonb_array_elements(v->'identity_snapshot'->'documents')d),'Contrôle humain synthétique sur trois pièces de fixture','fixture-client-identity199-review')from identity_results where k='context';
reset role;
select is((select v->>'outcome'from identity_results where k='review'),'CLIENT_CANONICAL_IDENTIFIERS_VERIFIED','real manual review verifies canonical identifiers from the current three clean pieces');
select is((select count(*)from public.organization_identifiers where organization_id='b1810000-0000-4000-8000-000000000001'and is_active and verification_status='VERIFIED'),3::bigint,'canonical verification is an actual effect rather than a badge');
select is((select count(*)from public.client_canonical_identity_reviews_v1 where compliance_case_id='f1940000-0000-4000-8000-000000000001'),1::bigint,'replay does not duplicate the immutable human review proof');
select is((select v from identity_results where k='review'),(select v from identity_results where k='replay'),'replay returns the original proof');
set local role authenticated;
select public.evaluate_client_compliance('f1940000-0000-4000-8000-000000000001','fixture-client-identity199-evaluate');
reset role;
select ok(not exists(select 1 from public.client_administrative_anomalies where compliance_case_id='f1940000-0000-4000-8000-000000000001'and anomaly_code in('ICE_NOT_VERIFIED','IF_NOT_VERIFIED','RC_NOT_VERIFIED')and blocking and status in('OPEN','QUESTIONED')),'actual evaluation resolves verified identifier anomalies');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
set local role authenticated;select public.submit_client_compliance('f1940000-0000-4000-8000-000000000001','fixture-complete-identity231-submit');reset role;
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Décision propre refusée','fixture-client-identity199-self')$$,'42501','CLIENT_COMPLIANCE_DUAL_CONTROL_REQUIRED','identity reviewer cannot approve final activation');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.decide_client_compliance('f1940000-0000-4000-8000-000000000001','VERIFIED','Revue finale indépendante de fixture','fixture-client-identity199-final')$$,'independent final decision succeeds after manual identity review and evaluation');
reset role;
select is((select status from public.client_compliance_cases where id='f1940000-0000-4000-8000-000000000001'),'VERIFIED','complete chain reaches real verification');
select ok((select to_jsonb(t)=to_jsonb(o)from public.client_trials t cross join old_trial o where t.organization_id=o.organization_id),'identity revalidation never restarts the historical trial');


select ok(private.client_identity_allows_new_operations('b1810000-0000-4000-8000-000000000001'),'real independent revalidation restores only the current verified Client profile');
-- Provider side: actual reserve/upload/scan/review/revalidation chain.
select set_config('request.jwt.claim.sub','',true);
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

-- Historical published catalogue precondition; fiscal mapping uses real independent commands.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('f2669000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mapping266-'||i||'@example.invalid',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('f2669000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('f2669000-0000-4000-8000-000000000002','SUPER_ADMIN');
do $$declare r public.service_requests%rowtype;v public.service_request_versions%rowtype;vid uuid:=extensions.gen_random_uuid();context jsonb;proposal jsonb;claims text:=current_setting('request.jwt.claims',true);begin
 select*into r from public.service_requests where id='fa125000-0000-4000-8000-000000000001';select*into v from public.service_request_versions where request_id=r.id order by version_number limit 1;
 insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at)values(vid,r.service_id,r.library_id,1,'PUBLISHED','Service fiscal TEST','خدمة اختبار','Service test','خدمة اختبار','Catalogue historique TEST','كتالوج اختبار تاريخي','CONSULTING','Forfait','حزمة',1,'Historical source for quote tax test',v.catalog_snapshot_hash,r.created_by,now()-interval'2 days');
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 context:=public.get_service_tax_category_mapping_context_v1(vid,'MA',v.currency_code);
 proposal:=public.propose_service_tax_category_mapping_v1(vid,v.catalog_snapshot_hash,context->>'scope_hash','MA',v.currency_code,'QUOTE_ANCHOR_A',current_date,null,true,'{}','TEST exact source classification',extensions.gen_random_uuid());
 perform set_config('request.jwt.claims','{"sub":"f2669000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_service_tax_category_mapping_v1((proposal->>'proposal_id')::uuid,proposal->>'content_hash',true,'TEST/266/QUOTE','Independent TEST classification review');
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
end$$;

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
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value)values('fa122000-0000-4000-8000-000000000002','ICE','997212000000001'),('fa122000-0000-4000-8000-000000000002','IF','99721201'),('fa122000-0000-4000-8000-000000000002','RC','TEST212');
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
select ok(private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'Provider starts with a genuinely current reviewed identity');
create temporary table old_provider_identity as select*from public.provider_identity_verification_history where organization_id='fa122000-0000-4000-8000-000000000002';
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f2310000-0000-4000-8000-000000000002','fa122000-0000-4000-8000-000000000002','VERIFIED',1,'fa120000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)select'f2310000-0000-4000-8000-000000000002',o.id,1,p.profile_data||'{"if_number":"99721201","rc_number":"TEST212"}'::jsonb,jsonb_build_object('legal_name',o.legal_name,'display_name',o.display_name,'country_code',o.country_code,'identifiers',jsonb_build_object('ICE','997212000000001','IF','99721201','RC','TEST212')),o.row_version,'fa120000-0000-4000-8000-000000000001'from public.organizations o cross join public.client_profile_versions p where o.id='fa122000-0000-4000-8000-000000000002'and p.compliance_case_id='f1940000-0000-4000-8000-000000000001'and p.version=1;
set local session_replication_role=origin;
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)select'e2310000-0000-4000-8000-000000000004',o.id,'MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION',o.id::text,repeat('a',64),jsonb_build_object('intent','CHANGE_CONFIGURATION','extendedIdentity',true,'expectedRowVersion',o.row_version,'expectedIdentityHash',private.canonical_request_hash(private.admin_organization_identity_edit_snapshot_v1(o.id)),'expectedIce','997212000000001','ice','997212000000001','legalName',o.legal_name,'country','MA','ifNumber','99721201','rcNumber','TEST212','identityProfile','{"legal_form":"TEST SAS","registered_city":"Rabat","registered_address":{"line1":"TEST nouvel établissement Provider","country_code":"MA"}}'::jsonb),'TEST Provider address and legal form revision',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'from public.organizations o where o.id='fa122000-0000-4000-8000-000000000002';
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select x.id,'APPROVE','Independent TEST Provider legal revision',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u where x.id='e2310000-0000-4000-8000-000000000004'and u.id in('a1810000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000003');
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into revision_results values('provider_changed',public.execute_admin_operational_action_v1('e2310000-0000-4000-8000-000000000004',extensions.gen_random_uuid()));
reset role;
select is((select v->>'outcome'from revision_results where k='provider_changed'),'ADMIN_ACTION_EXECUTED','address-only Provider revision runs through the actual approved Admin executor');
-- Negative fixture: even if identifier statuses and ACTIVE are forced, the
-- old Provider attestation must not revive after a legal-profile revision.
update public.organization_identifiers set verification_status='VERIFIED'where organization_id='fa122000-0000-4000-8000-000000000002'and is_active;
update public.organizations set status='ACTIVE'where id='fa122000-0000-4000-8000-000000000002';
select ok(not private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'old Provider attestation stays invalid after address/form change despite forced ACTIVE and unchanged fiscal identifiers');
select isnt((select identity_hash from old_provider_identity),(select private.canonical_request_hash(private.provider_current_identity_snapshot_v1('fa122000-0000-4000-8000-000000000002'))),'legal address and form participate in the current fingerprint so old quote anchors stay stale');
update public.organizations set status='PENDING'where id='fa122000-0000-4000-8000-000000000002';
set local role authenticated;select set_config('request.jwt.claim.sub','f2120000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"f2120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into revision_results values('provider_context',public.get_provider_identity_review_context_v1('fa122000-0000-4000-8000-000000000002'));
insert into revision_results select'provider_revalidated',public.revalidate_provider_identity_v1('fa122000-0000-4000-8000-000000000002',(v->>'organization_row_version')::integer,(v->>'profile_row_version')::integer,v->>'identity_hash',(v->>'company_decision_id')::uuid,'TEST fresh human review of three CLEAN documents after legal address revision',extensions.gen_random_uuid())from revision_results where k='provider_context';
reset role;
select is((select v#>>'{canonical_client_legal_profile,registered_address,line1}'from revision_results where k='provider_context'),'TEST nouvel établissement Provider','Provider reviewer sees the actual changed canonical legal address');
select ok(private.provider_current_identity_is_verified_v1('fa122000-0000-4000-8000-000000000002'),'real current Provider revalidation creates a fresh valid attestation');
select is((select count(*)from public.provider_identity_verification_history where organization_id='fa122000-0000-4000-8000-000000000002'),2::bigint,'fresh review appends an attestation instead of rewriting the previous one');
select ok((select to_jsonb(h)=to_jsonb(old)from public.provider_identity_verification_history h join old_provider_identity old on h.id=old.id),'historical Provider identity proof remains unchanged');
select is((select status from public.organizations where id='fa122000-0000-4000-8000-000000000002'),'PENDING','Provider review does not bypass outstanding Client compliance');

-- The positive publisher is the already independently reverified Client organization,
-- with a separately reviewed Provider identity; no forced ACTIVE/Client override is used.
insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,partner_contract_status,created_by)values('b1810000-0000-4000-8000-000000000001','VERIFIED','ACTIVE','Historical Provider qualification precondition TEST265',1,1,'SIGNED','a1810000-0000-4000-8000-000000000004');
insert into public.provider_match_profiles(provider_organization_id)values('b1810000-0000-4000-8000-000000000001');
insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values('b1810000-0000-4000-8000-000000000001',1,'VERIFIED','SIGNED','Historical synthetic company decision, not production approval','TEST-CANONICAL-265','f2120000-0000-4000-8000-000000000002',extensions.gen_random_uuid());
do $$declare kind text;u jsonb;d jsonb;job uuid;context jsonb;actor uuid:='f2120000-0000-4000-8000-000000000002';org uuid:='b1810000-0000-4000-8000-000000000001';begin
 foreach kind in array array['LEGAL','FISCAL','INSURANCE']loop
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  u:=public.begin_provider_document_upload(org,'application/pdf',20);
  insert into storage.objects(bucket_id,name,owner_id,metadata)values('provider-qualification',u->>'storage_object_path',actor::text,'{"mimetype":"application/pdf","size":20}');
  d:=public.record_provider_document_version(org,kind,'CANONICAL_265_'||kind,jsonb_build_object('issued_on',current_date::text,'expires_on',(current_date+365)::text,'storage_object_path',u->>'storage_object_path','content_hash',repeat('d',64),'metadata',jsonb_build_object('declared_mime_type','application/pdf','declared_size_bytes',20)),array[]::uuid[],'Synthetic identity evidence for canonical quote test','canonical265-doc-'||kind);
  select id into job from public.provider_document_scan_jobs where document_version_id=(d->>'document_version_id')::uuid;
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);perform public.record_provider_document_scan_result(job,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'canonical265-scan-'||kind);
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);perform public.review_provider_document((d->>'document_version_id')::uuid,'VERIFIED','Synthetic reviewer decision for exact current bytes','TEST-CANONICAL-265','canonical265-review-'||kind);
 end loop;
 context:=public.get_provider_identity_review_context_v1(org);
 perform public.revalidate_provider_identity_v1(org,(context->>'organization_row_version')::integer,(context->>'profile_row_version')::integer,context->>'identity_hash',(context->>'company_decision_id')::uuid,'Independent current identity review for canonical address publication',extensions.gen_random_uuid());
end$$;
select ok(private.client_identity_allows_new_operations('b1810000-0000-4000-8000-000000000001')and private.provider_current_identity_is_verified_v1('b1810000-0000-4000-8000-000000000001'),'positive publisher has both actual current identities verified');
insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)values('f2370000-0000-4000-8000-000000000001','fa126000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001',true,5000,'{"historical_invitation_precondition":true}',50);
-- Preserve an existing historical invitation; this is not a fresh matching/qualification approval.
set local session_replication_role=replica;
insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)values('f2370000-0000-4000-8000-000000000002','fa127000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','f2370000-0000-4000-8000-000000000001','ACCEPTED',clock_timestamp()-interval'1 day');
set local session_replication_role=origin;
create temporary table canonical_quote_result(key text primary key,value jsonb);grant select,insert on canonical_quote_result to authenticated,service_role;
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into canonical_quote_result values('status',public.get_my_provider_identity_status_v1('b1810000-0000-4000-8000-000000000001'));
select ok((select(value->>'publication_allowed')::boolean from canonical_quote_result where key='status'),'publication readiness is real for the fully reviewed active organization');
reset role;
select is((select value->>'canonical_registered_address'from canonical_quote_result where key='status'),private.provider_canonical_registered_address_v1('b1810000-0000-4000-8000-000000000001'),'status exposes the exact authoritative address that must be confirmed');
set local role authenticated;
insert into canonical_quote_result select'draft',public.create_quote_revision('f2370000-0000-4000-8000-000000000002',value,'Canonical address publication test','canonical265-draft')from anchor_quote_payload;
select throws_ok($$select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from canonical_quote_result where key='draft'),(select(value->>'quote_version_id')::uuid from canonical_quote_result where key='draft'),(select value->>'identity_hash'from canonical_quote_result where key='status'),'Wrong free-form registered address','canonical265-publish')$$,'22023','QUOTE_CANONICAL_REGISTERED_ADDRESS_REQUIRED','typed address cannot replace the approved canonical legal address');
insert into canonical_quote_result select'published',public.submit_provider_quote_with_identity_v1((value->>'quote_id')::uuid,(value->>'quote_version_id')::uuid,(select value->>'identity_hash'from canonical_quote_result where key='status'),(select value->>'canonical_registered_address'from canonical_quote_result where key='status'),'canonical265-publish')from canonical_quote_result where key='draft';
select is((select value->>'outcome'from canonical_quote_result where key='published'),'QUOTE_SUBMITTED','confirmed canonical address publishes the actual quote');
reset role;
create temporary table canonical_old_anchor as select*from public.provider_quote_identity_snapshots where quote_version_id=(select(value->>'quote_version_id')::uuid from canonical_quote_result where key='draft');
select is((select identity_snapshot->>'registered_address'from canonical_old_anchor),(select value->>'canonical_registered_address'from canonical_quote_result where key='status'),'immutable anchor freezes exactly the reviewed canonical address');
-- A new actual approved legal revision invalidates future publication while preserving the old offer.
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)select'f2370000-0000-4000-8000-000000000003',o.id,'MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION',o.id::text,repeat('b',64),jsonb_build_object('intent','CHANGE_CONFIGURATION','extendedIdentity',true,'expectedRowVersion',o.row_version,'expectedIdentityHash',private.canonical_request_hash(private.admin_organization_identity_edit_snapshot_v1(o.id)),'expectedIce','124000000000001','ice','124000000000001','legalName',o.legal_name,'country','MA','ifNumber','87654321','rcNumber','NEW124','identityProfile','{"legal_form":"TEST SAS","registered_city":"Rabat","registered_address":{"line1":"TEST troisième adresse après publication","country_code":"MA"}}'::jsonb),'TEST legal address change after a real canonical quote publication',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'from public.organizations o where o.id='b1810000-0000-4000-8000-000000000001';
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select x.id,'APPROVE','Independent TEST third address review',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u where x.id='f2370000-0000-4000-8000-000000000003'and u.id in('a1810000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000003');
set local role service_role;select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into canonical_quote_result values('changed',public.execute_admin_operational_action_v1('f2370000-0000-4000-8000-000000000003',extensions.gen_random_uuid()));
reset role;
select is((select value->>'outcome'from canonical_quote_result where key='changed'),'ADMIN_ACTION_EXECUTED','later address change runs the real independently approved Admin command');
select isnt((select identity_hash from canonical_old_anchor),private.canonical_request_hash(private.provider_current_identity_snapshot_v1('b1810000-0000-4000-8000-000000000001')),'old published identity anchor stays stale after a current canonical profile change');
select ok((select to_jsonb(current)=to_jsonb(old)from public.provider_quote_identity_snapshots current join canonical_old_anchor old on old.quote_version_id=current.quote_version_id),'later identity review never rewrites the old published quote anchor');
set local role authenticated;select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select ok(not(public.get_my_provider_identity_status_v1('b1810000-0000-4000-8000-000000000001')->>'publication_allowed')::boolean,'fresh profile review is required for a new publication after canonical change');
select is(public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from canonical_quote_result where key='draft'),(select(value->>'quote_version_id')::uuid from canonical_quote_result where key='draft'),(select value->>'identity_hash'from canonical_quote_result where key='status'),(select value->>'canonical_registered_address'from canonical_quote_result where key='status'),'canonical265-publish'),(select value from canonical_quote_result where key='published'),'exact historical publication replay remains readable after a later legal revision');
select throws_ok($$select public.submit_provider_quote_with_identity_v1((select(value->>'quote_id')::uuid from canonical_quote_result where key='draft'),(select(value->>'quote_version_id')::uuid from canonical_quote_result where key='draft'),(select value->>'identity_hash'from canonical_quote_result where key='status'),(select value->>'canonical_registered_address'from canonical_quote_result where key='status'),'canonical265-new-key-after-change')$$,'55000','PROVIDER_ORGANIZATION_NOT_ACTIVE','a new command cannot publish for the pending organization by replaying old fields');
reset role;
select*from finish();rollback;
