-- Invariants étape 5 : qualification / matching exigent société VERIFIED.
begin;
select plan(4);

select ok(has_table('public', 'provider_profiles'), 'provider_profiles holds company_status');
select ok(has_table('public', 'provider_qualifications'), 'provider_qualifications holds service decisions');
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and pg_get_functiondef(p.oid) ilike '%COMPANY_NOT_VERIFIED%'
  ),
  'eligibility surfaces COMPANY_NOT_VERIFIED'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and pg_get_functiondef(p.oid) ilike '%QUALIFICATION_%'
      and pg_get_functiondef(p.oid) ilike '%APPROVED%'
  ),
  'eligibility references qualification APPROVED path'
);

select * from finish();
rollback;
