begin;set local search_path=public,extensions;select plan(5);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fb100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-composition-admin@example.invalid','',now(),'{}','{}',now(),now()),
('fb100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-composition-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('fb100000-0000-0000-0000-000000000001','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by)values('fb110000-0000-0000-0000-000000000001','P06 Composition Steward','P06 Composition Steward','ACTIVE','fb100000-0000-0000-0000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('fb120000-0000-0000-0000-000000000001','P06_COMPOSE','p06-compose','fb110000-0000-0000-0000-000000000001','DRAFT','fb100000-0000-0000-0000-000000000001');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by)values('fb130000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06.COMPOSE.V1','DRAFT',repeat('b',64),'fb100000-0000-0000-0000-000000000001');
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by)values('fb140000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06_APPROVED','LIBRARY','fb100000-0000-0000-0000-000000000001');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by)values('fb141000-0000-0000-0000-000000000001','fb140000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001',1,'APPROVED','Question approuvée','سؤال معتمد','YES_NO','p06.approved',repeat('c',64),'Version approuvée','fb100000-0000-0000-0000-000000000001');
insert into public.question_rules(id,library_id,rule_key,created_by)values('fb150000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','P06_APPROVED_RULE','fb100000-0000-0000-0000-000000000001'),('fb150000-0000-0000-0000-000000000002','fb120000-0000-0000-0000-000000000001','P06_SENSITIVE_RULE','fb100000-0000-0000-0000-000000000001');
insert into public.question_rule_versions(id,rule_id,library_id,version,status,condition_ast,actions,dependency_graph,priority,sensitive,compiled_hash,change_reason,created_by)values
('fb151000-0000-0000-0000-000000000001','fb150000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001',1,'APPROVED','{"kind":"TRUE"}','[{"type":"NOOP"}]','{}',10,false,repeat('d',64),'Version approuvée','fb100000-0000-0000-0000-000000000001'),
('fb151000-0000-0000-0000-000000000002','fb150000-0000-0000-0000-000000000002','fb120000-0000-0000-0000-000000000001',1,'APPROVED','{"kind":"TRUE"}','[{"type":"NOOP"}]','{}',20,true,repeat('e',64),'Version sensible','fb100000-0000-0000-0000-000000000001');

insert into public.franchise_pnl_books(id,library_id,franchise_organization_id,franchise_type,operator_code,currency,opened_under_rule_version_id,created_by)
select 'fb190000-0000-0000-0000-000000000001','fb120000-0000-0000-0000-000000000001','fb110000-0000-0000-0000-000000000001','IT','HATIM_AHMITECH','MAD',id,'fb100000-0000-0000-0000-000000000001' from public.franchise_finance_rule_versions where franchise_type='IT' and version=1;
insert into public.franchise_distribution_ledger_entries(book_id,beneficiary_code,entry_type,amount_minor,currency,reference_type,reference_id,correlation_id,created_by)
select 'fb190000-0000-0000-0000-000000000001','HATIM_AHMITECH','ADJUSTMENT',9007199254740993,'MAD','DELIVERY_TEST',n::text,'fb190000-0000-0000-0000-000000000002','fb100000-0000-0000-0000-000000000001' from generate_series(1,2501)n;
create temporary table observed_balances(balance text);grant select,insert on observed_balances to authenticated;grant usage on schema extensions to authenticated;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into observed_balances select balance_minor from public.franchise_distribution_balances()where book_id='fb190000-0000-0000-0000-000000000001';
reset role;
select is((select balance from observed_balances),(9007199254740993::numeric*2501)::text,'sum includes all 2501 entries without float precision loss');
select ok((select not p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='franchise_distribution_balances'),'aggregate executes with caller RLS');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"fb100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.franchise_distribution_balances()where book_id='fb190000-0000-0000-0000-000000000001'),0::bigint,'unrelated tenant cannot see a balance');
reset role;
select ok(not has_function_privilege('anon','public.franchise_distribution_balances()','EXECUTE'),'anonymous balance access is denied');
select ok(has_function_privilege('authenticated','public.franchise_distribution_balances()','EXECUTE'),'signed-in users receive explicit RLS-bound execution');
select * from finish();rollback;
