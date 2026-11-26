begin;
set local search_path=public,extensions,pg_temp;
select no_plan();
grant usage on schema extensions to authenticated;
create temp table fin410(k text primary key,v jsonb);
grant all on fin410 to authenticated;
-- Privileged fixture setup only: immutable canonical classification and balanced
-- journals. Every command/assertion below uses the real authenticated role.
do $$
declare a uuid:=extensions.gen_random_uuid();o uuid:=extensions.gen_random_uuid();cash uuid:=extensions.gen_random_uuid();rev uuid:=extensions.gen_random_uuid();tax uuid:=extensions.gen_random_uuid();expense uuid:=extensions.gen_random_uuid();
 outsider uuid:=extensions.gen_random_uuid();policy uuid:=extensions.gen_random_uuid();fund uuid;cl uuid;j uuid;l bigint;i integer;rule uuid;
begin
 insert into auth.users(id,email)values(a,'fin410-'||a||'@example.invalid');
 insert into public.organizations(id,legal_name,display_name,status,created_by)values(o,'Finance regression','Finance regression','ACTIVE',a);
 insert into public.platform_user_roles(user_id,role_code)values(a,'FINANCE_MANAGER');
 insert into auth.users(id,email)values(outsider,'outsider410-'||outsider||'@example.invalid');
 insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values(cash,o,'FIN410_CASH','Cash','ASSET','MAD'),(rev,o,'FIN410_CORE','Core','REVENUE','MAD'),(tax,o,'FIN410_TAX','Tax','LIABILITY','MAD'),(expense,o,'FIN410_COST','Cost','EXPENSE','MAD');
 insert into public.credit_revenue_policy_versions_v1(id,policy_kind,source_kind,source_version_id,version,currency,environment,valid_from,policy_snapshot,content_hash,reason,created_by,idempotency_key,correlation_id)
 values(policy,'FISCAL','SUBSCRIPTION',extensions.gen_random_uuid(),1,'MAD','DEVELOPMENT','2026-01-01','{}',repeat('1',64),'Isolated finance regression policy',a,'fin410-policy',extensions.gen_random_uuid());
 select id into rule from public.platform_core_pot_rule_versions where version=1;
 insert into fin410 values('context',jsonb_build_object('actor',a,'outsider',outsider,'org',o,'rule',rule,'cash',cash,'tax',tax));
 for i in 1..4 loop
  fund:=extensions.gen_random_uuid();cl:=extensions.gen_random_uuid();j:=extensions.gen_random_uuid();
  insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
  values(j,o,'CREDIT_REVENUE_CLASSIFICATION','MAD','fin410',i::text,extensions.gen_random_uuid(),'2026-11-14 12:00+01','Synthetic classification fixture',a);
  insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(o,j,cash,'DEBIT',12000,'MAD'),(o,j,rev,'CREDIT',10000,'MAD'),(o,j,tax,'CREDIT',2000,'MAD');
  insert into public.credit_economic_funding_sources_v1(id,source_kind,source_id,organization_id,source_version_id,financial_journal_id,gross_minor,currency,paid_at,source_snapshot,source_hash,correlation_id)
  values(fund,'SUBSCRIPTION','fin410-'||fund,o,extensions.gen_random_uuid(),j,12000,'MAD','2026-11-14 12:00+01','{}',repeat('1',64),extensions.gen_random_uuid());
  insert into public.credit_economic_classifications_v1(id,funding_source_id,version,fiscal_policy_id,allocation_policy_id,gross_minor,net_minor,tax_minor,core_minor,benefit_pool_minor,unallocated_credit_minor,classification_snapshot,content_hash,created_by,correlation_id)
  values(cl,fund,1,policy,policy,12000,10000,2000,10000,0,0,'{"fiscal_policy":{"policy_snapshot":{"recognition_accounts":{"core":{"code":"FIN410_CORE"}}}}}',repeat('1',64),a,extensions.gen_random_uuid());
  insert into private.credit_economic_classification_journals_v1(classification_id,financial_journal_id,source_hash)values(cl,j,repeat('1',64));
  insert into public.credit_revenue_ledger_v1(funding_source_id,classification_id,entry_type,revenue_class,amount_minor,currency,source_key,source_hash,correlation_id)
  values(fund,cl,'CLASSIFY','CORE_SUBSCRIPTION_REVENUE',10000,'MAD',cl::text,repeat('1',64),extensions.gen_random_uuid())returning id into l;
  insert into fin410 values('source'||i,jsonb_build_object('fund',fund,'journal',j,'ledger',l));
 end loop;
 j:=extensions.gen_random_uuid();
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(j,o,'EXPENSE','MAD','fin410','expense',extensions.gen_random_uuid(),'2026-11-14 12:00+01','Audit expense probe regression',a);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(o,j,expense,'DEBIT',100,'MAD'),(o,j,cash,'CREDIT',100,'MAD');
 insert into fin410 values('expense',to_jsonb(j));
 j:=extensions.gen_random_uuid();
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(j,o,'REVERSAL','MAD','fin410','reversal',extensions.gen_random_uuid(),'2026-11-14 12:00+01','Exact reversal regression',a);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(o,j,cash,'CREDIT',12000,'MAD'),(o,j,rev,'DEBIT',10000,'MAD'),(o,j,tax,'DEBIT',2000,'MAD');
 insert into fin410 values('reversal-journal',to_jsonb(j));
 cash:=extensions.gen_random_uuid();rev:=extensions.gen_random_uuid();j:=extensions.gen_random_uuid();
 insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values(cash,o,'FIN410_EUR_CASH','Euro cash','ASSET','EUR'),(rev,o,'FIN410_EUR_CORE','Euro revenue','REVENUE','EUR');
 insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values(j,o,'REVENUE','EUR','fin410','eur',extensions.gen_random_uuid(),'2026-11-14 12:00+01','Currency mismatch regression',a);
 insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values(o,j,cash,'DEBIT',10000,'EUR'),(o,j,rev,'CREDIT',10000,'EUR');
 insert into fin410 values('eur',to_jsonb(j));
