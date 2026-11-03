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

-- These are synthetic historical rows used solely for disclosure tests. They
-- do not prove a new payment, grant, reservation or fulfilled service.
create temporary table financial260(k text primary key,v jsonb)on commit drop;
create function pg_temp.financial260_actor(i integer,level text default'aal2')returns void language plpgsql as $$declare u text:='a1810000-0000-4000-8000-'||lpad(i::text,12,'0');begin perform set_config('request.jwt.claim.sub',u,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal',level)::text,true);end$$;
select ok(not has_function_privilege('authenticated','private.dsr_subject_financial_rows_v2(uuid)','EXECUTE'),'API callers cannot invoke the subject financial rowset');
select ok(not has_function_privilege('service_role','private.dsr_subject_financial_rows_v2(uuid)','EXECUTE'),'background service has no disclosure shortcut');
select ok(not has_function_privilege('authenticated','private.dsr_subject_financial_page_v2(uuid,text,text,integer)','EXECUTE'),'diagnostic cursor is private');
select pg_temp.financial260_actor(4);
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001')$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','verified subject cannot bypass the staff disclosure workflow');
select pg_temp.financial260_actor(1,'aal1');
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001')$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','weak staff session cannot disclose financial records');
select pg_temp.financial260_actor(1);
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000002')$$,'42501','PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED','a rectification request is not an export authorization');
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001',null,null,0)$$,'22023','INVALID_DSR_FINANCIAL_CURSOR','zero-sized pages are refused');
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001',null,null,1001)$$,'22023','INVALID_DSR_FINANCIAL_CURSOR','unbounded pages are refused');
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001','CREDIT_ENTRY',null,1)$$,'22023','INVALID_DSR_FINANCIAL_CURSOR','partial cursors cannot restart or skip ambiguously');
insert into financial260 values('first',private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001',null,null,1));
select is((select jsonb_array_length(v->'records')from financial260 where k='first'),1,'a page returns only the requested number of records');
select is((select v#>>'{records,0,record,quantity}'from financial260 where k='first'),'9007199254740993','the paged projection preserves integers above the JavaScript boundary');
select is((select(v->>'has_next')::boolean from financial260 where k='first'),true,'a full first page advertises more actual records');
insert into financial260 select 'last',private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001',v#>>'{next_cursor,source}',v#>>'{next_cursor,record_id}',2)from financial260 where k='first';
select is((select jsonb_array_length(v->'records')from financial260 where k='last'),2,'keyset continuation returns both remaining personally attributed records');
select is((select(v->>'has_next')::boolean from financial260 where k='last'),false,'the final page has no fictitious continuation');
select is((select v->'next_cursor'from financial260 where k='last'),'null'::jsonb,'the final cursor is explicitly absent');
select is((select count(*)from private.dsr_subject_financial_rows_v2('f1910000-0000-4000-8000-000000000001')),3::bigint,'the shared rowset contains exactly the original personal subset');
select ok(not exists(select 1 from private.dsr_subject_financial_rows_v2('f1910000-0000-4000-8000-000000000001')r where r.record::text like'%OTHER_PERSON_222%'or r.record::text like'%OTHER_TENANT_222%'or r.record_id in('e2221000-0000-4000-8000-000000000002','e2221000-0000-4000-8000-000000000003')),'same-organization third persons and foreign-tenant records remain excluded');
select is((private.dsr_subject_financial_records_v1('f1910000-0000-4000-8000-000000000001')->'records'),(select jsonb_agg(record order by source,record_id)from private.dsr_subject_financial_rows_v2('f1910000-0000-4000-8000-000000000001')),'the bounded legacy response and new rowset share exactly one projection');
-- Oversized historical reference data belongs to a separate verified scope;
-- it cannot pollute or disappear from the first organization's page sequence.
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2600000-0000-4000-8000-000000000002','b2220000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000004','REVOKED');
insert into public.organization_member_roles(membership_id,role_code)values('c2600000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.data_subject_requests(id,organization_id,request_type,subject_reference_hash,identity_verification_level,locale,status,due_at,verified_at,correlation_id,created_by)values('f2600000-0000-4000-8000-000000000008','b2220000-0000-4000-8000-000000000002','ACCESS',encode(extensions.digest(convert_to('b2220000-0000-4000-8000-000000000002:a1810000-0000-4000-8000-000000000004','UTF8'),'sha256'),'hex'),'ENHANCED','fr-MA','IN_REVIEW',now()+interval'1 day',now(),extensions.gen_random_uuid(),'a1810000-0000-4000-8000-000000000001');
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)
select'b2220000-0000-4000-8000-000000000002','c2220000-0000-4000-8000-000000000002','GRANT',1,'fixture.dsr260.large','historical-bytes-only-'||i,extensions.gen_random_uuid(),'TEST_HISTORICAL_READER',repeat('x',6100000),'a1810000-0000-4000-8000-000000000004'from generate_series(1,2)i;
select throws_ok($$select private.dsr_subject_financial_records_v1('f2600000-0000-4000-8000-000000000008')$$,'55000','PRIVACY_EXPORT_REQUIRES_BATCH_JOB','byte-heavy data is refused before building the legacy JSON aggregate');
select throws_ok($$select private.dsr_subject_financial_page_v2('f2600000-0000-4000-8000-000000000008',null,null,1000)$$,'55000','PRIVACY_EXPORT_REQUIRES_BATCH_JOB','oversized records cannot bypass the diagnostic page byte budget');
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)
select'b1810000-0000-4000-8000-000000000001','c2220000-0000-4000-8000-000000000001','GRANT',1,'fixture.dsr260','historical-reader-only-'||i,extensions.gen_random_uuid(),'TEST_HISTORICAL_READER','DSR260_'||i,'a1810000-0000-4000-8000-000000000004'from generate_series(1,21001)i;
select is((select count(*)from private.dsr_subject_financial_rows_v2('f1910000-0000-4000-8000-000000000001')),21004::bigint,'materialization can read the entire exact rowset beyond the legacy 20000 limit');
select throws_ok($$select private.dsr_subject_financial_records_v1('f1910000-0000-4000-8000-000000000001')$$,'55000','PRIVACY_EXPORT_REQUIRES_BATCH_JOB','bounded legacy delivery still refuses oversized data without truncation');
create temporary table financial260_seen(source text,record_id text,primary key(source,record_id))on commit drop;
do $$declare page jsonb;cursor jsonb;rounds integer:=0;begin loop
 page:=private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001',cursor->>'source',cursor->>'record_id',1000);
 insert into financial260_seen select r->>'source',r->>'record_id'from jsonb_array_elements(page->'records')r;
 rounds:=rounds+1;if not(page->>'has_next')::boolean then exit;end if;
 if rounds>30 then raise exception'FINANCIAL_CURSOR_DID_NOT_TERMINATE';end if;
 cursor:=page->'next_cursor';
 end loop;
 insert into financial260 values('rounds',to_jsonb(rounds));
end$$;
select is((select count(*)from financial260_seen),21004::bigint,'all pages together disclose every selected record once without truncation or duplication');
select is((select v#>>'{}'from financial260 where k='rounds'),'22','continuation terminates at the actual final page');
select pg_temp.financial260_actor(1,'aal1');
select throws_ok($$select private.dsr_subject_financial_page_v2('f1910000-0000-4000-8000-000000000001','CREDIT_ENTRY','1',10)$$,'42501','DSR_RESPONSE_STAFF_REQUIRED','authority is checked again for every diagnostic page');
select*from finish();
rollback;
