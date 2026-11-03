begin;
set local search_path=public,extensions;
select plan(27);
-- Unit SQL and structural security guards only. The positive end-to-end receipt
-- uses the separate native browser Accounting/Client/Finance fixture. No clock,
-- signed hash, money, business record or scheduler output is manufactured here.
select ok((select p.provolatile='i'and p.proisstrict and not p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%'from pg_proc p where p.oid='private.provider_finance_civil_date_v1(timestamptz)'::regprocedure),'civil date is a pure strict immutable projection with fixed search path');
select ok(not has_function_privilege('anon','private.provider_finance_civil_date_v1(timestamptz)','EXECUTE')and not has_function_privilege('authenticated','private.provider_finance_civil_date_v1(timestamptz)','EXECUTE')and not has_function_privilege('service_role','private.provider_finance_civil_date_v1(timestamptz)','EXECUTE'),'civil calendar helper has no public, member or service execution grant');
select is(private.provider_finance_civil_date_v1('2026-11-02 22:59:59.999999+00'),date '2026-11-02','instant immediately before Moroccan midnight stays on November 2');
select is(private.provider_finance_civil_date_v1('2026-11-02 23:00:00+00'),date '2026-11-03','Moroccan midnight advances before UTC midnight');
select is(private.provider_finance_civil_date_v1('2026-12-31 23:00:00+00'),date '2027-01-01','Moroccan year rollover uses the civil day');
select is(private.provider_finance_civil_date_v1('2026-02-20 23:00:00+00'),date '2026-02-20','Ramadan UTC+0 does not invent a permanent one-hour offset');
select is(private.provider_finance_civil_date_v1('2026-02-21 00:00:00+00'),date '2026-02-21','Ramadan midnight advances at UTC midnight');
select is(private.provider_finance_civil_date_v1('2026-11-03 00:00:00+01'),private.provider_finance_civil_date_v1('2026-11-02 23:00:00+00'),'equivalent timestamp representations have the same civil date');
select is(private.provider_finance_civil_date_v1(null),null::date,'a missing instant never invents today');
select is(private.provider_finance_civil_date_v1(clock_timestamp()),(clock_timestamp()at time zone 'Africa/Casablanca')::date,'current finance civil day agrees with the scheduler calendar');
select ok(private.provider_finance_civil_date_v1(clock_timestamp())+1>private.provider_finance_civil_date_v1(clock_timestamp()),'a real future civil day remains future');
select ok(('2026-11-02 23:30:00+00'::timestamptz at time zone 'UTC')::date=date '2026-11-02'and private.provider_finance_civil_date_v1('2026-11-02 23:30:00+00')=date '2026-11-03','reproduced UTC-November-2/Morocco-November-3 discrepancy is covered explicitly');
-- Session changes below belong only to this rollback-only unit test. Neither
-- production commands nor signature fixtures change their connection TimeZone.
select set_config('test.finance_original_timezone',current_setting('TimeZone'),true);
set local timezone='Pacific/Kiritimati';
select is(private.provider_finance_civil_date_v1('2026-11-02 23:30:00+00'),date '2026-11-03','projection is independent of a session ahead of Morocco');
set local timezone='America/Los_Angeles';
select is(private.provider_finance_civil_date_v1('2026-11-02 23:30:00+00'),date '2026-11-03','projection is independent of a session behind Morocco');
select set_config('TimeZone',current_setting('test.finance_original_timezone'),true);

with command as(select pg_get_functiondef('public.record_provider_payable_event(uuid,text,date,character,bigint,text,text,text,uuid)'::regprocedure)as definition)
select ok(definition like '%p_occurred_on is null or p_occurred_on>private.provider_finance_civil_date_v1(clock_timestamp())%'and definition not like '%p_occurred_on>current_date%'and definition like '%p_gross_amount_minor<=0%'and definition like '%m.status in(''PLANNED'',''CANCELLED'')%'and definition like '%INVALID_RECEIPT_DECLARATION%','receipt rejects missing/future civil dates and retains positive amount and mission-state gates')from command;
with command as(select pg_get_functiondef('public.record_provider_payment(uuid,text,date,text,character,bigint,text,uuid,uuid,text,uuid)'::regprocedure)as definition)
select ok(definition like '%p_paid_on is null or p_paid_on>private.provider_finance_civil_date_v1(clock_timestamp())%'and definition not like '%p_paid_on>current_date%'and definition like '%p_amount_minor<=0%'and definition like '%INVALID_PROVIDER_LEDGER_ACCOUNT%','payment rejects missing/future civil dates and retains exact positive amounts and scoped ledger validation')from command;
select ok((select count(*)=2 and bool_and(p.prosecdef and p.proconfig::text like '%search_path=%'and p.proconfig::text not ilike '%timezone=%'and has_function_privilege('authenticated',p.oid,'EXECUTE')and not has_function_privilege('anon',p.oid,'EXECUTE')and not has_function_privilege('service_role',p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('record_provider_payable_event','record_provider_payment')),'date correction preserves scoped command ACLs and never configures a session TimeZone');
with command as(select pg_get_functiondef('private.declare_provider_finance_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure)as definition)
select ok(definition like '%private.provider_billing_write_access(p_org,auth.uid())%'and definition like '%CLEAN_DECLARATION_PROOF_REQUIRED%'and definition like '%s.computed_sha256=u.declared_sha256%'and definition like '%PROOF_STORAGE_MISMATCH%','declaration retains current actor authorization, verified clean hash and storage checks')from command;
with command as(select pg_get_functiondef('private.declare_provider_finance_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure)as definition)
select ok(definition like '%h:=private.canonical_request_hash(p_payload)%'and definition like '%pg_advisory_xact_lock%'and definition like '%d.request_hash<>h or d.declared_by<>auth.uid()%'and definition like '%IDEMPOTENCY_PAYLOAD_MISMATCH%','actor-bound locked idempotency and canonical request hash stay unchanged')from command;
with reviewer as(select pg_get_functiondef('private.provider_finance_reviewer_v1()'::regprocedure)as definition)
select ok(definition like '%auth.jwt()->>''aal''=''aal2''%'and definition like '%SUPER_ADMIN%'and definition like '%FINANCE_MANAGER%','Finance approval still requires an authorized AAL2 reviewer')from reviewer;
with command as(select pg_get_functiondef('public.review_provider_financial_declaration_v1(uuid,boolean,text)'::regprocedure)as definition)
select ok(definition like '%d.declared_by=auth.uid()%'and definition like '%private.is_active_org_member(d.provider_organization_id,auth.uid())%'and definition like '%private.is_active_org_member(d.client_organization_id,auth.uid())%'and definition like '%CLIENT_RECEIPT_CONFIRMATION_REQUIRED%','review remains independent from declarant and both parties and requires client confirmation')from command;
with command as(select pg_get_functiondef('public.confirm_provider_receipt_declaration_v1(uuid,boolean,text)'::regprocedure)as definition)
select ok(definition like '%CLIENT_ACCOUNTING%'and definition like '%d.declared_by=auth.uid()%'and definition like '%private.is_active_org_member(d.provider_organization_id,auth.uid())%'and definition like '%CLIENT_RECEIPT_CONFIRMATION_DENIED%','client confirmation preserves its organization role and independence')from command;
with scheduler as(select pg_get_functiondef('public.run_provider_billing_scheduler_v1(integer)'::regprocedure)as definition)
select ok(definition like '%clock_timestamp()at time zone''Africa/Casablanca''%'and definition like '%date_trunc(''month'',clock_timestamp()at time zone''Africa/Casablanca'')::date-1%'and definition like '%ev.occurred_on<=ending%'and definition like '%bp.dispute_until<=clock_timestamp()%'and definition like '%p.effective_from<=today%','closing retains the prior Moroccan month and real contradictory deadlines')from scheduler;
with commands as(select pg_get_functiondef(p.oid)as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('record_provider_payable_event','record_provider_payment'))
select ok(count(*)=2 and bool_and(definition like '%return private.declare_provider_finance_v1(%'and definition not like '%insert into public.provider_payments%'and definition not like '%insert into public.provider_payable_events%'),'declaration wrappers still never settle debt or mint a payable')from commands;
with command as(select pg_get_functiondef('private.declare_provider_finance_v1(uuid,uuid,text,jsonb,text,uuid)'::regprocedure)as definition)
select ok(definition like '%public.audit_events%'and definition like '%public.event_outbox%'and definition like '%ProviderFinancialDeclarationSubmittedV1%','financial declarations retain immutable audit and transactional Outbox')from command;

-- Gate-only runtime checks, deliberately with no ledger/proof fixture: today
-- must reach the next validation; a genuine future date must fail first.
select throws_ok(format($query$select public.record_provider_payment(null,'TEST-CIVIL-DATE',%L::date,'BANK_TRANSFER','MAD'::char(3),1,repeat('a',64),null,null,'TEST-CIVIL-FUTURE')$query$,private.provider_finance_civil_date_v1(clock_timestamp())+1),'22023','INVALID_PAYMENT_DECLARATION','real future payment civil date is rejected by the command');
select throws_ok(format($query$select public.record_provider_payment(null,'TEST-CIVIL-DATE',%L::date,'BANK_TRANSFER','MAD'::char(3),1,repeat('a',64),null,null,'TEST-CIVIL-TODAY')$query$,private.provider_finance_civil_date_v1(clock_timestamp())),'23514','INVALID_PROVIDER_LEDGER_ACCOUNT','today in Morocco passes the date gate and reaches ledger validation without creating a payment');
select * from finish();
rollback;
