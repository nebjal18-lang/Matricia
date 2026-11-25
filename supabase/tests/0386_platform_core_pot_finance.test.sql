begin;
set local search_path=public,extensions;
select plan(24);

select ok((select count(*)=6 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind='r'and c.relname=any(array[
 'platform_core_pot_rule_versions','platform_core_pot_books','platform_core_pot_entries','platform_core_pot_closure_versions','platform_core_pot_allocations','platform_core_pot_distribution_ledger_entries'
])),'platform core pot tables exist');

select ok((select count(*)=6 and bool_and(c.relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname=any(array[
 'platform_core_pot_rule_versions','platform_core_pot_books','platform_core_pot_entries','platform_core_pot_closure_versions','platform_core_pot_allocations','platform_core_pot_distribution_ledger_entries'
])),'RLS enabled on every platform core pot table');

select ok((select count(*)=6 from pg_policies where schemaname='public'and tablename=any(array[
 'platform_core_pot_rule_versions','platform_core_pot_books','platform_core_pot_entries','platform_core_pot_closure_versions','platform_core_pot_allocations','platform_core_pot_distribution_ledger_entries'
])),'every platform core pot table has a read policy');

select ok((select count(*)=5 and bool_and(p.prosecdef and p.proconfig::text like'%search_path=%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array[
 'create_platform_core_pot_rule','open_platform_core_pot_book','post_platform_core_pot_entry','close_platform_core_pot_period','record_platform_core_pot_payout'
])),'five platform core pot commands are security definer with fixed search_path');

select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array[
 'create_platform_core_pot_rule','open_platform_core_pot_book','post_platform_core_pot_entry','close_platform_core_pot_period','record_platform_core_pot_payout'
])and(has_function_privilege('anon',p.oid,'EXECUTE')or has_function_privilege('service_role',p.oid,'EXECUTE'))),'anon and service_role cannot execute platform core pot commands');

select ok((select count(*)=5 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array[
 'create_platform_core_pot_rule','open_platform_core_pot_book','post_platform_core_pot_entry','close_platform_core_pot_period','record_platform_core_pot_payout'
])),'authenticated has explicit execute on platform core pot commands');

select ok(not has_table_privilege('authenticated','public.platform_core_pot_entries','INSERT')
 and not has_table_privilege('authenticated','public.platform_core_pot_allocations','UPDATE')
 and not has_table_privilege('authenticated','public.platform_core_pot_distribution_ledger_entries','DELETE'),
 'direct mutations on pot ledgers are denied');

select ok((select count(*)=6 from pg_trigger where tgname=any(array[
 'platform_core_pot_rules_immutable','platform_core_pot_books_immutable','platform_core_pot_entries_immutable','platform_core_pot_closures_immutable','platform_core_pot_allocations_immutable','platform_core_pot_distribution_immutable'
])and not tgisinternal),'platform core pot histories are immutable');

select ok((select count(*)=1 from pg_trigger where tgname='platform_core_pot_allocations_balanced'and tgdeferrable and tginitdeferred and not tgisinternal),'allocation balance enforced by deferred constraint');

select is((select neoxa_jalil_share_bps from public.platform_core_pot_rule_versions where version=1),5000,'seed rule gives Jalil-NEOXA 50 percent');
select is((select asma_matricia_share_bps from public.platform_core_pot_rule_versions where version=1),5000,'seed rule gives Asma 50 percent');
select is((select distribution_basis from public.platform_core_pot_rule_versions where version=1),'DISTRIBUTABLE_PLATFORM_POT','basis is platform pot remainder');
select ok((select formula_snapshot->>'vat_treatment'='EXCLUDED_FROM_REVENUE_AND_PROFIT'and formula_snapshot->>'rounding_policy'='ASMA_MATRICIA_REMAINDER'from public.platform_core_pot_rule_versions where version=1),'VAT excluded and Asma receives remainder');

select ok((select count(*)>=4 from information_schema.columns where table_schema='public'and table_name in('platform_core_pot_entries','platform_core_pot_closure_versions','platform_core_pot_allocations','platform_core_pot_distribution_ledger_entries')and data_type='bigint'),'money stored as bigint minor units');
select ok(not exists(select 1 from information_schema.columns where table_schema='public'and table_name like'platform_core_pot_%'and data_type in('real','double precision')),'no floating-point platform pot money');

select ok((select pg_get_functiondef(p.oid)like'%IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT%'and pg_get_functiondef(p.oid)like'%franchise_type=''IT''%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='post_platform_core_pot_entry'),'posting rejects IT entry-fee sources');
select ok((select pg_get_functiondef(p.oid)like'%CORE_SUBSCRIPTION_REVENUE_ACQUIRED%'and pg_get_functiondef(p.oid)like'%ENTRY_FEE_ACQUIRED%'and pg_get_functiondef(p.oid)like'%MARKETING_COST%'and pg_get_functiondef(p.oid)like'%OPERATING_CHARGE%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='post_platform_core_pot_entry'),'post accepts Core, entry fee, marketing and operating charge categories');
select ok((select pg_get_functiondef(p.oid)like'%distributable_remainder_minor%'and pg_get_functiondef(p.oid)like'%NEOXA_JALIL%'and pg_get_functiondef(p.oid)like'%ASMA_MATRICIA%'and pg_get_functiondef(p.oid)like'%aa:=aa+rem%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='close_platform_core_pot_period'),'closure splits remainder 50/50 with Asma rounding remainder');
select ok((select pg_get_functiondef(p.oid)like'%INSUFFICIENT_PLATFORM_CORE_POT_BALANCE%'and pg_get_functiondef(p.oid)like'%pg_advisory_xact_lock%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='record_platform_core_pot_payout'),'payout is serialized and balance-checked');

select ok((select count(*)=5 and bool_and(pg_get_functiondef(p.oid)like'%begin_contract_command%'and pg_get_functiondef(p.oid)like'%finish_contract_command%'and pg_get_functiondef(p.oid)like'%audit_events%'and pg_get_functiondef(p.oid)like'%event_outbox%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array[
 'create_platform_core_pot_rule','open_platform_core_pot_book','post_platform_core_pot_entry','close_platform_core_pot_period','record_platform_core_pot_payout'
])),'all five commands use idempotency, audit and outbox');

-- Franchise IT 50/50 engine must remain untouched by this additive migration.
select is((select neoxa_share_bps from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),5000,'IT franchise rule still 50 percent NEOXA');
select is((select asma_matricia_share_bps from public.franchise_finance_rule_versions where franchise_type='IT'and version=1),0,'IT franchise rule still 0 percent Asma');
select ok((select entry_fee_required and franchisee_share_bps=5000 and neoxa_share_bps=2500 and asma_matricia_share_bps=2500 from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),'STANDARD franchise rule still 50/25/25');
select ok((select count(*)>=6 from pg_indexes where schemaname='public'and tablename like'platform_core_pot_%'),'platform core pot indexes exist');

select * from finish();
rollback;
