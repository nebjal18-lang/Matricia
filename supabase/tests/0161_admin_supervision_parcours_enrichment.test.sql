begin;
set local search_path = public, extensions;
select plan(6);



select ok((
  select pg_get_functiondef(p.oid) !~* '\m(insert|update|delete)\M'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'list_admin_supervision_projection'
), 'enriched projection remains read-only');

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('a1623000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tenant-1623@example.invalid', '', now(), '{}', '{}', now(), now()),
('a1623000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-1623@example.invalid', '', now(), '{}', '{}', now(), now());
insert into public.organizations(id, legal_name, display_name, status, created_by)
values ('b1623000-0000-4000-8000-000000000001', 'Parcours Org 1623', 'Parcours 1623', 'ACTIVE', 'a1623000-0000-4000-8000-000000000001');
insert into public.platform_user_roles(user_id, role_code) values
('a1623000-0000-4000-8000-000000000002', 'MATRICIA_ADMIN');

select throws_ok(
  $$set local role authenticated; select set_config('request.jwt.claim.sub','a1623000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claims','{"sub":"a1623000-0000-4000-8000-000000000001","role":"authenticated"}',true); select public.list_admin_supervision_projection(10)$$,
  '42501',
  'ADMIN_SUPERVISION_DENIED',
  'tenant cannot read enriched supervision'
);

create temporary table p1623_observed(key text,value jsonb);
grant select, insert on p1623_observed to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1623000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1623000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
insert into p1623_observed values ('legacy',public.list_admin_supervision_projection(10)),('paged',public.list_admin_supervision_page_v1(10,0));
reset role;

select ok((select value ?& array['matching','contracts','amendments','documents','messages','exceptions','templates'] and jsonb_typeof(value->'organizations')='array' from p1623_observed where key='paged'),'bounded projection returns actual enriched parcours keys');
select ok((
  select value ? 'matching' and value ? 'contracts' and value ? 'amendments'
     and value ? 'documents' and value ? 'messages' and value ? 'exceptions' and value ? 'templates'
  from p1623_observed where key='legacy'
), 'admin projection returns enriched parcours arrays');
select ok((
  select jsonb_typeof(value->'matching') = 'array'
     and jsonb_typeof(value->'documents') = 'array'
     and jsonb_typeof(value->'messages') = 'array'
  from p1623_observed where key='legacy'
), 'enriched keys are arrays');
select ok((
  select has_function_privilege('authenticated', 'public.list_admin_supervision_projection(integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_admin_supervision_projection(integer)', 'EXECUTE')
), 'execute remains authenticated-only');

select * from finish();
rollback;
