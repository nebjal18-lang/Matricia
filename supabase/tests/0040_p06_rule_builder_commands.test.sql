begin;
set local search_path=public,extensions;
select plan(16);

select ok((select count(*)=2 and bool_and(p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_catalog_rule','save_catalog_rule_draft')),'Rule Builder RPCs are security definer with fixed paths');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_catalog_rule','save_catalog_rule_draft') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))),'anon and service_role cannot execute Rule Builder commands');
select ok((select count(*)=2 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_catalog_rule','save_catalog_rule_draft')),'authenticated receives explicit Rule Builder execution');
select ok(not has_table_privilege('authenticated','public.question_rules','INSERT') and not has_table_privilege('authenticated','public.question_rule_versions','INSERT'),'direct rule writes remain unavailable');
select throws_ok($$select private.assert_rule_builder_payload('{"condition_ast":{},"actions":[],"dependency_graph":{},"priority":1,"sensitive":false}'::jsonb)$$,'22023'::char(5),'INVALID_CATALOG_RULE','empty AST and actions fail closed');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f6100000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-rule-admin@example.invalid','',now(),'{}','{}',now(),now()),
('f6100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-rule-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code) values('f6100000-0000-0000-0000-000000000001','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by) values('f6110000-0000-0000-0000-000000000001','P06 Rule Steward','P06 Rule Steward','ACTIVE','f6100000-0000-0000-0000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by) values('f6120000-0000-0000-0000-000000000001','P06_RULE','p06-rule','f6110000-0000-0000-0000-000000000001','DRAFT','f6100000-0000-0000-0000-000000000001');
create temporary table p06_rule_payload(value jsonb);create temporary table p06_rule_observed(key text primary key,value jsonb);
insert into p06_rule_payload values('{"condition_ast":{"kind":"PREDICATE","operator":"EQ","questionKey":"HAS_POLICY","operand":false},"actions":[{"type":"CREATE_ANOMALY","target":"POLICY_MISSING"}],"dependency_graph":{"HAS_POLICY":["POLICY_NO"]},"priority":10,"sensitive":false}'::jsonb);
grant select on p06_rule_payload to authenticated;grant select,insert on p06_rule_observed to authenticated;grant usage on schema extensions to authenticated;

set local role authenticated;select set_config('request.jwt.claims','{"sub":"f6100000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.create_catalog_rule('f6120000-0000-0000-0000-000000000001','P06_HIDDEN',(select value from p06_rule_payload),'Création refusée','rule-hidden')$$,'42501'::char(5),'CATALOG_SCOPE_DENIED','authorization precedes payload persistence');
select set_config('request.jwt.claims','{"sub":"f6100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p06_rule_observed values('created',public.create_catalog_rule('f6120000-0000-0000-0000-000000000001','P06_POLICY_MISSING',(select value from p06_rule_payload),'Création règle Builder','rule-create-0001','f6160000-0000-0000-0000-000000000001'));
insert into p06_rule_observed values('replay',public.create_catalog_rule('f6120000-0000-0000-0000-000000000001','P06_POLICY_MISSING',(select value from p06_rule_payload),'Création règle Builder','rule-create-0001','f6160000-0000-0000-0000-000000000099'));
reset role;
select is((select value from p06_rule_observed where key='created'),(select value from p06_rule_observed where key='replay'),'create replay returns the durable response');
select is((select value->>'outcome' from p06_rule_observed where key='created'),'CATALOG_RULE_CREATED','create returns its typed outcome');
select ok((select r.status='DRAFT' and r.current_draft_version_id=(select(value->>'version_id')::uuid from p06_rule_observed where key='created') from public.question_rules r where r.id=(select(value->>'rule_id')::uuid from p06_rule_observed where key='created')),'identity points to immutable draft one');
select matches((select compiled_hash from public.question_rule_versions where id=(select(value->>'version_id')::uuid from p06_rule_observed where key='created')),'^[0-9a-f]{64}$','server computes a canonical compiled hash');
select ok((select count(*)=1 from public.audit_events where action='catalog.rule.created' and resource_id=(select value->>'rule_id' from p06_rule_observed where key='created')) and (select count(*)=1 from public.event_outbox where event_type='CatalogRuleCreatedV1' and aggregate_id=(select value->>'rule_id' from p06_rule_observed where key='created')),'create emits one audit and one safe Outbox event');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"f6100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p06_rule_observed values('saved',public.save_catalog_rule_draft((select(value->>'rule_id')::uuid from p06_rule_observed where key='created'),(select(value->>'version_id')::uuid from p06_rule_observed where key='created'),(select value||'{"priority":20}'::jsonb from p06_rule_payload),'Révision de priorité',1,1,'rule-save-0001'));
reset role;
select is((select value->>'version_number' from p06_rule_observed where key='saved'),'2','save creates immutable version two');
select ok((select row_version=2 and current_draft_version_id=(select(value->>'version_id')::uuid from p06_rule_observed where key='saved') from public.question_rules where id=(select(value->>'rule_id')::uuid from p06_rule_observed where key='created')),'save advances optimistic identity pointer');
select is((select priority from public.question_rule_versions where id=(select(value->>'version_id')::uuid from p06_rule_observed where key='saved')),20,'save persists revised priority without mutating version one');
select is((select priority from public.question_rule_versions where id=(select(value->>'version_id')::uuid from p06_rule_observed where key='created')),10,'version one remains immutable');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"f6100000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.create_catalog_rule('f6120000-0000-0000-0000-000000000001','P06_SENSITIVE',(select value||'{"sensitive":true}'::jsonb from p06_rule_payload),'Règle sensible','rule-sensitive-0001')$$,'42501'::char(5),'CATALOG_SCOPE_DENIED','sensitive rule authoring requires AAL2');
reset role;

select * from finish();
rollback;
