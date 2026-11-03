begin;
set local search_path=public,extensions;
select plan(49);

-- 01
select ok((select count(*)=3 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind='r'and c.relname=any(array['tax_jurisdictions','tax_categories','tax_rule_validation_events'])),'Morocco tax reference and validation tables exist');
-- 02
select ok((select count(*)=3 and bool_and(c.relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname=any(array['tax_jurisdictions','tax_categories','tax_rule_validation_events'])),'new tax tables have RLS enabled');
-- 03
select ok((select relrowsecurity from pg_class where oid='public.tax_rule_versions'::regclass),'versioned tax rules retain RLS');
-- 04
select ok((select count(*)=11 from information_schema.columns where table_schema='public'and table_name='tax_rule_versions'and column_name=any(array['rule_type','priority','conditions','legal_reference','rounding_strategy','approved_by','approved_at','validation_reference','content_hash','change_reason','row_version'])),'tax rule lifecycle and validation columns exist');
-- 05
select ok((select count(*)=2 from pg_constraint where conrelid='public.tax_rule_versions'::regclass and conname=any(array['tax_rules_jurisdiction_fk','tax_rules_category_fk'])),'tax rules reference jurisdiction and category');
-- 06
select ok(exists(select 1 from pg_constraint where conrelid='public.tax_rule_versions'::regclass and conname='tax_rules_active_validation_check'and pg_get_constraintdef(oid)like'%professional_validation_status%'),'activation requires professional validation state');
-- 07
select ok(exists(select 1 from pg_constraint where conrelid='public.tax_rule_versions'::regclass and conname='tax_rules_validated_approval_check'and pg_get_constraintdef(oid)like'%validation_reference%'),'validated rules require approver, timestamp and reference');
-- 08
select ok(exists(select 1 from pg_constraint where conrelid='public.tax_rule_versions'::regclass and conname='tax_rules_no_active_period_overlap'and contype='x'),'active category periods cannot overlap');
-- 09
select ok((select count(*)=4 from pg_trigger where tgname=any(array['tax_jurisdictions_immutable','tax_categories_immutable','tax_rule_versions_content_immutable','tax_rule_validation_events_immutable'])and not tgisinternal),'tax reference, rule content and validation history have immutability triggers');
-- 10
select ok((select pg_get_functiondef(p.oid)like'%IMMUTABLE_TAX_REFERENCE%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='prevent_tax_reference_change'),'immutable tax histories reject update and delete');
-- 11
select ok((select count(*)=4 from pg_policies where schemaname='public'and tablename=any(array['tax_jurisdictions','tax_categories','tax_rule_versions','tax_rule_validation_events'])),'four restrictive authenticated read policies exist');
-- 12
select ok(not has_table_privilege('authenticated','public.tax_jurisdictions','INSERT')and not has_table_privilege('authenticated','public.tax_categories','UPDATE')and not has_table_privilege('authenticated','public.tax_rule_versions','INSERT')and not has_table_privilege('authenticated','public.tax_rule_validation_events','DELETE'),'authenticated cannot bypass tax RPCs with writes');
-- 13
select ok(not has_table_privilege('service_role','public.tax_rule_versions','INSERT')and not has_table_privilege('service_role','public.tax_rule_validation_events','UPDATE'),'service role has no direct tax mutation grant');
-- 14
select ok(has_table_privilege('authenticated','public.tax_jurisdictions','SELECT')and has_table_privilege('authenticated','public.tax_categories','SELECT')and has_table_privilege('authenticated','public.tax_rule_versions','SELECT')and has_table_privilege('authenticated','public.tax_rule_validation_events','SELECT'),'authenticated reads are mediated by RLS');
-- 15
select ok((select count(*)=4 and bool_and(p.prosecdef and p.proconfig::text like'%search_path=%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['list_morocco_tax_rules','simulate_morocco_tax','propose_morocco_tax_rule','decide_morocco_tax_rule'])),'four public tax RPCs are security definer with fixed search paths');
-- 16
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['list_morocco_tax_rules','simulate_morocco_tax','propose_morocco_tax_rule','decide_morocco_tax_rule'])and has_function_privilege('anon',p.oid,'EXECUTE')),'anonymous role cannot execute tax RPCs');
-- 17
select ok((select count(*)=4 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['list_morocco_tax_rules','simulate_morocco_tax','propose_morocco_tax_rule','decide_morocco_tax_rule'])),'authenticated role can call the four guarded tax RPCs');
-- 18
select ok((select count(*)=2 and bool_and(not has_function_privilege('authenticated',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname=any(array['calculate_tax_minor','resolve_morocco_tax'])),'private calculation and resolution cannot be invoked by authenticated clients');
-- 19
select ok((select has_function_privilege('authenticated',p.oid,'EXECUTE')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='morocco_tax_admin'),'RLS can invoke the authenticated AAL2 helper');
-- 20
select ok((select count(*)=10 from public.tax_categories where status='ACTIVE'),'ten Gold Master Morocco tax categories are seeded');
-- 21
select ok((select bool_and(length(btrim(name_fr))>=2 and length(btrim(name_ar))>=2 and length(btrim(description_ar))>0)from public.tax_categories),'all categories contain complete French and Arabic labels');
-- 22
select ok((select category_kind='CREDIT_NOTE'and requires_source_rule from public.tax_categories where code='CREDIT_NOTE'),'credit notes require their source tax rule');
-- 23
select ok((select count(*)=9 from public.tax_rule_versions where jurisdiction_code='MA'and status='RETIRED'and professional_validation_status='DEMO'),'nine explicit non-production demo rules are retired until accountant validation');
-- 24
select ok(not exists(select 1 from public.tax_rule_versions where jurisdiction_code='MA'and category_code='CREDIT_NOTE'and status='ACTIVE'),'credit notes never receive an independent active rate');
-- 25
select ok((select bool_and(conditions->>'environment_class'='NON_PRODUCTION_DEMO'and(conditions->>'requires_accountant_validation')::boolean)from public.tax_rule_versions where jurisdiction_code='MA'and professional_validation_status='DEMO'),'every demo rule is explicitly marked non-production and unvalidated');
-- 26
select ok((select bool_and(legal_reference like'%validation expert-comptable Maroc requise%'and change_reason like'%interdite%production%')from public.tax_rule_versions where jurisdiction_code='MA'and professional_validation_status='DEMO'),'demo seeds carry an explicit professional-validation warning');
-- 27
select ok((select rate_basis_points=2000 and rule_type='VAT'from public.tax_rule_versions where jurisdiction_code='MA'and category_code='PROVIDER_COMMISSION'and professional_validation_status='DEMO' order by version desc limit 1),'provider commission demo rate is versioned data');
-- 28
select ok((select rate_basis_points=0 and rule_type='OUT_OF_SCOPE'from public.tax_rule_versions where jurisdiction_code='MA'and category_code='PENALTY'and professional_validation_status='DEMO' order by version desc limit 1),'penalty classification is independently versioned');
-- 29
select ok(not exists(select 1 from public.tax_rule_versions where jurisdiction_code='MA'and status='ACTIVE'and professional_validation_status<>'VALIDATED'),'active tax rules must be professionally validated');
-- 30
select ok(not exists(select 1 from public.tax_rule_versions where jurisdiction_code='MA'and status='ACTIVE'and professional_validation_status='DEMO'),'no DEMO tax rule remains ACTIVE');
-- 31
select ok((select p.prosrc like'%p_actor=auth.uid()%'and p.prosrc like'%coalesce(auth.jwt()->>''aal'','''')=''aal2''%'and p.prosrc like'%FINANCE_MANAGER%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='morocco_tax_admin'),'tax administration binds the caller identity, fails closed on AAL2 and checks privileged roles');
-- 32
select ok((select count(*)=4 and bool_and(pg_get_functiondef(p.oid)like'%morocco_tax_admin%')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=any(array['list_morocco_tax_rules','simulate_morocco_tax','propose_morocco_tax_rule','decide_morocco_tax_rule'])),'all public tax workflows enforce the central AAL2 authorization helper');
-- 33
select ok((select strpos(p.prosrc,'begin_fiscal_command_v1')<strpos(p.prosrc,'select coalesce(max(version)')and strpos(p.prosrc,'request_hash')<strpos(p.prosrc,'begin_fiscal_command_v1')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='propose_morocco_tax_rule'),'proposal reserves idempotency before allocating a version number');
-- 33
select ok((select pg_get_functiondef(p.oid)like'%morocco.tax_rule.proposed%'and pg_get_functiondef(p.oid)like'%MoroccoTaxRuleProposedV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='propose_morocco_tax_rule'),'tax proposals are audited and emit Outbox events');
-- 34
select ok((select p.prosrc like'%a=x.created_by%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_morocco_tax_rule'),'rule authors cannot approve their own proposal');
-- 35
select ok((select strpos(p.prosrc,'begin_fiscal_command_v1')<strpos(p.prosrc,'INVALID_MOROCCO_TAX_LIFECYCLE')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_morocco_tax_rule'),'decision retries replay before current lifecycle validation');
-- 36
select ok((select p.prosrc like'%STALE_MOROCCO_TAX_RULE%'and p.prosrc like'%row_version=row_version+1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_morocco_tax_rule'),'decisions enforce optimistic concurrency');
-- 37
select ok((select pg_get_functiondef(p.oid)like'%morocco.tax_rule.decided%'and pg_get_functiondef(p.oid)like'%MoroccoTaxRuleActivatedV1%'and pg_get_functiondef(p.oid)like'%MoroccoTaxRuleRetiredV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_morocco_tax_rule'),'tax decisions are audited and emit lifecycle Outbox events');
-- 38
select ok((select regexp_replace(p.prosrc,'\s+','','g') like'%effective_from<=p_effective_on%'and regexp_replace(p.prosrc,'\s+','','g') like'%effective_to>=p_effective_on%'and regexp_replace(p.prosrc,'\s+','','g') like'%status=''ACTIVE''%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='resolve_morocco_tax'),'resolution applies category and inclusive effective dates');
-- 39
select ok((select pg_get_functiondef(p.oid)like'%CREDIT_NOTE_SOURCE_RULE_REQUIRED%'and pg_get_functiondef(p.oid)like'%p_source_rule_version_id%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='resolve_morocco_tax'),'credit notes resolve only through their source version');
-- 40
select ok((select pg_get_functiondef(p.oid)like'%NEGATIVE_NET_REQUIRES_CREDIT_NOTE%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='resolve_morocco_tax'),'negative ordinary lines are rejected');
-- 41
select ok((select pg_get_functiondef(p.oid)not like'%double precision%'and pg_get_functiondef(p.oid)not like'% real %'and pg_get_functiondef(p.oid)like'%::numeric%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='calculate_tax_minor'),'tax calculation uses exact numeric arithmetic and no floating point');
-- 42
select is(private.calculate_tax_minor(101,2000),20::bigint,'exact half-away calculation rounds 20.2 down');
-- 43
select is(private.calculate_tax_minor(103,2000),21::bigint,'exact half-away calculation rounds 20.6 up');
-- 44
select is(private.calculate_tax_minor(-103,2000),(-21)::bigint,'negative credit-note calculation rounds symmetrically');
select throws_ok($$select private.resolve_morocco_tax('PROVIDER_COMMISSION','2026-09-10',12345,null::uuid)$$,'P0002','MOROCCO_TAX_RULE_NOT_FOUND','retired DEMO seeds cannot drive financial calculations');
-- Transaction-local fiscal approval fixture; never activate the DEMO seed rules.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('f0310000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax-fixture-reviewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.tax_rule_versions(jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason)
select jurisdiction_code,category_code,999,rate_basis_points,effective_from,null,'ACTIVE','VALIDATED',rule_type,priority,'{"test_fixture":true}','Transactional automated test approval, not a production tax validation',rounding_strategy,'f0310000-0000-4000-8000-000000000001',now(),'TEST-ONLY-APPROVAL',content_hash,'Hermetic test-only validated fiscal rule fixture'
from public.tax_rule_versions where jurisdiction_code='MA' and professional_validation_status='DEMO' and status='RETIRED';

select is(private.resolve_morocco_tax('PROVIDER_COMMISSION','2026-09-10',12345,null::uuid)->>'professional_validation_status','VALIDATED','financial tax resolution uses the separately approved test version');
-- 45
select ok((private.resolve_morocco_tax('PROVIDER_COMMISSION','2026-09-10',12345,null::uuid)->>'tax_amount_minor')='2469'and(private.resolve_morocco_tax('PROVIDER_COMMISSION','2026-09-10',12345,null::uuid)->>'line_gross_minor')='14814','database-resolved HT to TVA to TTC is exact and serialized safely');
-- 46
select ok((select strpos(p.prosrc,'begin_provider_billing_command')<strpos(p.prosrc,'resolve_morocco_tax')and p.prosrc like'%PENALTY_ACCRUAL''then''PENALTY''%'and split_part(p.prosrc,'r:=private.begin_provider_billing_command',1)not like'%tax_rule_version_id%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='record_provider_payable_event_pre_archive_v1'),'provider payable mapping is category-aware and retries replay before tax resolution');

select * from finish();
rollback;
