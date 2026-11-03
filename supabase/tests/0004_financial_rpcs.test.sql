begin;
set local search_path = public, extensions;
select plan(18);
grant usage on schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST-004-MANUAL-CREDITS',configured_at=clock_timestamp()where singleton;

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finance@example.invalid','',now(),'{}','{}',now(),now()),
('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@example.invalid','',now(),'{}','{}',now(),now()),
('60000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finance-review004@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations (id,legal_name,display_name,status,created_by)
values ('d0000000-0000-0000-0000-000000000004','Finance SARL','Finance','ACTIVE','40000000-0000-0000-0000-000000000004');
insert into public.organization_memberships (id,organization_id,user_id,status,activated_at)
values ('d1000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004','ACTIVE',now());
insert into public.organization_member_roles (membership_id,role_code)
values ('d1000000-0000-0000-0000-000000000001','CLIENT_ACCOUNTING');
insert into public.platform_user_roles (user_id,role_code)
values ('40000000-0000-0000-0000-000000000004','SUPER_ADMIN'),('60000000-0000-4000-8000-000000000006','FINANCE_MANAGER');
insert into public.financial_accounts (id,organization_id,code,name,account_type) values
('d2000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000004','CASH','Cash','ASSET'),
('d3000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004','REVENUE','Revenue','REVENUE');
insert into public.credit_wallets (id,organization_id,wallet_type)
values ('d4000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000004','CLIENT');

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',true);
select public.post_financial_journal(
  'd0000000-0000-0000-0000-000000000004','journal-key-0001',null,'SALE','MAD',now(),'RPC test',
  jsonb_build_array(
    jsonb_build_object('account_id','d2000000-0000-0000-0000-000000000002','direction','DEBIT','amount_minor',12500),
    jsonb_build_object('account_id','d3000000-0000-0000-0000-000000000003','direction','CREDIT','amount_minor',12500)
  ),'d5000000-0000-0000-0000-000000000005'
);
select public.post_financial_journal(
  'd0000000-0000-0000-0000-000000000004','journal-key-0001',null,'SALE','MAD',now(),'RPC test',
  jsonb_build_array(
    jsonb_build_object('account_id','d2000000-0000-0000-0000-000000000002','direction','DEBIT','amount_minor',12500),
    jsonb_build_object('account_id','d3000000-0000-0000-0000-000000000003','direction','CREDIT','amount_minor',12500)
  ),'d5000000-0000-0000-0000-000000000005'
);
reset role;
select lives_ok($$select public.post_financial_journal(
  'd0000000-0000-0000-0000-000000000004','journal-key-0001',null,'SALE','MAD',now(),'RPC test',
  jsonb_build_array(
    jsonb_build_object('account_id','d3000000-0000-0000-0000-000000000003','direction','CREDIT','amount_minor',12500),
    jsonb_build_object('account_id','d2000000-0000-0000-0000-000000000002','direction','DEBIT','amount_minor',12500)
  ),'d5000000-0000-0000-0000-000000000005')$$,'reordering entries preserves the server-canonical journal identity');
select throws_ok($$select public.post_financial_journal(
  'd0000000-0000-0000-0000-000000000004','journal-key-0002',repeat('a',64),'SALE','MAD',now(),'RPC test',
  '[{"account_id":"d2000000-0000-0000-0000-000000000002","direction":"DEBIT","amount_minor":12500},{"account_id":"d3000000-0000-0000-0000-000000000003","direction":"CREDIT","amount_minor":12500}]')$$,
  '22000','CLIENT_REQUEST_HASH_MISMATCH','a forged client hash cannot replace the server-canonical payload');
select throws_ok($$select public.post_financial_journal(
  'd0000000-0000-0000-0000-000000000004',null,null,'SALE','MAD',now(),'RPC test','[]')$$,
  '22023','INVALID_IDEMPOTENCY','a missing idempotency key is rejected before writing');
set local role authenticated;
reset role;
create temporary table manual004(k text primary key,v jsonb);grant all on manual004 to authenticated;
set local role authenticated;
insert into manual004 values('request',public.request_manual_credit_grant_v1('d0000000-0000-0000-0000-000000000004','d4000000-0000-0000-0000-000000000004','ADMIN_GRANT',25,'2030-01-01T00:00:00Z',null,'credit-1','TEST004 reviewed synthetic administrative gift','credit-key-0001'));
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}',true);
insert into manual004 values('review',public.review_manual_credit_grant_v1((select(v->>'request_id')::uuid from manual004 where k='request'),(select v->>'content_hash'from manual004 where k='request'),true,true,'TEST004-GIFT-APPROVAL','TEST004 independent review of exact terms'));
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}',true);
select public.execute_manual_credit_grant_v1((select(v->>'request_id')::uuid from manual004 where k='request'),(select v->>'content_hash'from manual004 where k='request'),(select v->>'review_proof_hash'from manual004 where k='review'),'TEST004-credit-execute-1');
select public.execute_manual_credit_grant_v1((select(v->>'request_id')::uuid from manual004 where k='request'),(select v->>'content_hash'from manual004 where k='request'),(select v->>'review_proof_hash'from manual004 where k='review'),'TEST004-credit-execute-2');
reset role;
select throws_ok(
  $$select public.post_financial_journal(
    'd0000000-0000-0000-0000-000000000004','journal-key-0001',null,'SALE','MAD',now(),'RPC test',
    jsonb_build_array(
      jsonb_build_object('account_id','d2000000-0000-0000-0000-000000000002','direction','DEBIT','amount_minor',15000),
      jsonb_build_object('account_id','d3000000-0000-0000-0000-000000000003','direction','CREDIT','amount_minor',15000)
    ),'d5000000-0000-0000-0000-000000000005'
  )$$,
  '22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same journal key with a different server-canonical payload is rejected'
);
select throws_ok(
  $$select public.request_manual_credit_grant_v1('d0000000-0000-0000-0000-000000000004','d4000000-0000-0000-0000-000000000004','ADMIN_GRANT',30,'2030-01-01T00:00:00Z',null,'credit-1','TEST004 reviewed synthetic administrative gift','credit-key-0001')$$,
  '22023','IDEMPOTENCY_KEY_REUSED','same credit request key cannot authorize a changed quantity'
);
select ok(not has_function_privilege('authenticated','public.append_credit_entry(uuid,uuid,text,bigint,text,text,text,text,uuid)','EXECUTE'),'the generic credit append command is not exposed to clients');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.issue_credits('d0000000-0000-0000-0000-000000000004','d4000000-0000-0000-0000-000000000004','ADMIN_GRANT',1,'2030-01-01T00:00:00Z',null,'forbidden',0,'P03_TEST','P03_APPROVAL','credit-key-0002','d7000000-0000-0000-0000-000000000007')$$,
  '42501','CREDIT_ISSUE_DENIED','an outsider cannot issue tenant credits'
);
select ok(not has_table_privilege('authenticated','public.credit_ledger_entries','INSERT'),'authenticated users cannot write a ledger directly');

