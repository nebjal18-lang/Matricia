begin;
set local search_path=public,extensions;
select plan(10);

select ok(not exists(
  select 1 from unnest(array['anon','authenticated','service_role']) role_name,
    unnest(array['idempotency_keys','financial_accounts','financial_journals','financial_entries','credit_wallets','credit_ledger_entries']) table_name
  where has_table_privilege(role_name,'public.'||table_name,'TRUNCATE')
),'runtime roles cannot truncate immutable or idempotency tables');

select ok(not exists(
  select 1 from unnest(array['anon','authenticated','service_role']) role_name,
    unnest(array['financial_accounts','financial_journals','financial_entries','credit_wallets','credit_ledger_entries','audit_events','event_outbox']) table_name,
    unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name
  where has_table_privilege(role_name,'public.'||table_name,privilege_name)
),'runtime roles hold no mutation or DDL-like privilege on protected records');

select ok(not has_table_privilege('anon','public.organizations','SELECT'),'anonymous role has no organization table access');
select ok(has_table_privilege('authenticated','public.organizations','SELECT'),'authenticated reads organizations only through RLS');
select ok(has_column_privilege('authenticated','public.user_profiles','display_name','UPDATE'),'authenticated may update the explicitly allowed profile column');
select ok(not has_table_privilege('authenticated','public.user_profiles','UPDATE'),'authenticated has no whole-row profile update privilege');
select ok(not has_table_privilege('service_role','public.organization_audit_activity','SELECT'),'service role cannot query tenant audit view directly');

create temporary table readiness_acl_observed(before_ok boolean,after_ok boolean,event_id bigint);
grant select,insert,update on readiness_acl_observed to service_role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into readiness_acl_observed(before_ok) select database_ok and outbox_ok from public.readiness_status();
reset role;

with inserted as (
 insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,occurred_at,dead_lettered_at)
 values('acl_test','old-dead-letter','AclTestV1',extensions.gen_random_uuid(),'{}',statement_timestamp()-interval '30 days',statement_timestamp())returning id
)update readiness_acl_observed set event_id=(select id from inserted);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
update readiness_acl_observed set after_ok=(select database_ok and outbox_ok from public.readiness_status());
reset role;
select is((select after_ok from readiness_acl_observed),false,'a dead-lettered event degrades readiness even outside the pending-age window');
-- Model an authorized requeue, then use the real worker acknowledgement RPC.
-- The four-eyes authorization itself is exercised in 0183_delivery_integrations.
update public.event_outbox set dead_lettered_at=null,locked_by='f0120000-0000-4000-8000-000000000001',locked_at=clock_timestamp()
where id=(select event_id from readiness_acl_observed);
set local role service_role;
select public.mark_outbox_published((select event_id from readiness_acl_observed),'f0120000-0000-4000-8000-000000000001');
update readiness_acl_observed set after_ok=(select database_ok and outbox_ok from public.readiness_status());
reset role;
select ok((select published_at is not null and dead_lettered_at is null from public.event_outbox where id=(select event_id from readiness_acl_observed)),'recovered event has an actual worker acknowledgement');
select is((select after_ok from readiness_acl_observed),(select before_ok from readiness_acl_observed),'readiness recovers to its original state after resolving that DLQ');

select * from finish();
rollback;
