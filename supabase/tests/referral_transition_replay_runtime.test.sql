begin;
set local search_path=public,extensions;
select plan(19);

select ok((select pg_get_functiondef(p.oid)not like'%REFERRAL_CONVERSION_NOT_FOUND%'and pg_get_functiondef(p.oid)like'%REFERRAL_REQUEST_DENIED%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='advance_referral_conversion'),'conversion transition exposes no not-found oracle');
select ok((select pg_get_functiondef(p.oid)like'%private.has_org_role%'and pg_get_functiondef(p.oid)like'%private.has_platform_role%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='advance_referral_conversion'),'conversion lookup is authority-scoped');
select ok((select p.prosecdef and p.proconfig::text like'%search_path=pg_catalog%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='advance_referral_conversion'),'transition RPC keeps hardened security-definer search path');
select ok(not has_function_privilege('anon','public.advance_referral_conversion(uuid,text,jsonb,text,integer,text,uuid)','EXECUTE')and has_function_privilege('authenticated','public.advance_referral_conversion(uuid,text,jsonb,text,integer,text,uuid)','EXECUTE'),'transition RPC remains authenticated-only');
select ok((select pg_get_functiondef(p.oid)like'%begin_rewards_command%'and pg_get_functiondef(p.oid)like'%audit_events%'and pg_get_functiondef(p.oid)like'%event_outbox%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='advance_referral_conversion'),'authorized transition preserves idempotence audit and Outbox');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
 ('a7300000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','anti-oracle-member@example.invalid','',now(),'{}','{}',now(),now()),
 ('a7300000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','anti-oracle-other@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
 ('b7300000-0000-4000-8000-000000000001','Referral Source 73','Referral Source 73','ACTIVE','a7300000-0000-4000-8000-000000000001'),
 ('b7300000-0000-4000-8000-000000000002','Referral Target 73','Referral Target 73','ACTIVE','a7300000-0000-4000-8000-000000000001'),
 ('b7300000-0000-4000-8000-000000000003','Foreign Target 73','Foreign Target 73','ACTIVE','a7300000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
 ('c7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000002','a7300000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('c7300000-0000-4000-8000-000000000002','b7300000-0000-4000-8000-000000000003','a7300000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
 ('c7300000-0000-4000-8000-000000000001','CLIENT_OWNER'),
 ('c7300000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.referral_links(id,source_organization_id,referral_code,audience_type,campaign_reference,status,expires_at,max_conversions,created_by,correlation_id)values
 ('d7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000001','ORACLE73','CLIENT','ORACLE_TEST','ACTIVE',clock_timestamp()+interval'30 days',10,'a7300000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000001');
insert into public.referral_conversions(id,referral_link_id,source_organization_id,target_organization_id,audience_type,conversion_stage,origin_snapshot,registered_by,row_version)values
 ('d7300000-0000-4000-8000-000000000002','d7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000002','CLIENT','REGISTERED','{}','a7300000-0000-4000-8000-000000000001',1),
 ('d7300000-0000-4000-8000-000000000003','d7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000001','b7300000-0000-4000-8000-000000000003','CLIENT','REGISTERED','{}','a7300000-0000-4000-8000-000000000002',1);
create temporary table p21_observed(k text primary key,v jsonb);
grant select,insert on p21_observed to authenticated;

select set_config('request.jwt.claim.sub','a7300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a7300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok($$set local role authenticated;select public.advance_referral_conversion('d7300000-0000-4000-8000-000000000099','PROFILE_STARTED','["profile:73"]',repeat('1',64),1,'missing-73')$$,'42501'::char(5),'REFERRAL_REQUEST_DENIED','missing conversion is uniformly denied');
select extensions.throws_ok($$set local role authenticated;select public.advance_referral_conversion('d7300000-0000-4000-8000-000000000003','PROFILE_STARTED','["profile:73"]',repeat('1',64),1,'foreign-73')$$,'42501'::char(5),'REFERRAL_REQUEST_DENIED','foreign conversion is identically denied');
set local role authenticated;
insert into p21_observed values('happy',public.advance_referral_conversion('d7300000-0000-4000-8000-000000000002','PROFILE_STARTED','["profile:73"]',repeat('2',64),1,'happy-73'));
reset role;

select is((select v->>'outcome'from p21_observed where k='happy'),'REFERRAL_STAGE_ADVANCED','authorized target transition remains functional');
select is((select conversion_stage from public.referral_conversions where id='d7300000-0000-4000-8000-000000000002'),'PROFILE_STARTED','authorized conversion advances exactly one stage');
select is((select conversion_stage from public.referral_conversions where id='d7300000-0000-4000-8000-000000000003'),'REGISTERED','foreign conversion remains unchanged');
select is((select count(*)from public.audit_events where action='referral.conversion.advanced'and resource_id='d7300000-0000-4000-8000-000000000002'),1::bigint,'successful transition is audited once');
select is((select count(*)from public.event_outbox where aggregate_type='referral_conversion'and aggregate_id='d7300000-0000-4000-8000-000000000002'),1::bigint,'successful transition emits one Outbox event');

select lives_ok($$set local role authenticated;insert into p21_observed values('replay',public.advance_referral_conversion('d7300000-0000-4000-8000-000000000002','PROFILE_STARTED','["profile:73"]',repeat('2',64),1,'happy-73'));reset role$$,'completed transition replays after its state changed');
reset role;
select is((select v from p21_observed where k='replay'),(select v from p21_observed where k='happy'),'replay returns the original immutable response');
select throws_ok($$set local role authenticated;select public.advance_referral_conversion('d7300000-0000-4000-8000-000000000002','PROFILE_STARTED','["changed:73"]',repeat('2',64),1,'happy-73')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed evidence cannot reuse a completed key');
select throws_ok($$set local role authenticated;select public.advance_referral_conversion('d7300000-0000-4000-8000-000000000002','PROFILE_STARTED','["profile:73"]',repeat('2',64),1,'different-73')$$,'55000','INVALID_REFERRAL_TRANSITION','a new command cannot replay an obsolete transition');
reset role;
select set_config('request.jwt.claim.sub','a7300000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a7300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$set local role authenticated;select public.advance_referral_conversion('d7300000-0000-4000-8000-000000000002','PROFILE_STARTED','["profile:73"]',repeat('2',64),1,'happy-73')$$,'42501','REFERRAL_REQUEST_DENIED','an outsider cannot replay a completed command');
reset role;
select is((select count(*) from public.referral_conversion_events where referral_conversion_id='d7300000-0000-4000-8000-000000000002'),1::bigint,'replay and denied requests create no additional history');
select is((select row_version from public.referral_conversions where id='d7300000-0000-4000-8000-000000000002'),2,'replay advances no additional version');
select * from finish();
rollback;
