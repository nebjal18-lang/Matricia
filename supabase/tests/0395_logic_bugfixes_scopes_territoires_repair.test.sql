begin;
set local search_path=public,extensions;
select plan(6);

select ok((
 select pg_get_functiondef(p.oid) like '%current_published_version_id%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='get_admin_territoires_queue_snapshot_v1'
),'territoires queue prefers published library version');

select ok((
 select pg_get_functiondef(p.oid) like '%current_published_version_id%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='get_admin_franchises_queue_snapshot_v1'
),'franchises queue prefers published library version');

select ok((
 select pg_get_functiondef(p.oid) like '%current_published_version_id%'
  and pg_get_functiondef(p.oid) like '%PUBLISHED%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='franchise_governance_dashboard_snapshot'
),'governance snapshot exposes published library metadata');

select ok((
 select pg_get_functiondef(p.oid) like '%hatim.ahmitech@matricia.test%'
  and pg_get_functiondef(p.oid) not like '%epitaphemarket@gmail.com%'
  and pg_get_functiondef(p.oid) not like '%hatim.ahmitech@\%%'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='repair_org002_demo_personas_v1'
),'persona repair no longer uses broad personal or open-ended Hatim patterns');

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
 'persona repair runs in DEVELOPMENT after tightening'
);

select * from finish();
rollback;
