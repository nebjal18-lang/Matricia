begin;
set local search_path=public,extensions;
select plan(42);
-- Inspect the actual guarded delegate, not only the public review adapter.
create temporary view tested_qualification_command_source as
 select case when pg_get_functiondef('public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure) like '%public.decide_provider_qualification_pre_review_0384(%'
 then pg_get_functiondef('public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure)||pg_get_functiondef('public.decide_provider_qualification_pre_review_0384(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)'::regprocedure) else '' end as source;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select has_table('public','provider_profiles','provider company profile exists');
select has_table('public','provider_company_decisions','company decisions are versioned');
select has_table('public','provider_services','provider service requests are separate');
select has_table('public','provider_document_families','document identities exist');
select has_table('public','provider_document_versions','document evidence is versioned');
select has_table('public','provider_document_service_links','evidence can be scoped to services');
select has_table('public','provider_qualifications','service qualification aggregate exists');
select has_table('public','provider_qualification_decisions','qualification decisions are versioned');
select has_table('public','provider_capacity_versions','capacity declarations are versioned');
select has_table('public','provider_restriction_decisions','restrictions are explicit human decisions');

select has_function('public','submit_provider_profile',array['uuid','jsonb','integer','text','uuid'],'provider profile submission command exists');
select has_function('public','decide_provider_company',array['uuid','text','text','timestamp with time zone','text','text','integer','text','uuid'],'human company decision command exists');
select has_function('public','request_provider_service',array['uuid','uuid','text','uuid'],'service qualification request command exists');
select has_function('public','record_provider_document_version',array['uuid','text','text','jsonb','uuid[]','text','text','uuid'],'document version command exists');
select has_function('public','review_provider_document',array['uuid','text','text','text','text','uuid'],'document review command exists');
select has_function('public','declare_provider_capacity',array['uuid','uuid','text','integer','integer','text','text','uuid'],'capacity command exists');
select has_function('public','decide_provider_qualification',array['uuid','text','uuid','integer','jsonb','jsonb','text','text','timestamp with time zone','integer','text','uuid'],'service decision command exists');
select has_function('public','decide_provider_restriction',array['uuid','uuid','text','text','text','jsonb','text','text','uuid'],'restriction decision command exists');
select has_function('public','explain_provider_service_eligibility',array['uuid','uuid'],'eligibility explanation exists');

select ok((select bool_and(p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('submit_provider_profile','decide_provider_company','request_provider_service','record_provider_document_version','review_provider_document','declare_provider_capacity','decide_provider_qualification','decide_provider_restriction','explain_provider_service_eligibility')),'all provider commands fix the security-definer search path');
select ok(not has_function_privilege('anon','public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamp with time zone,integer,text,uuid)','EXECUTE')and not has_function_privilege('service_role','public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamp with time zone,integer,text,uuid)','EXECUTE'),'anonymous and service roles cannot decide qualification');
select ok(not has_table_privilege('authenticated','public.provider_profiles','INSERT')and not has_table_privilege('authenticated','public.provider_qualification_decisions','UPDATE')and not has_table_privilege('authenticated','public.provider_capacity_versions','DELETE'),'direct provider mutations remain denied');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname in('provider_profiles','provider_company_decisions','provider_services','provider_document_families','provider_document_versions','provider_document_service_links','provider_qualifications','provider_qualification_decisions','provider_capacity_versions','provider_restriction_decisions')),'all provider tenant tables enforce RLS');
select ok((select count(*)=0 from information_schema.columns where table_schema='public'and table_name like'provider_%'and data_type in('real','double precision')),'provider domain contains no floating point fields');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_services'::regclass and contype='u'and pg_get_constraintdef(oid)like'%provider_organization_id, service_id%'),'a provider has one aggregate per service');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_qualification_decisions'::regclass and contype='f'and pg_get_constraintdef(oid)like'%questionnaire_session_id%'),'qualification decision references submitted questionnaire evidence');
select ok((select count(*)=4 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname in('provider_document_versions','provider_qualification_decisions','provider_capacity_versions','provider_restriction_decisions')and not t.tgisinternal and t.tgname like'%_immutable'),'document, qualification, capacity and restriction histories are immutable');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_qualification_decisions'::regclass and contype='u'and pg_get_constraintdef(oid)like'%qualification_id, decision_version%'),'qualification decision versions cannot collide');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_company_decisions'::regclass and contype='u'and pg_get_constraintdef(oid)like'%provider_organization_id, decision_version%'),'company decision versions cannot collide');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_capacity_versions'::regclass and contype='c'and pg_get_constraintdef(oid)like'%AVAILABLE%'and pg_get_constraintdef(oid)like'%PAUSED%'),'capacity supports AVAILABLE LIMITED FULL and PAUSED');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_qualification_decisions'::regclass and contype='c'and pg_get_constraintdef(oid)like'%INFORMATION_REQUIRED%'and pg_get_constraintdef(oid)like'%CONDITIONAL%'and pg_get_constraintdef(oid)like'%EXPIRED%'),'qualification supports all governed decision states');
select ok((select p.prosrc like'%COMPANY_NOT_VERIFIED%'and p.prosrc like'%QUALIFICATION_NOT_DECIDED%'and position('DOCUMENT_' in p.prosrc)>0 and position('_INVALID' in p.prosrc)>0 and p.prosrc like'%CAPACITY_NOT_DECLARED%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='provider_service_eligibility_snapshot'),'eligibility exposes deterministic exclusion reasons');
select ok((select p.prosrc like'%ACTIVE_HUMAN_RESTRICTION%'and p.prosrc like'%provider_restriction_decisions%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='provider_service_eligibility_snapshot'),'eligibility explains active human restrictions');
select ok((select p.source like'%HUMAN_QUALIFICATION_DECISION_REQUIRED%'and p.source like'%audit_events%'and p.source like'%event_outbox%'from tested_qualification_command_source p),'qualification decisions require a human and emit audit/outbox records');
select ok((select p.source like'%INVALID_QUALIFICATION_TRANSITION%'and p.source like'%STALE_PROVIDER_QUALIFICATION%'from tested_qualification_command_source p),'qualification transitions and optimistic concurrency are enforced');
select ok((select p.prosrc like'%PROVIDER_DOCUMENT_SERVICE_SCOPE_DENIED%'and p.prosrc like'%provider_document_service_links%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='record_provider_document_version'),'documents cannot be linked across provider tenants');
select ok(exists(select 1 from pg_constraint where conrelid='public.provider_restriction_decisions'::regclass and contype='c'and pg_get_constraintdef(oid)like'%jsonb_array_length(evidence_refs) > 0%'),'restriction decisions require evidence');
select ok(exists(select 1 from pg_indexes where schemaname='public'and tablename='provider_document_versions'and indexname='provider_document_versions_expiry_idx'),'document expiry has an operational index');
select ok((select p.source like'%provider_service_match_profiles%'and p.source like'%required_certifications_valid%'from tested_qualification_command_source p),'qualification synchronizes the existing RFQ eligibility contract');
select ok((select p.prosrc like'%provider_match_profiles%'and p.prosrc like'%partner_contract_signed%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_provider_company'),'company decisions synchronize the existing RFQ eligibility contract');
select ok((select p.prosrc like'%IDEMPOTENCY_KEY_REUSED%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='begin_provider_qualification_command'),'provider commands reject idempotency-key payload changes');
select ok((select p.prosrc like'%FINANCIAL_RESTRICTED%'and p.prosrc like'%ProviderRestrictionDecidedV1%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='decide_provider_restriction'),'restriction decisions update matching gates and emit a governed event');

select * from finish();
rollback;
