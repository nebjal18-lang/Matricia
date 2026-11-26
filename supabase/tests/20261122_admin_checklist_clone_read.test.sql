begin;
set local search_path=public,extensions;
select plan(10);

select ok((select relrowsecurity from pg_class where oid='public.service_checklist_templates'::regclass),'RLS remains enabled');
select ok(has_column_privilege('authenticated','public.service_checklist_templates','id','SELECT'),'selector identifier can be read through RLS');
select ok(has_column_privilege('authenticated','public.service_checklist_templates','service_version_id','SELECT'),'selector service reference can be read through RLS');
select ok(has_column_privilege('authenticated','public.service_checklist_templates','version','SELECT'),'selector version can be read through RLS');
select ok(has_column_privilege('authenticated','public.service_checklist_templates','created_at','SELECT'),'selector can order its bounded query');
select ok(not has_column_privilege('authenticated','public.service_checklist_templates','items','SELECT'),'checklist content is not exposed by selector access');
select ok(not has_column_privilege('anon','public.service_checklist_templates','id','SELECT'),'anonymous selector access is denied');
select ok(not has_table_privilege('authenticated','public.service_checklist_templates','INSERT,UPDATE,DELETE'),'direct checklist mutations remain denied');
select matches((select qual from pg_policies where schemaname='public' and tablename='service_checklist_templates' and policyname='service_checklist_admin_clone_sources_read'),'aal2','selector requires the second factor');
select matches((select qual from pg_policies where schemaname='public' and tablename='service_checklist_templates' and policyname='service_checklist_admin_clone_sources_read'),'has_platform_role','selector requires an authorized platform role');

select * from finish();
rollback;
