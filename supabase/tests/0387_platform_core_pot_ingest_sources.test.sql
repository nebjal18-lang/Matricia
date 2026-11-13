begin;
set local search_path=public,extensions;
select plan(11);

select has_function(
 'public','ingest_platform_core_pot_sources_v1',
 array['uuid','uuid','bigint','bigint','text','text','uuid'],
 'platform core pot ingest helper exists'
);

select ok((
 select p.prosecdef and p.proconfig::text like'%search_path=%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'ingest helper is security definer with fixed search_path');

select ok(
 not has_function_privilege('anon','public.ingest_platform_core_pot_sources_v1(uuid,uuid,bigint,bigint,text,text,uuid)','EXECUTE')
 and not has_function_privilege('service_role','public.ingest_platform_core_pot_sources_v1(uuid,uuid,bigint,bigint,text,text,uuid)','EXECUTE'),
 'anon and service_role cannot execute platform core pot ingest'
);

select ok(
 has_function_privilege('authenticated','public.ingest_platform_core_pot_sources_v1(uuid,uuid,bigint,bigint,text,text,uuid)','EXECUTE'),
 'authenticated may execute platform core pot ingest'
);

select ok((
 select pg_get_functiondef(p.oid)like'%post_platform_core_pot_entry%'
  and pg_get_functiondef(p.oid)like'%CORE_SUBSCRIPTION_REVENUE_ACQUIRED%'
  and pg_get_functiondef(p.oid)like'%ENTRY_FEE_ACQUIRED%'
  and pg_get_functiondef(p.oid)like'%CREDIT_REVENUE_LEDGER%'
  and pg_get_functiondef(p.oid)like'%FRANCHISE_ENTRY_FEE_PAYMENT%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'ingest maps validated sources into pot revenue categories');

select ok((
 select pg_get_functiondef(p.oid)like'%revenue_class<>''CORE_SUBSCRIPTION_REVENUE''%'
  and pg_get_functiondef(p.oid)like'%entry_type in(''REFUND'',''REVERSE'')%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'core subscription ingest accepts classified core ledger rows only');

select ok((
 select pg_get_functiondef(p.oid)like'%franchise_type=''IT''%'
  and pg_get_functiondef(p.oid)like'%IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'ingest excludes IT entry fees before posting');

select ok((
 select pg_get_functiondef(p.oid)like'%PLATFORM_CORE_POT_INGEST_SOURCE_REQUIRED%'
  and pg_get_functiondef(p.oid)like'%p_credit_revenue_ledger_id is null)=(p_franchise_entry_fee_ledger_id is null)%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'exactly one source id is required');

select ok((
 select pg_get_functiondef(p.oid)not like'%insert into public.franchise_%'
  and pg_get_functiondef(p.oid)not like'%update public.franchise_%'
  and pg_get_functiondef(p.oid)not like'%delete from public.franchise_%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'and p.proname='ingest_platform_core_pot_sources_v1'
),'ingest does not mutate franchise finance ledgers');

select is((select neoxa_share_bps from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),5000,'franchise IT rule unchanged after ingest migration');
select is((select asma_matricia_share_bps from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),0,'franchise IT Asma share still zero');

select * from finish();
rollback;
