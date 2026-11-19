-- Catalogue territorial Box Builder (tarifs de gros).
begin;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated;
select plan(4);

select has_function(
  'public',
  'list_admin_wholesale_offers_by_territory_v1',
  array['text', 'text'],
  'RPC wholesale territory catalog exists'
);

select ok(
  (select pg_get_functiondef(p.oid) like '%BOX_PLATFORM_MARGIN_BPS%'
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_platform_parameter_version'),
  'platform parameter accepts BOX_PLATFORM_MARGIN_BPS'
);

select throws_ok(
  $$select public.list_admin_wholesale_offers_by_territory_v1('CASABLANCA', null)$$,
  '42501',
  null,
  'anonymous caller cannot read wholesale catalog'
);

select ok(
  (select pg_get_functiondef(p.oid) like '%WHOLESALE_CATALOG_DENIED%'
     and pg_get_functiondef(p.oid) like '%provider_capacity_commitments%'
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'list_admin_wholesale_offers_by_territory_v1'),
  'catalog function scopes commitments by territory and denies unauthorized'
);

select * from finish();
rollback;
