-- Invariants étape 5→6 : commerce client exige identité/compliance gouvernée.
begin;
select plan(4);

select has_function(
  'private', 'client_identity_allows_new_operations', array['uuid'],
  'client identity gate exists before new commercial operations'
);

select ok(
  not has_function_privilege('anon', 'private.client_identity_allows_new_operations(uuid)', 'EXECUTE'),
  'anon cannot execute private identity gate'
);

select has_table(
  'public', 'client_compliance_cases',
  'client_compliance_cases is the source of VERIFIED status'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.client_compliance_cases'::regclass
      and pg_get_constraintdef(oid) ilike '%VERIFIED%'
  ),
  'compliance case status machine includes VERIFIED'
);

select * from finish();
rollback;
