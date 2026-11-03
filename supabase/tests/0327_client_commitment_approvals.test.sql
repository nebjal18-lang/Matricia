begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
-- Synthetic identities and bound sessions, inside this rollback only.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select('a3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','client327-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)select('f3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'aal2',now(),now()from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3270000-0000-4000-8000-000000000001','TEST Client Approvals 327','TEST Client Approvals 327','ACTIVE','a3270000-0000-4000-8000-000000000001'),
('b3270000-0000-4000-8000-000000000002','TEST Foreign Approvals 327','TEST Foreign Approvals 327','ACTIVE','a3270000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)select('c3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3270000-0000-4000-8000-'||lpad(case when i=4 then 2 else 1 end::text,12,'0'))::uuid,('a3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()from generate_series(1,4)i;
insert into public.organization_member_roles(membership_id,role_code)select('c3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case i when 1 then 'CLIENT_OWNER'when 2 then'CLIENT_ADMIN'when 3 then'CLIENT_BUYER'else'CLIENT_OWNER'end from generate_series(1,4)i;
create temp table approval327(k text primary key,v jsonb);grant all on approval327 to authenticated;
create function pg_temp.actor327(i integer)returns void language plpgsql as $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub','a3270000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal','aal2','session_id','f3270000-0000-4000-8000-'||lpad(i::text,12,'0'))::text,true);end$$;
select ok(not has_function_privilege('authenticated','private.admit_client_commitment_v1(uuid,text,text,bigint,text,text,text,uuid)','execute'),'browser cannot supply its own authoritative approval facts');
select ok(not has_function_privilege('authenticated','private.select_quote_and_notify_pre_client_approval_v1(uuid,uuid,text,uuid,text,uuid)','execute'),'legacy quote selection cannot bypass approval gate');
select ok(not has_function_privilege('authenticated','private.record_client_typed_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)','execute'),'native typed allocation primitive cannot bypass gate');
select ok(not has_function_privilege('anon','public.propose_client_approval_policy_v1(uuid,text,integer,text[],bigint,text,bigint,timestamptz,text,text,uuid)','execute'),'policy proposal requires an authenticated actor');
select pg_temp.actor327(1);
set local role authenticated;
insert into approval327 values('policy',public.propose_client_approval_policy_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION',1,array['CLIENT_OWNER','CLIENT_ADMIN'],10000,'MAD',5000,now()-interval'1 minute','Synthetic independent approval policy test','client327-policy-propose'));
select throws_ok($$select public.activate_business_approval_policy((select(v->>'policy_version_id')::uuid from approval327 where k='policy'),(select v->>'content_hash'from approval327 where k='policy'),'client327-self-activate')$$,'42501','BUSINESS_APPROVAL_POLICY_ACTIVATION_DENIED','policy author cannot activate their own rule');
select pg_temp.actor327(2);
insert into approval327 values('activation',public.activate_business_approval_policy((select(v->>'policy_version_id')::uuid from approval327 where k='policy'),(select v->>'content_hash'from approval327 where k='policy'),'client327-other-activate'));
select is((select v->>'outcome'from approval327 where k='activation'),'BUSINESS_APPROVAL_POLICY_ACTIVATED','another authorized actor activates exact policy');
reset role;
select pg_temp.actor327(3);
-- Owner-only calls represent the internal boundary of the canonical commands,
-- not a public RPC. Their own actor/session/role checks remain active.
select is(private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','test-version',4000,'MAD',repeat('a',64),'client327-under-limit',extensions.gen_random_uuid())->>'outcome','CLIENT_APPROVAL_AUTHORIZED','Buyer stays within approved limit without a request');
insert into approval327 values('pending',private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','test-version',6000,'MAD',repeat('a',64),'client327-over-limit',extensions.gen_random_uuid()));
select is((select v->>'status'from approval327 where k='pending'),'PENDING','Buyer over own limit must wait even below general threshold');
select is((select count(*)::integer from public.business_approval_requests where organization_id='b3270000-0000-4000-8000-000000000001'),1,'admission creates one real persisted approval request');
set local role authenticated;
select throws_ok($$select public.decide_business_approval((select(v->>'approval_request_id')::uuid from approval327 where k='pending'),1,'APPROVE','Synthetic self decision','client327-self-decide')$$,'42501','BUSINESS_APPROVAL_DECISION_DENIED','requester cannot approve the commitment');
select pg_temp.actor327(2);
insert into approval327 values('approved',public.decide_business_approval((select(v->>'approval_request_id')::uuid from approval327 where k='pending'),1,'APPROVE','Synthetic independent approval','client327-approve'));
reset role;
select pg_temp.actor327(3);
select is(private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','test-version',6000,'MAD',repeat('a',64),'client327-over-limit',extensions.gen_random_uuid())->>'outcome','CLIENT_APPROVAL_AUTHORIZED','approved exact commitment can execute');
select ok((select consumed_at is not null from public.business_approval_requests where id=(select(v->>'approval_request_id')::uuid from approval327 where k='pending')),'authorization is consumed transactionally');
select is(private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','test-version',6000,'MAD',repeat('a',64),'client327-over-limit',extensions.gen_random_uuid())->>'outcome','CLIENT_APPROVAL_AUTHORIZED','same operation key can safely replay');
select is(private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','test-version-2',6000,'MAD',repeat('b',64),'client327-changed-version',extensions.gen_random_uuid())->>'status','PENDING','changed object/version never reuses earlier approval');
select throws_ok($$select private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000002','QUOTE_SELECTION','foreign-version',6000,'MAD',repeat('a',64),'client327-foreign',extensions.gen_random_uuid())$$,'42501','CLIENT_COMMITMENT_APPROVAL_DENIED','foreign organization is denied');
select throws_ok($$select private.admit_client_commitment_v1('b3270000-0000-4000-8000-000000000001','QUOTE_SELECTION','currency-version',6000,'EUR',repeat('c',64),'client327-wrong-currency',extensions.gen_random_uuid())$$,'55000','CLIENT_APPROVAL_CURRENCY_POLICY_REQUIRED','no implicit currency conversion bypasses limits');
select is((select count(*)::integer from public.audit_events where action='business.approval.consumed'and organization_id='b3270000-0000-4000-8000-000000000001'),1,'replay creates no second consumption audit event');
select *from finish();
rollback;
