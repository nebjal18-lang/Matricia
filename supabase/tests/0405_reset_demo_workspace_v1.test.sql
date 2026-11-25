begin;
select plan(3);

select has_function(
  'public',
  'reset_demo_workspace_v1',
  array[]::text[],
  'reset_demo_workspace_v1 exists'
);

select has_table(
  'private',
  'demo_workspace_organizations_v1',
  'demo workspace org registry exists'
);

update private.admin_execution_environment_v1 set environment = 'PRODUCTION' where singleton;

select throws_ok(
  $$select public.reset_demo_workspace_v1()$$,
  '42501',
  'DEMO_WORKSPACE_RESET_ENVIRONMENT_DENIED',
  'reset denied in PRODUCTION'
);

update private.admin_execution_environment_v1 set environment = 'DEVELOPMENT' where singleton;

select * from finish();
rollback;