select ok((select request_hash ~ '^[0-9a-f]{64}$' from public.idempotency_keys where organization_id='d0000000-0000-0000-0000-000000000004' and operation_scope='finance.post_journal' and key='journal-key-0001'),'server-derived hash is persisted even when the client omitted it');
select is((select idempotency_key from public.event_outbox where organization_id='d0000000-0000-0000-0000-000000000004' and event_type='FinancialJournalPostedV1'),'journal-key-0001','canonical hashing preserves the newer outbox idempotency key');
select is((select count(*) from public.financial_journals where organization_id='d0000000-0000-0000-0000-000000000004'),1::bigint,'journal command is idempotent');
select is((select count(*) from public.financial_entries where organization_id='d0000000-0000-0000-0000-000000000004'),2::bigint,'journal writes exactly two entries');
select is((select count(*) from public.credit_ledger_entries where organization_id='d0000000-0000-0000-0000-000000000004'),1::bigint,'credit command is idempotent');
select is((select balance from public.credit_wallet_balances where wallet_id='d4000000-0000-0000-0000-000000000004'),25::bigint,'credit balance is exact');
select is((select count(*) from public.audit_events where organization_id='d0000000-0000-0000-0000-000000000004'),5::bigint,'journal and governed credit request/review/execution each preserve their audit evidence');
select is((select count(*) from public.event_outbox where organization_id='d0000000-0000-0000-0000-000000000004'),5::bigint,'journal and governed credit request/review/execution each preserve their Outbox facts');
select ok((select bool_and(event_hash ~ '^[0-9a-f]{64}$') from public.audit_events where organization_id='d0000000-0000-0000-0000-000000000004'),'audit hashes are SHA-256 hex');
select ok((select bool_and(previous_hash is not distinct from preceding_hash)from(select previous_hash,lag(event_hash)over(order by id)preceding_hash,row_number()over(order by id)position from public.audit_events where organization_id='d0000000-0000-0000-0000-000000000004')chain where position>1),'every audit event links to its immediate predecessor across the complete governed workflow');

select * from finish();
rollback;
