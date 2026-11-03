begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-scan-fixture-0210',configured_at=clock_timestamp()where singleton;

set local search_path=public,private,extensions;
select plan(13);
-- Independent validation and exact settlement are exercised natively in0347.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
 ('f2100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','durable-owner@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','durable-accounting@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('f2101000-0000-4000-8000-000000000001','Durable Payment Test','Durable Payment Test','ACTIVE','f2100000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
 ('f2102000-0000-4000-8000-000000000001','f2101000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f2102000-0000-4000-8000-000000000002','f2101000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('f2102000-0000-4000-8000-000000000001','PROVIDER_OWNER'),('f2102000-0000-4000-8000-000000000002','PROVIDER_ACCOUNTING');
insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values
 ('f2103000-0000-4000-8000-000000000001','f2101000-0000-4000-8000-000000000001','DURABLE_CASH','Test cash','ASSET','MAD'),
 ('f2103000-0000-4000-8000-000000000002','f2101000-0000-4000-8000-000000000001','DURABLE_RECEIVABLE','Test receivable','ASSET','MAD');
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
create temporary table durable_observed(key text primary key,value jsonb);grant select,insert on durable_observed to authenticated;
insert into durable_observed values('upload',public.begin_provider_payment_proof_upload('f2101000-0000-4000-8000-000000000001','test.pdf','application/pdf',20,repeat('d',64),'durable-proof-test'));
insert into storage.objects(bucket_id,name,metadata)select 'provider-qualification',value->>'storage_object_path','{"mimetype":"application/pdf","size":20}'from durable_observed where key='upload';
insert into durable_observed values('payload','{"organizationId":"f2101000-0000-4000-8000-000000000001","paymentReference":"DURABLE-1","paidOn":"2026-10-31","paymentMethod":"BANK_TRANSFER","currency":"MAD","amountMinor":"125050","cashAccountId":"f2103000-0000-4000-8000-000000000001","receivableAccountId":"f2103000-0000-4000-8000-000000000002"}'::jsonb||jsonb_build_object('proofHash',repeat('d',64)));
insert into durable_observed select 'intent',public.save_my_provider_billing_intent('f2101000-0000-4000-8000-000000000001','PAYMENT',value,'f2104000-0000-4000-8000-000000000001')from durable_observed where key='payload';
select is((select public.save_my_provider_billing_intent('f2101000-0000-4000-8000-000000000001','PAYMENT',value,'f2104000-0000-4000-8000-000000000001')from durable_observed where key='payload'),(select value from durable_observed where key='intent'),'replaying a saved financial intent returns the same durable identity');
select is((select public.finalize_my_provider_billing_intent((value->>'intent_id')::uuid)->>'outcome'from durable_observed where key='intent'),'PROVIDER_BILLING_SCAN_PENDING','new file does not move money while scan is pending');
select is((select count(*)from public.provider_payments where provider_organization_id='f2101000-0000-4000-8000-000000000001'),0::bigint,'no financial payment before CLEAN');
select is((public.list_my_provider_billing_intents('f2101000-0000-4000-8000-000000000001')->0->>'id'),(select value->>'intent_id'from durable_observed where key='intent'),'a fresh request recovers the saved intent without a browser actionstate');
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.finalize_my_provider_billing_intent((value->>'intent_id')::uuid)from durable_observed where key='intent'$$,'42501','PROVIDER_BILLING_INTENT_DENIED','another accountant cannot resume the original actor proof');
set local role authenticated;
insert into durable_observed select 'rls_count',to_jsonb(count(*))from public.provider_billing_intents where provider_organization_id='f2101000-0000-4000-8000-000000000001';
reset role;
select is((select value::text::bigint from durable_observed where key='rls_count'),0::bigint,'RLS hides the other actor private financial drafts');
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.save_my_provider_billing_intent('f2101000-0000-4000-8000-000000000001','PAYMENT',value||'{"amountMinor":"1"}'::jsonb,'f2104000-0000-4000-8000-000000000001')from durable_observed where key='payload'$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same key cannot be reused for a different amount');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_provider_payment_proof_scan_result((value->>'upload_id')::uuid,'CLEAN','SQL_TEST_SCANNER','test-only',repeat('d',64),'durable-proof-clean')from durable_observed where key='upload';
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into durable_observed select 'recorded',public.finalize_my_provider_billing_intent((value->>'intent_id')::uuid)from durable_observed where key='intent';
select is((select value->>'outcome'from durable_observed where key='recorded'),'PROVIDER_FINANCIAL_DECLARATION_SUBMITTED','trusted CLEAN finalizes a durable declaration awaiting independent Finance');
select is((select public.finalize_my_provider_billing_intent((value->>'intent_id')::uuid)from durable_observed where key='intent'),(select value from durable_observed where key='recorded'),'double click returns the archived financial result');
select is((select count(*)from public.financial_entries where organization_id='f2101000-0000-4000-8000-000000000001'),0::bigint,'a scanned declaration creates no cash journal before independent review');
select is((select count(*)from public.provider_financial_declarations_v1 where provider_organization_id='f2101000-0000-4000-8000-000000000001'),1::bigint,'one immutable declaration survives a finalization replay');
select throws_ok($$select public.cancel_my_provider_billing_intent((value->>'intent_id')::uuid)from durable_observed where key='intent'$$,'55000','RECORDED_BILLING_INTENT_IMMUTABLE','a completed payment cannot be cancelled through draft cancellation');
select is(public.list_my_provider_billing_intents('f2101000-0000-4000-8000-000000000001'),'[]'::jsonb,'completed intent no longer appears in the refresh recovery list');
set constraints all immediate;
select * from finish();
rollback;
