begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('e0570000-0000-4000-8000-000000000001','authenticated','authenticated','prefill-runtime@example.invalid','{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)
select ('e0571000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'TEST prefill '||i,'TEST prefill '||i,'ACTIVE','e0570000-0000-4000-8000-000000000001' from generate_series(1,2)i;
insert into public.organization_memberships(id,organization_id,user_id,status)
values('e0572000-0000-4000-8000-000000000001','e0571000-0000-4000-8000-000000000001','e0570000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('e0572000-0000-4000-8000-000000000001','CLIENT_OWNER');
create temporary table prefill_results(k text primary key,v jsonb);
grant select,insert on prefill_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0570000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into prefill_results values('first',public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.readiness','ORGANIZATION',null,'1','BUSINESS',transaction_timestamp(),'prefill-runtime-one','e0573000-0000-4000-8000-000000000001'));
select lives_ok($$insert into prefill_results values('replay',public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.readiness','ORGANIZATION',null,'1','BUSINESS',transaction_timestamp(),'prefill-runtime-one','e0573000-0000-4000-8000-000000000001'))$$,'retry of the same fact command succeeds');
select is((select v from prefill_results where k='replay'),(select v from prefill_results where k='first'),'retry returns the exact original fact receipt');
select throws_ok($$select public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.readiness','ORGANIZATION',null,'0','BUSINESS',transaction_timestamp(),'prefill-runtime-one','e0573000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same key with another value is denied');
select throws_ok($$select public.record_prefill_fact('e0571000-0000-4000-8000-000000000002','test.readiness','ORGANIZATION',null,'1','BUSINESS',transaction_timestamp(),'prefill-runtime-foreign','e0573000-0000-4000-8000-000000000002')$$,'42501','PREFILL_FACT_DENIED','foreign organization cannot receive a fact');
reset role;
select is((select count(*)::integer from public.prefill_fact_versions where organization_id='e0571000-0000-4000-8000-000000000001'),1,'retry and rejected payload create no additional history');
select is((select count(*)::integer from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.organization_id='e0571000-0000-4000-8000-000000000001' and a.action='prefill.fact.version_recorded' and e.event_type='PrefillFactVersionRecordedV1'),1,'one correlated audit/outbox pair exists');
set local role authenticated;
select lives_ok($$insert into prefill_results values('second',public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.readiness','ORGANIZATION',null,'0','BUSINESS',transaction_timestamp(),'prefill-runtime-two','e0573000-0000-4000-8000-000000000002'))$$,'a new command records a changed fact');
reset role;
select is((select supersedes_id from public.prefill_fact_versions where id=(select(v->>'fact_version_id')::uuid from prefill_results where k='second')),(select(v->>'fact_version_id')::uuid from prefill_results where k='first'),'new versions retain the previous fact link');
select throws_ok($$update public.prefill_fact_versions set value='9' where organization_id='e0571000-0000-4000-8000-000000000001'$$,'55000','PREFILL_HISTORY_IMMUTABLE','historical fact values cannot be rewritten');
-- A pre-migration receipt had only immutable fact/outbox evidence. Seed that
-- historical shape directly without modifying any existing command history.
insert into public.prefill_fact_versions(id,organization_id,data_key,source_type,value,sensitivity,observed_at,fresh_until,content_hash,created_by)
select 'e0574000-0000-4000-8000-000000000001','e0571000-0000-4000-8000-000000000001','test.legacy','ORGANIZATION','1','BUSINESS',transaction_timestamp(),transaction_timestamp()+make_interval(days=>max_age_days),private.canonical_request_hash(jsonb_build_object('org','e0571000-0000-4000-8000-000000000001'::uuid,'key','test.legacy','source','ORGANIZATION','reference',null,'value','1'::jsonb,'sensitivity','BUSINESS','observed',transaction_timestamp(),'policy',id)),'e0570000-0000-4000-8000-000000000001' from public.prefill_policy_versions where source_type='ORGANIZATION' and status='ACTIVE' order by version desc limit 1;
insert into prefill_results
select 'legacy',jsonb_build_object('outcome','PREFILL_FACT_VERSION_RECORDED','fact_version_id','e0574000-0000-4000-8000-000000000001'::uuid,'fresh_until',transaction_timestamp()+make_interval(days=>max_age_days),'policy_version_id',id) from public.prefill_policy_versions where source_type='ORGANIZATION' and status='ACTIVE' order by version desc limit 1;
insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
select 'e0571000-0000-4000-8000-000000000001','prefill_fact','e0574000-0000-4000-8000-000000000001','PrefillFactVersionRecordedV1','e0573000-0000-4000-8000-000000000003',v,'prefill-runtime-legacy' from prefill_results where k='legacy';
set local role authenticated;
select is(public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.legacy','ORGANIZATION',null,'1','BUSINESS',transaction_timestamp(),'prefill-runtime-legacy','e0573000-0000-4000-8000-000000000003'),(select v from prefill_results where k='legacy'),'unique historical outbox receipt is replayed exactly');
select throws_ok($$select public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.legacy','ORGANIZATION',null,'0','BUSINESS',transaction_timestamp(),'prefill-runtime-legacy','e0573000-0000-4000-8000-000000000003')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','historical receipt cannot be reused with another value');
reset role;
select is((select count(*)::integer from public.prefill_fact_versions where data_key='test.legacy' and organization_id='e0571000-0000-4000-8000-000000000001'),1,'historical replay creates no additional fact');
insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)
select 'e0571000-0000-4000-8000-000000000001','prefill_fact','e0574000-0000-4000-8000-000000000001','PrefillFactVersionRecordedV1',extensions.gen_random_uuid(),v,'prefill-runtime-ambiguous' from prefill_results cross join generate_series(1,2) where k='legacy';
set local role authenticated;
select throws_ok($$select public.record_prefill_fact('e0571000-0000-4000-8000-000000000001','test.legacy','ORGANIZATION',null,'1','BUSINESS',transaction_timestamp(),'prefill-runtime-ambiguous','e0573000-0000-4000-8000-000000000003')$$,'55000','PREFILL_LEGACY_COMMAND_AMBIGUOUS','ambiguous old duplicate receipts fail closed');
reset role;
select * from finish();
rollback;
