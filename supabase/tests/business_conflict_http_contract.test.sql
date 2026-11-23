begin;
set local search_path=public,extensions;
select plan(3);
select is((select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')and p.prosrc~* $pattern$raise\s+exception\s*'[A-Z0-9_]+'\s*using\s+errcode\s*=\s*'40001'$pattern$),0::bigint,'business refusals never request automatic serialization retries');
select ok(pg_get_functiondef('public.list_provider_quote_service_tax_policies_v1(uuid,uuid[])'::regprocedure)like'%sqlstate''PT409''%','quote policy reader handles the explicit business conflict');
select ok(pg_get_functiondef('private.dsr_all_files_acknowledged_v1(uuid,uuid)'::regprocedure)like'%sqlstate''PT409''%','privacy acknowledgement reader retains its safe conflict fallback');
select * from finish();
rollback;
