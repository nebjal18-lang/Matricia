begin;
set local search_path = public, extensions;
select plan(14);

select has_function('private', 'franchise_mandated_library', array['uuid', 'uuid'], 'mandated library helper exists');
select has_function('private', 'franchise_supervises_contract', array['uuid', 'uuid'], 'contract supervision helper exists');
select ok(
  (
    select p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'franchise_mandated_library'
       and pg_get_function_identity_arguments(p.oid) = 'p_library_id uuid, p_actor uuid'
  ),
  'mandated library helper is SECURITY DEFINER with a fixed search_path'
);
select ok(
  has_function_privilege('authenticated', 'private.franchise_mandated_library(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.franchise_mandated_library(uuid,uuid)', 'EXECUTE'),
  'authenticated can execute the helper, anon cannot'
);

select ok(
  (
    select count(*) = 30
      from pg_policies
     where schemaname = 'public'
       and policyname like '%franchise_library_read'
  ),
  'thirty additive franchise library read policies exist; messaging requires explicit participants'
);

select ok(
  exists (select 1 from pg_policies where policyname = 'diagnostic_anomalies_franchise_library_read' and cmd = 'SELECT')
  and exists (select 1 from pg_policies where policyname = 'service_requests_franchise_library_read' and cmd = 'SELECT')
  and exists (select 1 from pg_policies where policyname = 'quotes_franchise_library_read' and cmd = 'SELECT')
  and exists (select 1 from pg_policies where policyname = 'missions_franchise_library_read' and cmd = 'SELECT')
  and exists (select 1 from pg_policies where policyname = 'provider_services_franchise_library_read' and cmd = 'SELECT')
  and not exists (select 1 from pg_policies where policyname = 'internal_message_threads_franchise_library_read')
  and exists (select 1 from pg_policies where policyname = 'dispute_cases_franchise_library_read' and cmd = 'SELECT'),
  'supervision policies are SELECT-only'
);

select ok(
  (
    select qual like '%franchise_supervises_dispute%'
       and qual not like '%join%'
      from pg_policies
     where policyname = 'dispute_cases_franchise_library_read'
  ),
  'dispute supervision walks the mandate in a definer helper'
);

select ok(
  not exists (
    select 1 from pg_policies
     where policyname like '%franchise_library_read'
       and cmd <> 'SELECT'
  ),
  'no franchise library write policy is introduced'
);

select ok(
  (
    select pg_get_functiondef(p.oid) like '%franchise_access%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'franchise_mandated_library'
  ),
  'helper reuses private.franchise_access'
);

select ok(
  (
    select pg_get_functiondef(p.oid) like '%status = ''ACTIVE''%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'franchise_mandated_library'
  ),
  'only an ACTIVE franchise mandate opens library supervision'
);

select ok(
  exists (select 1 from pg_policies where policyname = 'diagnostic_runs_tenant_read')
  and exists (select 1 from pg_policies where policyname = 'service_requests_authorized_read')
  and exists (select 1 from pg_policies where policyname = 'quotes_read')
  and exists (select 1 from pg_policies where policyname = 'missions_party_read'),
  'original tenant and party policies remain'
);

select ok(
  (
    select qual like '%franchise_supervises_matching_run%'
      from pg_policies
     where policyname = 'matching_candidates_franchise_library_read'
  ),
  'matching candidates are scoped by mandated library, not by provider org membership'
);

select ok(
  (
    select qual ilike '%franchise_supervises_catalog_service%'
      from pg_policies
     where policyname = 'provider_capacity_versions_franchise_library_read'
       and qual ilike '%service_id is not null%'
  ),
  'capacity supervision is limited to library-scoped service rows'
);

select ok(
  (
    select qual like '%franchise_supervises_document_version%'
      from pg_policies
     where policyname = 'provider_document_versions_franchise_library_read'
  )
  and not exists (
    select 1 from pg_policies
     where policyname like '%franchise_library_read'
       and qual like '%storage_object_path%'
  ),
  'document policy does not invent a download grant'
);

select * from finish();
rollback;
