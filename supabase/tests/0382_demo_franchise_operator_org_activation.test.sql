begin;set local search_path=public,extensions;select plan(2);
select ok((
  select pg_get_functiondef(p.oid) like '%NON_CONTRACTUAL_DEMO%PENDING%'
    and pg_get_functiondef(p.oid) like '%update public.organizations set status=''ACTIVE''%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='accept_franchise_activation_v1'
),'demo invitation acceptance activates a pending operator organization');
select is((
  select count(*) from public.organizations o
  join public.franchises f on f.operator_organization_id=o.id and f.status='ACTIVE'
  join public.franchise_activation_evidence e on e.franchise_id=f.id and e.activation_mode='NON_CONTRACTUAL_DEMO'
  where o.status='PENDING'
),0::bigint,'no active demo franchise keeps a pending operator organization');
select * from finish();
rollback;
