begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');

update public.platform_user_roles set revoked_at=clock_timestamp()where user_id='a1810000-0000-4000-8000-000000000004';
update public.organization_memberships set status='REVOKED'where user_id='a1810000-0000-4000-8000-000000000004';
insert into public.user_profiles(id,display_name,updated_at)values('a1810000-0000-4000-8000-000000000004','Nom Personnel',now()-interval'40 days')on conflict(id)do update set display_name='Nom Personnel',updated_at=now()-interval'40 days';


insert into public.client_assistance_requests(id,organization_id,created_by,subject,body,status,consented_at,idempotency_key,request_hash,created_at,updated_at)values('f1850000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','Assistance privée','Texte personnel à effacer dans la fixture','CLOSED',now()-interval'60 days','fixture-assistance-185',repeat('a',64),now()-interval'60 days',now()-interval'60 days');
insert into public.client_assistance_messages(id,request_id,actor_user_id,body,idempotency_key,created_at)values('f1850000-0000-4000-8000-000000000002','f1850000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000001','Réponse personnelle de fixture','fixture-assistance-message185',now()-interval'50 days');
insert into public.processing_activities(id,organization_id,activity_key,name_fr,name_ar,controller_role,systems,countries_regions,cndp_formality_status,created_by)values('f1830000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','profile-retention','Rétention profils','الاحتفاظ بالملفات','CONTROLLER',array['SUPABASE'],array['MA'],'NOT_REQUIRED','a1810000-0000-4000-8000-000000000001');
insert into public.data_categories(id,organization_id,processing_activity_id,category_key,label_fr,label_ar,data_subject_types,sensitivity,created_by)values('f1830000-0000-4000-8000-000000000002','b1810000-0000-4000-8000-000000000001','f1830000-0000-4000-8000-000000000001','user-profile','Profil utilisateur','ملف المستخدم',array['USER'],'PERSONAL','a1810000-0000-4000-8000-000000000001');
insert into public.retention_policies(id,organization_id,data_category_id,version,status,retention_days,trigger_event,disposition,legal_basis_reference,effective_from,created_by)values('f1830000-0000-4000-8000-000000000003','b1810000-0000-4000-8000-000000000001','f1830000-0000-4000-8000-000000000002',1,'ACTIVE',0,'ACCOUNT_REVOKED','ANONYMIZE','fixture-legal-policy-183',current_date-60,'a1810000-0000-4000-8000-000000000001');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)values('f1830000-0000-4000-8000-000000000004','b1810000-0000-4000-8000-000000000001','ERASURE',encode(extensions.digest(convert_to('b1810000-0000-4000-8000-000000000001:a1810000-0000-4000-8000-000000000004','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now()-interval'1 day',extensions.gen_random_uuid(),'a1810000-0000-4000-8000-000000000001');

insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)select 'f1910000-0000-4000-8000-000000000001',organization_id,'ACCESS',subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,extensions.gen_random_uuid(),created_by from public.data_subject_requests where id='f1830000-0000-4000-8000-000000000004';
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)select 'f1910000-0000-4000-8000-000000000002',organization_id,'RECTIFICATION',subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,extensions.gen_random_uuid(),created_by from public.data_subject_requests where id='f1830000-0000-4000-8000-000000000004';

-- Only synthetic fixture rows are inserted directly; disclosure is exercised
-- through the real subject/staff/independent-review delivery commands.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2220000-0000-4000-8000-000000000002','Other tenant','Other tenant','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.credit_wallets(id,organization_id,wallet_type)values
 ('c2220000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','CLIENT'),
 ('c2220000-0000-4000-8000-000000000002','b2220000-0000-4000-8000-000000000002','CLIENT');
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values
 ('b1810000-0000-4000-8000-000000000001','c2220000-0000-4000-8000-000000000001','GRANT',9007199254740993,'fixture.dsr222','subject-own-222',extensions.gen_random_uuid(),'TEST','OWN_222','a1810000-0000-4000-8000-000000000004'),
 ('b1810000-0000-4000-8000-000000000001','c2220000-0000-4000-8000-000000000001','GRANT',2,'fixture.dsr222','same-org-other-222',extensions.gen_random_uuid(),'TEST','OTHER_PERSON_222','a1810000-0000-4000-8000-000000000001'),
 ('b2220000-0000-4000-8000-000000000002','c2220000-0000-4000-8000-000000000002','GRANT',3,'fixture.dsr222','other-org-subject-222',extensions.gen_random_uuid(),'TEST','OTHER_TENANT_222','a1810000-0000-4000-8000-000000000004');

insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
select ('e2220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
case when i=1 then'b1810000-0000-4000-8000-000000000001'else'b2220000-0000-4000-8000-000000000002'end::uuid,
'TEST_DSR_DISCLOSURE','MAD','fixture.dsr222','fixture-journal-'||i,extensions.gen_random_uuid(),now(),'Synthetic reader fixture only','a1810000-0000-4000-8000-000000000001'from generate_series(1,2)i;
insert into public.provider_payments(id,provider_organization_id,payment_reference,paid_on,payment_method,currency,amount_minor,proof_hash,journal_id,correlation_id,recorded_by)
select ('e2221000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
case when i<3 then'b1810000-0000-4000-8000-000000000001'else'b2220000-0000-4000-8000-000000000002'end::uuid,
'fixture-dsr-payment-'||i,current_date,'BANK_TRANSFER','MAD',9007199254740993,repeat('2',64),
case when i<3 then'e2220000-0000-4000-8000-000000000001'else'e2220000-0000-4000-8000-000000000002'end::uuid,
extensions.gen_random_uuid(),case when i=2 then'a1810000-0000-4000-8000-000000000001'else'a1810000-0000-4000-8000-000000000004'end::uuid from generate_series(1,3)i;
insert into public.provider_reconciliation_batches(id,provider_organization_id,payment_id,allocated_minor,correlation_id,reconciled_by)
select ('e2222000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
case when i<3 then'b1810000-0000-4000-8000-000000000001'else'b2220000-0000-4000-8000-000000000002'end::uuid,
('e2221000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,125050,extensions.gen_random_uuid(),
case when i=2 then'a1810000-0000-4000-8000-000000000001'else'a1810000-0000-4000-8000-000000000004'end::uuid from generate_series(1,3)i;
create temporary table financial_dsr_results(k text primary key,v jsonb);
grant all on financial_dsr_results to authenticated;
select ok(not has_function_privilege('authenticated','private.dsr_subject_financial_records_v1(uuid)','execute'),'no browser execution grant on private financial assembler');
select ok(not has_function_privilege('service_role','private.dsr_subject_financial_records_v1(uuid)','execute'),'no service-role shortcut to the verified subject assembler');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into financial_dsr_results values('scope',public.confirm_my_dsr_scope_v1('f1910000-0000-4000-8000-000000000001',array['FINANCIAL_CONTRACT_RECORDS'],'financial222-scope'));
select throws_ok($$select public.prepare_admin_dsr_private_response_v1('f1910000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from financial_dsr_results where k='scope'),'financial222-denied')$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','subject cannot bypass independent staff preparation');
select is((select count(*)from public.credit_ledger_entries where idempotency_scope='fixture.dsr222'),0::bigint,'revoked membership gives no direct tenant ledger access');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.prepare_admin_dsr_private_response_v1('f1910000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from financial_dsr_results where k='scope'),'financial222-aal1')$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','staff must actually use MFA');
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into financial_dsr_results values('prepared',public.prepare_admin_dsr_private_response_v1('f1910000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from financial_dsr_results where k='scope'),'financial222-prepared'));
insert into financial_dsr_results values('replay',public.prepare_admin_dsr_private_response_v1('f1910000-0000-4000-8000-000000000001',(select(v->>'scope_version_id')::uuid from financial_dsr_results where k='scope'),'financial222-prepared'));
select is((select v from financial_dsr_results where k='prepared'),(select v from financial_dsr_results where k='replay'),'replay binds the same artifact, scope, and bytes');
select is((select(v->>'complete')::boolean from financial_dsr_results where k='prepared'),true,'precisely defined subject financial scope has an assembler');
select throws_ok($$select public.review_admin_dsr_private_response_v1((select(v->>'response_id')::uuid from financial_dsr_results where k='prepared'),(select v->>'sha256'from financial_dsr_results where k='prepared'),true,true,'Review my own disclosure is forbidden')$$,'42501','DSR_INDEPENDENT_REVIEW_REQUIRED','preparer cannot approve their own disclosure');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.review_admin_dsr_private_response_v1((select(v->>'response_id')::uuid from financial_dsr_results where k='prepared'),(select v->>'sha256'from financial_dsr_results where k='prepared'),true,true,'Subject attribution and third-party privacy independently reviewed');
select set_config('request.jwt.claim.sub','a1810000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"a1810000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
insert into financial_dsr_results values('download',public.get_private_dsr_response_v1((select(v->>'response_id')::uuid from financial_dsr_results where k='prepared')));
select public.acknowledge_my_dsr_response_v1((select(v->>'response_id')::uuid from financial_dsr_results where k='prepared'),(select(v->>'scope_version_id')::uuid from financial_dsr_results where k='scope'),(select v->>'sha256'from financial_dsr_results where k='prepared'));
reset role;
select is((select jsonb_array_length((v->>'response_json')::jsonb#>'{financial_contract_records,records}')from financial_dsr_results where k='download'),3,'only the subject-authored records in the verified request organization is disclosed');
select is((select(v->>'response_json')::jsonb#>>'{financial_contract_records,records,0,quantity}'from financial_dsr_results where k='download'),'9007199254740993','amount above JavaScript safe integer remains exact text');
select ok((select v->>'response_json'not like'%OTHER_PERSON_222%'and v->>'response_json'not like'%OTHER_TENANT_222%'and v->>'response_json'not like'%encrypted_password%'from financial_dsr_results where k='download'),'other authors, tenants and authentication secrets are absent');
select is((select encode(extensions.digest(convert_to(v->>'response_json','UTF8'),'sha256'),'hex')from financial_dsr_results where k='download'),(select v->>'sha256'from financial_dsr_results where k='prepared'),'artifact SHA binds actual UTF-8 bytes');
select ok(private.dsr_acknowledged_complete_response_v1('f1910000-0000-4000-8000-000000000001',(select 'privacy-response:'||(v->>'response_id')from financial_dsr_results where k='prepared')),'reviewed and downloaded subject financial disclosure can satisfy exactly that requested scope');
select is((select count(*)from public.credit_ledger_entries where idempotency_scope='fixture.dsr222'),3::bigint,'disclosure does not mutate immutable financial records');
select is((select r->>'amount_minor'from financial_dsr_results d cross join jsonb_array_elements((d.v->>'response_json')::jsonb#>'{financial_contract_records,records}')r where d.k='download'and r->>'source'='PROVIDER_PAYMENT'),'9007199254740993','recorded payment is disclosed exactly without rounding');
select is((select count(*)from financial_dsr_results d cross join jsonb_array_elements((d.v->>'response_json')::jsonb#>'{financial_contract_records,records}')r where d.k='download'and r->>'source'='PROVIDER_RECONCILIATION'),1::bigint,'own reconciliation action is included without other reconciler or tenant');
select ok((select not exists(select 1 from jsonb_array_elements((v->>'response_json')::jsonb#>'{financial_contract_records,records}')r where r->>'id'in('e2221000-0000-4000-8000-000000000002','e2221000-0000-4000-8000-000000000003','e2222000-0000-4000-8000-000000000002','e2222000-0000-4000-8000-000000000003'))from financial_dsr_results where k='download'),'payment and reconciliation author/tenant filtering both remain restrictive');
select * from finish();
rollback;
