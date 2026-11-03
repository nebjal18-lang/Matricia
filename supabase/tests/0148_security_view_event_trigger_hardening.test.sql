begin;
set local search_path = public, extensions;
select plan(15);

select has_function(
  'private',
  'organization_audit_activity_rows',
  array[]::text[],
  'the tenant audit projection helper exists'
);
select function_privs_are(
  'private',
  'organization_audit_activity_rows',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated can execute only the tenant-filtered projection helper'
);
select ok(
  not has_function_privilege('anon', 'private.organization_audit_activity_rows()', 'EXECUTE'),
  'anon cannot execute the tenant audit projection helper'
);
select has_view(
  'public',
  'organization_audit_activity',
  'the expurgated organization audit view remains available'
);
select columns_are(
  'public',
  'organization_audit_activity',
  array['organization_id','id','action','resource_type','resource_id','correlation_id','occurred_at'],
  'the hardened view preserves its public contract'
);
select ok(
  (select reloptions @> array['security_barrier=true','security_invoker=true']
   from pg_class relation
   join pg_namespace schema on schema.oid = relation.relnamespace
   where schema.nspname = 'public'
     and relation.relname = 'organization_audit_activity'),
  'the audit view is a security-barrier security-invoker view'
);

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable' and has_function_privilege('public', p.oid, 'EXECUTE')),
  'PUBLIC cannot execute the RLS event-trigger function'
);
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'anon cannot execute the RLS event-trigger function'
);
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'authenticated cannot execute the RLS event-trigger function'
);
select is(
  (select count(*)
   from pg_event_trigger event_trigger
   join pg_proc trigger_function on trigger_function.oid = event_trigger.evtfoid
   join pg_namespace schema on schema.oid = trigger_function.pronamespace
   where event_trigger.evtname = 'ensure_rls'
     and event_trigger.evtenabled <> 'D'
     and schema.nspname = 'public'
     and trigger_function.proname = 'rls_auto_enable'),
  case when to_regprocedure('public.rls_auto_enable()') is null then 0 else 1 end::bigint,
  'the hosted ensure_rls event trigger is preserved when installed'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1480000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-view-a@example.invalid','',now(),'{}','{}',now(),now()),
  ('f1480000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-view-b@example.invalid','',now(),'{}','{}',now(),now());

insert into public.organizations (id, legal_name, display_name, status, created_by) values
  ('f1481000-0000-4000-8000-000000000001','Security View A SARL','Security View A','ACTIVE','f1480000-0000-4000-8000-000000000001'),
  ('f1481000-0000-4000-8000-000000000002','Security View B SARL','Security View B','ACTIVE','f1480000-0000-4000-8000-000000000002');

insert into public.organization_memberships (
  id, organization_id, user_id, status, activated_at
) values
  ('f1482000-0000-4000-8000-000000000001','f1481000-0000-4000-8000-000000000001','f1480000-0000-4000-8000-000000000001','ACTIVE',now()),
  ('f1482000-0000-4000-8000-000000000002','f1481000-0000-4000-8000-000000000002','f1480000-0000-4000-8000-000000000002','ACTIVE',now());

insert into public.organization_member_roles (membership_id, role_code) values
  ('f1482000-0000-4000-8000-000000000001','CLIENT_MEMBER'),
  ('f1482000-0000-4000-8000-000000000002','CLIENT_MEMBER');

insert into public.audit_events (
  organization_id, actor_user_id, actor_type, action, resource_type,
  resource_id, correlation_id, metadata, previous_hash, event_hash
) values
  ('f1481000-0000-4000-8000-000000000001','f1480000-0000-4000-8000-000000000001','USER','security.view.a','organization','A','f1483000-0000-4000-8000-000000000001','{}',null,repeat('0',64)),
  ('f1481000-0000-4000-8000-000000000002','f1480000-0000-4000-8000-000000000002','USER','security.view.b','organization','B','f1483000-0000-4000-8000-000000000002','{}',null,repeat('0',64));

create temporary table security_view_observed (
  key text primary key,
  value bigint not null
);
grant insert, select on table security_view_observed to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1480000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f1480000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into security_view_observed values
  ('own',(select count(*) from public.organization_audit_activity where organization_id='f1481000-0000-4000-8000-000000000001')),
  ('other',(select count(*) from public.organization_audit_activity where organization_id='f1481000-0000-4000-8000-000000000002')),
  ('raw',(select count(*) from public.audit_events where organization_id in ('f1481000-0000-4000-8000-000000000001','f1481000-0000-4000-8000-000000000002')));
reset role;

select is(
  (select value from security_view_observed where key='own'),
  1::bigint,
  'an active member reads its own expurgated audit event'
);
select is(
  (select value from security_view_observed where key='other'),
  0::bigint,
  'an active member cannot read another tenant audit event'
);
select is(
  (select value from security_view_observed where key='raw'),
  0::bigint,
  'an ordinary member still cannot read raw audit events'
);
select ok(
  has_table_privilege('authenticated','public.organization_audit_activity','SELECT'),
  'the authenticated view grant is preserved'
);
select ok(
  not has_table_privilege('anon','public.organization_audit_activity','SELECT'),
  'anon remains denied on the audit view'
);

select * from finish();
rollback;

