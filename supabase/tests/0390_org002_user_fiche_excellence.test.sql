begin;
set local search_path=public,extensions;
select plan(5);

select ok((
 select pg_get_functiondef(p.oid) like '%catalog_libraries%'
  and pg_get_functiondef(p.oid) like '%franchise_type%'
  and pg_get_functiondef(p.oid) like '%operator_code%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='list_admin_actor_directory_v1'
  and pg_get_function_identity_arguments(p.oid)='p_limit integer, p_offset integer, p_user_id uuid'
),'directory projects human library and franchise scope labels');

select ok((
 select pg_get_functiondef(p.oid) like '%hatim.ahmitech@%'
  and pg_get_functiondef(p.oid) like '%Ahmitech Franchise IT%'
  and pg_get_functiondef(p.oid) like '%FRANCHISE[_]%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='repair_org002_demo_personas_v1'
),'persona repair promotes Hatim/IT identity and franchise scopes');

update private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;
select throws_ok(
 $$select private.repair_org002_demo_personas_v1()$$,
 '42501',
 'ORG002_PERSONA_REPAIR_ENVIRONMENT_DENIED',
 'persona repair still refuses production'
);

update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
select lives_ok(
 $$select private.repair_org002_demo_personas_v1()$$,
 'persona repair runs in DEVELOPMENT after excellence upgrade'
);

select ok((
 select pg_get_functiondef(p.oid) like '%library_scopes%'
  and pg_get_functiondef(p.oid) like '%franchise_scopes%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='list_admin_actor_directory_v1'
),'scope fields remain present for ORG-002 membership perimeter');

select * from finish();
rollback;
