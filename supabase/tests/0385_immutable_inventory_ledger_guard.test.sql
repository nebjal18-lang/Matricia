-- MAT-FUNC-027 — inventaire d'immutabilité : preuve atomique dédiée (extension de 0003).
begin;
set local search_path = public, extensions;
select plan(10);

-- Financial ledger (0003 pattern)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('38500000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mat-func-027-ledger@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations (id, legal_name, display_name, status, created_by)
values ('38510000-0000-4000-8000-000000000001','MF027 Ledger SARL','MF027 Ledger','ACTIVE','38500000-0000-4000-8000-000000000001');
insert into public.financial_accounts (id,organization_id,code,name,account_type) values
('38511000-0000-4000-8000-000000000001','38510000-0000-4000-8000-000000000001','CASH','Cash','ASSET'),
('38512000-0000-4000-8000-000000000002','38510000-0000-4000-8000-000000000001','REVENUE','Revenue','REVENUE');
insert into public.financial_journals (id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)
values ('38513000-0000-4000-8000-000000000003','38510000-0000-4000-8000-000000000001','TEST','MAD','mat-func-027.journal','mf027-key-journal','38514000-0000-4000-8000-000000000004',now(),'MF027 balanced journal','38500000-0000-4000-8000-000000000001');
insert into public.financial_entries (organization_id,journal_id,account_id,direction,amount_minor,currency) values
('38510000-0000-4000-8000-000000000001','38513000-0000-4000-8000-000000000003','38511000-0000-4000-8000-000000000001','DEBIT',10000,'MAD'),
('38510000-0000-4000-8000-000000000001','38513000-0000-4000-8000-000000000003','38512000-0000-4000-8000-000000000002','CREDIT',10000,'MAD');
set constraints financial_journal_balanced immediate;

select throws_ok($$update public.financial_entries set amount_minor=1 where journal_id='38513000-0000-4000-8000-000000000003'$$,'55000','IMMUTABLE_RECORD','financial entries reject UPDATE');
select throws_ok($$delete from public.financial_journals where id='38513000-0000-4000-8000-000000000003'$$,'55000','IMMUTABLE_RECORD','financial journals reject DELETE');

-- Credit ledger (0003 pattern)
insert into public.credit_wallets (id,organization_id,wallet_type) values ('38515000-0000-4000-8000-000000000005','38510000-0000-4000-8000-000000000001','CLIENT');
insert into public.credit_ledger_entries (organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)
values ('38510000-0000-4000-8000-000000000001','38515000-0000-4000-8000-000000000005','GRANT',10,'mat-func-027.credit','mf027-key-credit','38516000-0000-4000-8000-000000000006','TEST','1','38500000-0000-4000-8000-000000000001');
select throws_ok($$update public.credit_ledger_entries set quantity=20 where wallet_id='38515000-0000-4000-8000-000000000005'$$,'55000','IMMUTABLE_RECORD','credit entries reject UPDATE');
select throws_ok($$delete from public.credit_ledger_entries where wallet_id='38515000-0000-4000-8000-000000000005'$$,'55000','IMMUTABLE_RECORD','credit entries reject DELETE');

-- Audit chain (critical history inventory)
insert into public.audit_events (
  organization_id,actor_user_id,actor_type,action,resource_type,resource_id,
  correlation_id,occurred_at,request_ip,user_agent,metadata,previous_hash,event_hash
) values (
  '38510000-0000-4000-8000-000000000001','38500000-0000-4000-8000-000000000001','USER','mat-func-027.audit','immutable_inventory','mf027',
  '38517000-0000-4000-8000-000000000007','2026-09-11T10:00:00Z','192.0.2.50','mf027-test',jsonb_build_object('requirement','MAT-FUNC-027'),null,repeat('a',64)
);
select throws_ok($$update public.audit_events set metadata='{"tampered":true}' where correlation_id='38517000-0000-4000-8000-000000000007'$$,'55000','IMMUTABLE_RECORD','audit events reject UPDATE');
select throws_ok($$delete from public.audit_events where correlation_id='38517000-0000-4000-8000-000000000007'$$,'55000','IMMUTABLE_RECORD','audit events reject DELETE');

-- Immutability inventory: triggers registered on economic and versioned history tables
select ok((
  select count(*) >= 12
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and t.tgname like '%immutable%'
    and c.relname = any(array[
      'financial_entries','financial_journals','credit_ledger_entries','credit_wallets',
      'service_inventory_transactions','service_provider_consumptions',
      'contract_versions','delivery_versions','delivery_proofs','quote_comparison_snapshots',
      'catalog_library_versions','reward_grants'
    ])
),'critical-object immutability triggers are registered in the inventory');

select ok((
  select count(*) = 7
  from pg_trigger
  where not tgisinternal
    and tgname = any(array[
      'contract_versions_immutable','contract_parties_immutable','contract_items_immutable',
      'contract_signatures_immutable','amendments_immutable','delivery_versions_immutable','delivery_proofs_immutable'
    ])
),'contract and mission signed artifacts remain in the immutability inventory');

select ok((
  select count(*) >= 3
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('service_inventory_transactions','service_provider_consumptions','volume_rebate_accruals')
    and t.tgname like '%immutable%'
    and not t.tgisinternal
),'volume procurement ledger tables are guarded as immutable history');

select ok(not has_table_privilege('authenticated','public.financial_entries','UPDATE')
  and not has_table_privilege('authenticated','public.credit_ledger_entries','DELETE')
  and not has_table_privilege('authenticated','public.service_inventory_transactions','DELETE'),
  'authenticated cannot directly mutate ledger or inventory history rows');

select * from finish();
rollback;
