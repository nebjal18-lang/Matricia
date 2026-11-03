begin;
set local search_path = public, extensions;
select plan(18);
-- Inspect the actual guarded delegate, not only the public review adapter.
create temporary view tested_qualification_command_source as
 select case when pg_get_functiondef('public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure) like '%public.decide_provider_qualification_pre_review_0384(%'
 then pg_get_functiondef('public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure)||pg_get_functiondef('public.decide_provider_qualification_pre_review_0384(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure) else '' end as source;


select has_table('public', 'anomaly_definitions', 'anomaly definition identities exist');
select has_table('public', 'risk_definitions', 'risk definition identities exist');
select has_table('public', 'recommendation_definitions', 'recommendation definition identities exist');
select has_table('public', 'franchise_volume_proposals', 'franchise volume proposals exist');

select has_function('public', 'upsert_franchise_anomaly_definition', 'anomaly definition command exists');
select has_function('public', 'upsert_franchise_risk_definition', 'risk definition command exists');
select has_function('public', 'upsert_franchise_recommendation_definition', 'recommendation definition command exists');
select has_function('public', 'instruct_franchise_dispute', 'franchise incident instruction exists');
select has_function('public', 'propose_franchise_volume_purchase', 'franchise volume proposal exists');

select ok(
  (
    select p.source like '%can_decide_franchise_service_qualification%'
      from tested_qualification_command_source p
  ),
  'service qualification may be decided by the mandated-library franchisee'
);

select ok(
  (
    select p.prosrc like '%can_decide_provider_qualification%'
       and p.prosrc not like '%can_decide_franchise_service_qualification%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'decide_provider_company'
  ),
  'company qualification remains a platform human decision'
);

select ok(
  (
    select p.prosrc like '%CLIENT_OWNER%' and p.prosrc like '%DISPUTE_OPEN_DENIED%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_mission_dispute'
  ),
  'opening an incident remains a client command'
);

select ok(
  (
    select p.prosrc not like '%framework_agreements%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'propose_franchise_volume_purchase'
  ),
  'a franchise volume proposal does not create a framework agreement'
);

select ok(
  has_function_privilege('authenticated', 'public.upsert_franchise_anomaly_definition(uuid,text,text,text,text,text,text,boolean,boolean,text,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.upsert_franchise_anomaly_definition(uuid,text,text,text,text,text,text,boolean,boolean,text,text,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.instruct_franchise_dispute(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.instruct_franchise_dispute(uuid,text,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.propose_franchise_volume_purchase(uuid,uuid,numeric,numeric,numeric,text,date,date,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.propose_franchise_volume_purchase(uuid,uuid,numeric,numeric,numeric,text,date,date,text,text,uuid)', 'EXECUTE'),
  'authenticated can execute the new franchise commands, anon cannot'
);

select ok(
  not has_table_privilege('authenticated', 'public.anomaly_definitions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.risk_definitions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.recommendation_definitions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.franchise_volume_proposals', 'INSERT'),
  'definition and proposal tables stay SELECT-only for authenticated'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'anomaly_definitions'
      and policyname = 'anomaly_definitions_franchise_library_read'
      and cmd = 'SELECT'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'franchise_volume_proposals'
      and policyname = 'franchise_volume_proposals_scoped_read'
      and cmd = 'SELECT'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_qualification_decisions'
      and policyname = 'provider_qualification_decisions_franchise_library_read'
      and cmd = 'SELECT'
  )
  and exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='dispute_cases'
      and policyname='dispute_cases_franchise_library_read' and cmd='SELECT'
      and qual like '%franchise_supervises_dispute%'
  ),
  'franchisees can read mandated-library definitions, proposals, qualification decisions and incident dossiers'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'anomaly_definitions_current_version_fk')
  and exists (select 1 from pg_constraint where conname = 'risk_definitions_current_version_fk')
  and exists (select 1 from pg_constraint where conname = 'recommendation_definitions_current_version_fk'),
  'definition identities point to an immutable current version'
);

select ok(
  has_function_privilege('authenticated', 'public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.upsert_franchise_risk_definition(uuid,text,text,text,text,text,text,text,text,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.upsert_franchise_recommendation_definition(uuid,text,uuid,uuid,text,integer,text,text,text,text,text,text,text,text,uuid)', 'EXECUTE'),
  'authenticated can execute franchise risk, recommendation and service-qualification commands'
);

select * from finish();
rollback;
