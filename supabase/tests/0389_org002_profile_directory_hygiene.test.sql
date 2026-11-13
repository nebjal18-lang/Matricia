begin;
set local search_path=public,extensions;
select plan(7);

select has_column('public','user_profiles','given_name','ORG-002 given_name exists on user_profiles');
select has_column('public','user_profiles','family_name','ORG-002 family_name exists on user_profiles');
select has_column('public','user_profiles','phone','ORG-002 phone exists on user_profiles');

select ok((
 select pg_get_functiondef(p.oid) like '%library_scopes%'
  and pg_get_functiondef(p.oid) like '%franchise_scopes%'
  and pg_get_functiondef(p.oid) like '%given_name%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='list_admin_actor_directory_v1'
  and pg_get_function_identity_arguments(p.oid)='p_limit integer, p_offset integer, p_user_id uuid'
),'directory exposes ORG-002 person fields and membership scopes');

select has_function('private','repair_org002_demo_personas_v1',array[]::text[],'persona repair helper exists');

update private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;
select throws_ok(
 $$select private.repair_org002_demo_personas_v1()$$,
 '42501',
 'ORG002_PERSONA_REPAIR_ENVIRONMENT_DENIED',
 'persona repair refuses production'
);

update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
select lives_ok(
 $$select private.repair_org002_demo_personas_v1()$$,
 'persona repair runs in DEVELOPMENT'
);

select * from finish();
rollback;