end$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',v->>'actor','role','authenticated','aal','aal2')::text,true) from fin410 where k='context';
insert into fin410 select 'book',public.open_platform_core_pot_book((v->>'org')::uuid,'MAD',(v->>'rule')::uuid,'fin410-open')from fin410 where k='context';
-- Session-local wrappers retain INVOKER privileges and simplify negative cases.
create function pg_temp.post410(n integer,amount bigint default 10000,source_type text default 'CREDIT_REVENUE_LEDGER',source_id text default null,journal uuid default null,key text default null,effective_on date default '2026-11-14')returns jsonb language sql as $$
 select public.post_platform_core_pot_entry((b.v->>'book_id')::uuid,'REVENUE','CORE_SUBSCRIPTION_REVENUE_ACQUIRED',amount,coalesce(journal,(s.v->>'journal')::uuid),source_type,coalesce(source_id,s.v->>'ledger'),effective_on,'Regression canonical recognition',null,coalesce(key,'fin410-post-'||n))from fin410 b,fin410 s where b.k='book'and s.k='source'||n
$$;
select throws_ok($$select pg_temp.post410(1,12000)$$,'23514','CORE_SOURCE_NET_MISMATCH','gross including VAT cannot be recognized');
select throws_ok($$select pg_temp.post410(1,10001)$$,'23514','CORE_SOURCE_NET_MISMATCH','inflated net rejected');
select throws_ok($$select pg_temp.post410(1,10000,'FINANCIAL_JOURNAL')$$,'23514','CORE_SOURCE_CANONICAL_REQUIRED','unproven journal source rejected');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER','999999999')$$,'23514','CORE_SOURCE_CANONICAL_MISMATCH','invented source rejected');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER',null,(select(v->>'journal')::uuid from fin410 where k='source2'))$$,'23514','CORE_SOURCE_CANONICAL_MISMATCH','unrelated balanced journal rejected');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER',null,null,null,'2026-11-13')$$,'23514','CORE_SOURCE_CONTEXT_MISMATCH','source date must match canonical Casablanca date');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER',null,(select(v#>>'{}')::uuid from fin410 where k='expense'))$$,'23514','CORE_SOURCE_CANONICAL_MISMATCH','balanced expense cannot supply Core revenue');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER',null,(select(v#>>'{}')::uuid from fin410 where k='eur'))$$,'22023','INVALID_PLATFORM_CORE_POT_ENTRY','foreign currency journal rejected');
insert into fin410 values('post',pg_temp.post410(1));
select is(pg_temp.post410(1),(select v from fin410 where k='post'),'post replay returns original receipt');
select throws_ok($$select pg_temp.post410(1,9999)$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same post key with changed amount is refused');
select throws_ok($$select pg_temp.post410(1,10000,'CREDIT_REVENUE_LEDGER',null,null,'fin410-duplicate')$$,'23514','CORE_SOURCE_ALREADY_RECOGNIZED','economic source cannot be reused with another key');
select is((select sum(amount_minor)::bigint from public.platform_core_pot_entries where book_id=(select(v->>'book_id')::uuid from fin410 where k='book')),10000::bigint,'only net recognized');
insert into fin410 values('cutoff',to_jsonb(clock_timestamp()));
create function pg_temp.close410(key text default 'fin410-close',start_on date default '2026-11-12',end_on date default '2026-11-15')returns jsonb language sql as $$
 select public.close_platform_core_pot_period((b.v->>'book_id')::uuid,start_on,end_on,(c.v->>'rule')::uuid,(t.v#>>'{}')::timestamptz,'Regression closure of canonical net',key)from fin410 b,fin410 c,fin410 t where b.k='book'and c.k='context'and t.k='cutoff'
$$;
insert into fin410 values('close',pg_temp.close410());
select lives_ok('set constraints all immediate','deferred journal and allocation constraints pass as authenticated');
set constraints all deferred;
select is(pg_temp.close410(),(select v from fin410 where k='close'),'closure retry stable despite generated version');
select throws_ok($$select pg_temp.close410('fin410-overlap','2026-11-14','2026-11-16')$$,'23514','CORE_POT_PERIOD_OVERLAP','distinct overlapping period refused');
select is((pg_temp.close410('fin410-version2')->>'version')::integer,2,'same period gets a corrective version');
select is((select sum(amount_minor)::bigint from public.platform_core_pot_distribution_ledger_entries where book_id=(select(v->>'book_id')::uuid from fin410 where k='book')),10000::bigint,'version two does not duplicate accrued rights');
-- Build payout journal via native RPC, not direct inserts under authenticated.
insert into fin410 select 'payout-journal',to_jsonb(public.post_financial_journal((v->>'org')::uuid,'fin410-payout-journal',null,'CORE_PAYOUT','MAD','2026-11-15','Regression payout',jsonb_build_array(jsonb_build_object('account_id',v->>'tax','direction','DEBIT','amount_minor',5000),jsonb_build_object('account_id',v->>'cash','direction','CREDIT','amount_minor',5000))))from fin410 where k='context';
create function pg_temp.payout410(key text default 'fin410-payout')returns jsonb language sql as $$
 select public.record_platform_core_pot_payout((b.v->>'book_id')::uuid,'NEOXA_JALIL',5000,(j.v#>>'{}')::uuid,'Regression payout',repeat('2',64),key)from fin410 b,fin410 j where b.k='book'and j.k='payout-journal'
$$;
insert into fin410 values('payout',pg_temp.payout410());
select is(pg_temp.payout410(),(select v from fin410 where k='payout'),'full payout retry succeeds at zero balance');
reset role;
insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)
 select(v->>'fund')::uuid,'SOURCE_REVIEW_REQUIRED','NATIVE_REFUND_REQUIRES_FISCAL_REVERSAL',repeat('3',64),'{}',extensions.gen_random_uuid()from fin410 where k in('source1','source2');
set local role authenticated;
select is((select count(*)::integer from public.platform_core_pot_entries where effect_type='REVERSAL_REVENUE'and book_id=(select(v->>'book_id')::uuid from fin410 where k='book')),1,'invalidation appends one compensating entry');
select throws_ok($$select pg_temp.post410(2)$$,'23514','CORE_SOURCE_INVALIDATED','refund before ingestion blocks recognition');
select is(pg_temp.post410(1),(select v from fin410 where k='post'),'post replay survives later refund');
select is(pg_temp.payout410(),(select v from fin410 where k='payout'),'completed payout receipt survives later invalidation');
select throws_ok($$select pg_temp.payout410('fin410-new-payout')$$,'23514','CORE_POT_CORRECTIVE_CLOSE_REQUIRED','new payout blocked until corrective closure');
select throws_ok($$select pg_temp.close410('fin410-stale-cutoff')$$,'23514','CORE_POT_CUTOFF_EXCLUDES_ENTRIES','old cutoff cannot hide compensation');
update fin410 set v=to_jsonb(clock_timestamp())where k='cutoff';
select is((pg_temp.close410('fin410-correction')->>'distributable_remainder_minor')::bigint,0::bigint,'corrective closure removes invalidated revenue');
select is((select sum(amount_minor)::bigint from public.platform_core_pot_distribution_ledger_entries where book_id=(select(v->>'book_id')::uuid from fin410 where k='book')),-5000::bigint,'paid amounts retained as recoverable debt, no ledger rewrite');
select lives_ok('set constraints all immediate','corrective constraints pass as authenticated');
set constraints all deferred;
select lives_ok($$select pg_temp.post410(3)$$,'second valid source recognized before close');
reset role;
insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)
 select(v->>'fund')::uuid,'SOURCE_REVIEW_REQUIRED','NATIVE_DISPUTE_REQUIRES_REVIEW',repeat('4',64),'{}',extensions.gen_random_uuid()from fin410 where k in('source1','source3');
set local role authenticated;
select is((select count(*)::integer from public.platform_core_pot_entries where effect_type='REVERSAL_REVENUE'and book_id=(select(v->>'book_id')::uuid from fin410 where k='book')),2,'second invalidation is compensated; repeat invalidation does not duplicate reversal');
update fin410 set v=to_jsonb(clock_timestamp())where k='cutoff';
select is((pg_temp.close410('fin410-before-close-refund')->>'distributable_remainder_minor')::bigint,0::bigint,'refund between ingestion and closure excluded');
select lives_ok('set constraints all immediate','all financial constraints remain valid');
create function pg_temp.ingest410()returns jsonb language sql as $$select public.ingest_platform_core_pot_sources_v1((b.v->>'book_id')::uuid,(s.v->>'journal')::uuid,(s.v->>'ledger')::bigint,null,'Regression canonical ingestion','fin410-ingest')from fin410 b,fin410 s where b.k='book'and s.k='source4'$$;
insert into fin410 values('ingested',pg_temp.ingest410());
select is(pg_temp.ingest410(),(select v from fin410 where k='ingested'),'canonical ingestion replay stable');
create function pg_temp.reverse410()returns jsonb language sql as $$select public.post_platform_core_pot_entry((b.v->>'book_id')::uuid,'REVERSAL_REVENUE','CORE_SUBSCRIPTION_REVENUE_ACQUIRED',10000,(j.v#>>'{}')::uuid,'FINANCIAL_JOURNAL',j.v#>>'{}','2026-11-14','Exact accounting reversal',(i.v#>>'{post,entry_id}')::uuid,'fin410-reversal')from fin410 b,fin410 j,fin410 i where b.k='book'and j.k='reversal-journal'and i.k='ingested'$$;
insert into fin410 values('reversed',pg_temp.reverse410());
select is(pg_temp.reverse410(),(select v from fin410 where k='reversed'),'manual reversal replay stable after original is reversed');
reset role;
insert into public.credit_economic_processing_events_v1(funding_source_id,status,reason_code,context_hash,details,correlation_id)
 select(v->>'fund')::uuid,'SOURCE_REVIEW_REQUIRED','NATIVE_REFUND_REQUIRES_FISCAL_REVERSAL',repeat('5',64),'{}',extensions.gen_random_uuid()from fin410 where k='source4';
set local role authenticated;
select is(pg_temp.ingest410(),(select v from fin410 where k='ingested'),'ingestion receipt remains stable after source invalidation');
select lives_ok('set constraints all immediate','manual reversal keeps accounting balanced');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.platform_core_pot_books),0,'missing identity cannot read books');
select throws_ok($$select pg_temp.close410()$$,'42501','PLATFORM_CORE_POT_CLOSE_DENIED','receipt lookup never bypasses authorization');
reset role;
select ok(not has_function_privilege('anon','public.close_platform_core_pot_period(uuid,date,date,uuid,timestamptz,text,text,uuid)','EXECUTE'),'anonymous RPC denied');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',v->>'outsider','role','authenticated','aal','aal2')::text,true)from fin410 where k='context';
select is((select count(*)::integer from public.platform_core_pot_books),0,'authenticated non-finance user cannot read books');
select throws_ok($$select pg_temp.close410()$$,'42501','PLATFORM_CORE_POT_CLOSE_DENIED','authenticated non-finance cannot replay closure');
select throws_ok($$select private.platform_core_pot_access((b.v->>'book_id')::uuid,(c.v->>'actor')::uuid)from fin410 b,fin410 c where b.k='book'and c.k='context'$$,'42501','permission denied for schema private','private helper schema remains inaccessible to caller');
reset role;
select * from finish();
rollback;
