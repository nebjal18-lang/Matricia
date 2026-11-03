begin;
set local search_path = public, extensions;
select plan(15);

select ok((
  select count(*) = 5 and bool_and(p.prosecdef and p.proconfig::text like '%search_path=%')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any(array[
    'issue_provider_credit_note','request_provider_payment_plan','decide_provider_payment_plan',
    'open_provider_collection_case','advance_provider_collection_case'
  ])
), 'credit, plan and collection commands are security definer with a fixed search_path');

select ok((
  select count(*) = 5 and bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    and bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE'))
    and bool_and(not has_function_privilege('service_role', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any(array[
    'issue_provider_credit_note','request_provider_payment_plan','decide_provider_payment_plan',
    'open_provider_collection_case','advance_provider_collection_case'
  ])
), 'authenticated receives execute; anonymous and service_role do not');

select ok((
  pg_get_functiondef('public.issue_provider_credit_note_pre_policy_v1(uuid,text,date,bigint,bigint,text,text,uuid)'::regprocedure)
    not like '%update public.provider_invoices%'
  and pg_get_functiondef('public.issue_provider_credit_note_pre_policy_v1(uuid,text,date,bigint,bigint,text,text,uuid)'::regprocedure)
    like '%CREDIT_NOTE_EXCEEDS_INVOICE%'
  and pg_get_functiondef('public.issue_provider_credit_note_pre_policy_v1(uuid,text,date,bigint,bigint,text,text,uuid)'::regprocedure)
    like '%PROVIDER_CREDIT_NOTE%'
), 'credit notes never rewrite invoices and stay bounded by the original total');

select ok((
  pg_get_viewdef('public.provider_invoice_balances'::regclass, true) like '%credited_minor%'
  and pg_get_viewdef('public.provider_invoice_balances'::regclass, true) like '%PAYMENT_PLAN%'
  and pg_get_viewdef('public.provider_invoice_balances'::regclass, true) like '%OVERDUE%'
), 'invoice balances derive credited amounts, payment plans and overdue status');

select ok((
  pg_get_functiondef('public.reconcile_provider_payment(uuid,jsonb,text,uuid)'::regprocedure)
    like '%provider_invoice_outstanding_minor%'
  and pg_get_functiondef('private.provider_has_overdue_matricia_invoice(uuid)'::regprocedure)
    like '%payment_status = ''OVERDUE''%'
), 'reconciliation and the J+8 helper consume derived outstanding, not a mutated invoice');

select ok((
  pg_get_functiondef('public.list_admin_provider_closure_dashboard(integer)'::regprocedure)
    like '%payment_status = ''OVERDUE''%'
  and pg_get_functiondef('public.sweep_admin_exceptions()'::regprocedure)
    like '%payment_status = ''OVERDUE''%'
), 'closure dashboard and exception sweep treat only OVERDUE as blocking');

select ok((
  pg_get_functiondef('public.advance_provider_collection_case(uuid,text,text,text,uuid)'::regprocedure)
    like '%provider_collection_case_decisions%'
  and pg_get_functiondef('public.advance_provider_collection_case(uuid,text,text,text,uuid)'::regprocedure)
    not like '%update public.provider_collection_cases%'
  and pg_get_functiondef('public.open_provider_collection_case(uuid,text,text,uuid)'::regprocedure)
    like '%DEFAULTED%'
), 'collection advances by appending decisions and defaults an approved plan');

select ok(
  not has_function_privilege('authenticated', 'private.provider_invoice_outstanding_minor(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.provider_collection_case_status(uuid)', 'EXECUTE')
  and not has_table_privilege('anon', 'public.provider_credit_notes', 'SELECT')
  and has_table_privilege('authenticated', 'public.provider_credit_notes', 'SELECT'),
  'helpers stay private; credit notes are readable only through tenant RLS'
);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('a1684000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'credit-168@example.invalid', '', now(), '{}', '{}', now(), now()),
('a1684000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-168@example.invalid', '', now(), '{}', '{}', now(), now()),
('a1684000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-168@example.invalid', '', now(), '{}', '{}', now(), now());
insert into public.organizations(id, legal_name, display_name, status, created_by)
values
('b1684000-0000-4000-8000-000000000001', 'Credit 168', 'Credit 168', 'ACTIVE', 'a1684000-0000-4000-8000-000000000001'),
('b1684000-0000-4000-8000-000000000002', 'Plan 168', 'Plan 168', 'ACTIVE', 'a1684000-0000-4000-8000-000000000002'),
('b1684000-0000-4000-8000-000000000003', 'Other 168', 'Other 168', 'ACTIVE', 'a1684000-0000-4000-8000-000000000003');
insert into public.provider_match_profiles(provider_organization_id, company_verified, documents_valid, financial_status, quality_status, capacity_status, region_codes, partner_contract_signed)
values
('b1684000-0000-4000-8000-000000000001', true, true, 'OK', 'OK', 'AVAILABLE', array['CASABLANCA'], true),
('b1684000-0000-4000-8000-000000000002', true, true, 'OK', 'OK', 'AVAILABLE', array['CASABLANCA'], true);

set local session_replication_role = replica;
insert into public.provider_invoices(id, provider_organization_id, statement_id, invoice_number, currency, subtotal_minor, tax_minor, total_minor, issued_on, due_on, tax_rule_snapshot, document_hash, journal_id, correlation_id, created_by)
values
('c1684000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000001', 'd1684000-0000-4000-8000-000000000001', 'INV-CREDIT-168', 'MAD', 1000, 200, 1200, current_date - 10, current_date - 1, '[]', repeat('a', 64), 'e1684000-0000-4000-8000-000000000001', 'f1684000-0000-4000-8000-000000000001', 'a1684000-0000-4000-8000-000000000001'),
('c1684000-0000-4000-8000-000000000002', 'b1684000-0000-4000-8000-000000000002', 'd1684000-0000-4000-8000-000000000002', 'INV-PLAN-168', 'MAD', 1000, 200, 1200, current_date - 10, current_date - 1, '[]', repeat('b', 64), 'e1684000-0000-4000-8000-000000000002', 'f1684000-0000-4000-8000-000000000002', 'a1684000-0000-4000-8000-000000000002');
set local session_replication_role = origin;

select ok(
  private.provider_has_overdue_matricia_invoice('b1684000-0000-4000-8000-000000000001')
  and (select payment_status from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000001') = 'OVERDUE',
  'an unpaid past-due invoice is overdue before any credit or plan'
);

set local session_replication_role = replica;
insert into public.provider_credit_notes(id, provider_organization_id, invoice_id, credit_number, currency, subtotal_minor, tax_minor, total_minor, reason, issued_on, journal_id, document_hash, correlation_id, created_by)
values ('aa681000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000001', 'c1684000-0000-4000-8000-000000000001', 'AV-168-1', 'MAD', 1000, 200, 1200, 'Avoir integral de test 168', current_date - 1, 'e1684000-0000-4000-8000-000000000011', repeat('c', 64), 'f1684000-0000-4000-8000-000000000011', 'a1684000-0000-4000-8000-000000000001');
set local session_replication_role = origin;

select ok(
  not private.provider_has_overdue_matricia_invoice('b1684000-0000-4000-8000-000000000001')
  and (select payment_status from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000001') = 'PAID'
  and (select credited_minor from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000001') = 1200
  and (select outstanding_minor from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000001') = 0
  and (select total_minor from public.provider_invoices where id = 'c1684000-0000-4000-8000-000000000001') = 1200,
  'a credit note clears the hold by derivation without mutating the invoice total'
);

set local session_replication_role = replica;
insert into public.provider_payment_plans(id, provider_organization_id, invoice_id, reason, requested_by)
values ('aa682000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 'c1684000-0000-4000-8000-000000000002', 'Echeancier de test 168', 'a1684000-0000-4000-8000-000000000002');
insert into public.provider_payment_plan_decisions(id, plan_id, provider_organization_id, decision_version, status, reason, decided_by)
values
('aa683000-0000-4000-8000-000000000001', 'aa682000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 1, 'REQUESTED', 'Echeancier de test 168', 'a1684000-0000-4000-8000-000000000002'),
('aa684000-0000-4000-8000-000000000001', 'aa682000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 2, 'APPROVED', 'Approbation echeancier 168', 'a1684000-0000-4000-8000-000000000002');
set local session_replication_role = origin;

select ok(
  not private.provider_has_overdue_matricia_invoice('b1684000-0000-4000-8000-000000000002')
  and (select payment_status from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000002') = 'PAYMENT_PLAN'
  and (select outstanding_minor from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000002') = 1200
  and private.provider_payment_plan_status('aa682000-0000-4000-8000-000000000001') = 'APPROVED',
  'an approved payment plan lifts the overdue hold while the invoice stays open'
);

set local session_replication_role = replica;
insert into public.provider_collection_cases(id, provider_organization_id, invoice_id, reason, opened_by)
values ('aa685000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 'c1684000-0000-4000-8000-000000000002', 'Recouvrement de test 168', 'a1684000-0000-4000-8000-000000000002');
insert into public.provider_collection_case_decisions(id, case_id, provider_organization_id, decision_version, status, reason, decided_by)
values
('aa686000-0000-4000-8000-000000000001', 'aa685000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 1, 'OPEN', 'Recouvrement de test 168', 'a1684000-0000-4000-8000-000000000002'),
('aa687000-0000-4000-8000-000000000001', 'aa685000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 2, 'FORMAL_NOTICE', 'Mise en demeure test 168', 'a1684000-0000-4000-8000-000000000002');
insert into public.provider_payment_plan_decisions(id, plan_id, provider_organization_id, decision_version, status, reason, decided_by)
values ('aa688000-0000-4000-8000-000000000001', 'aa682000-0000-4000-8000-000000000001', 'b1684000-0000-4000-8000-000000000002', 3, 'DEFAULTED', 'Defaut echeancier test 168', 'a1684000-0000-4000-8000-000000000002');
set local session_replication_role = origin;

select ok(
  private.provider_collection_case_status('aa685000-0000-4000-8000-000000000001') = 'FORMAL_NOTICE'
  and private.provider_payment_plan_status('aa682000-0000-4000-8000-000000000001') = 'DEFAULTED'
  and (select payment_status from public.provider_invoice_balances where id = 'c1684000-0000-4000-8000-000000000002') = 'OVERDUE'
  and private.provider_has_overdue_matricia_invoice('b1684000-0000-4000-8000-000000000002'),
  'defaulting a plan restores OVERDUE without rewriting the invoice or the case header'
);

select is((select financial_status from public.provider_match_profiles where provider_organization_id = 'b1684000-0000-4000-8000-000000000001'), 'OK', 'credit notes never mutate financial_status');
select is((select count(*)::integer from public.provider_invoices where id in ('c1684000-0000-4000-8000-000000000001','c1684000-0000-4000-8000-000000000002')), 2, 'both invoices remain as originally issued');

select throws_ok(
  $$set local role authenticated; select set_config('request.jwt.claim.sub','a1684000-0000-4000-8000-000000000003',true); select set_config('request.jwt.claims','{"sub":"a1684000-0000-4000-8000-000000000003","role":"authenticated"}',true); select public.issue_provider_credit_note('c1684000-0000-4000-8000-000000000001','AV-X','2026-09-21',100,20,'Avoir refuse au locataire', 'k168-tenant');$$,
  '42501',
  'PROVIDER_CREDIT_NOTE_DENIED',
  'a tenant without a finance platform role cannot issue a credit note'
);

select * from finish();
rollback;
