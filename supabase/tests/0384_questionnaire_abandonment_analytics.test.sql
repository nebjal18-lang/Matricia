begin;
set local search_path=public,extensions;
grant usage on schema private to service_role;
select plan(24);

select has_table('public','questionnaire_abandonment_policy_versions','abandonment policy table exists');
select has_table('private','questionnaire_abandonment_snapshots','private abandonment snapshots exist');
select has_table('private','questionnaire_analytics_command_keys','analytics command keys stay private');
select ok((select bool_and(c.relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname||'.'||c.relname in('public.questionnaire_abandonment_policy_versions','private.questionnaire_abandonment_snapshots','private.questionnaire_analytics_command_keys')),'RLS is enabled on policy, snapshots and command keys');
select ok(not has_table_privilege('authenticated','public.questionnaire_abandonment_policy_versions','SELECT')and not has_table_privilege('authenticated','private.questionnaire_abandonment_snapshots','SELECT'),'authenticated cannot read private analytics tables directly');
select ok(not exists(select 1 from information_schema.columns where table_schema='private'and table_name='questionnaire_abandonment_snapshots'and column_name in('organization_id','user_id','actor_user_id','org_id')),'snapshots persist no organization or user identifiers');
select ok((select prosrc like'%minimum_group_size%'and prosrc like'%having count(*)>=v_policy.minimum_group_size%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname='refresh_questionnaire_abandonment_analytics'),'refresh enforces active minimum group size');
select ok(exists(select 1 from pg_constraint where conrelid='private.questionnaire_abandonment_snapshots'::regclass and contype='c'and pg_get_constraintdef(oid)like'%QUESTIONNAIRE%'and pg_get_constraintdef(oid)like'%SECTION%'and pg_get_constraintdef(oid)like'%QUESTION%'),'snapshot dimension constraints cover questionnaire, section and question');
select ok(has_function_privilege('service_role','private.refresh_questionnaire_abandonment_analytics(date,date,uuid)','EXECUTE')and has_function_privilege('service_role','private.purge_expired_questionnaire_abandonment_analytics(uuid)','EXECUTE'),'refresh and purge are granted to service_role');
select ok(not has_function_privilege('authenticated','private.refresh_questionnaire_abandonment_analytics(date,date,uuid)','EXECUTE')and not has_function_privilege('authenticated','private.purge_expired_questionnaire_abandonment_analytics(uuid)','EXECUTE')and not has_function_privilege('anon','private.refresh_questionnaire_abandonment_analytics(date,date,uuid)','EXECUTE'),'refresh and purge exclude authenticated and anonymous callers');
select ok((select count(*)=2 and bool_and(p.prosecdef)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('get_questionnaire_abandonment_policy','get_questionnaire_abandonment_analytics')),'analytics read RPCs are security definer');
select ok((select prosrc like'%QUESTIONNAIRE_ANALYTICS_READ_DENIED%'and prosrc like'%has_platform_role%'from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname='get_questionnaire_abandonment_analytics'),'analytics query denies non-platform readers');
select is((select minimum_group_size from public.questionnaire_abandonment_policy_versions where status='ACTIVE'),10,'baseline policy minimum cohort is ten sessions');
select ok((select count(*)from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')and c.relname in('questionnaire_abandonment_policy_versions','questionnaire_abandonment_snapshots')and not t.tgisinternal)>=2,'policy and snapshot immutability guards are installed');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('e3840000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-e384@example.invalid','',now(),'{}','{}',now(),now()),
('e3840000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-e384@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('e3841000-0000-4000-8000-000000000001','Abandonment E384 SARL','Abandonment E384','ACTIVE','e3840000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('e3841100-0000-4000-8000-000000000001','e3841000-0000-4000-8000-000000000001','e3840000-0000-4000-8000-000000000001','ACTIVE',now()),
('e3841100-0000-4000-8000-000000000002','e3841000-0000-4000-8000-000000000001','e3840000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('e3841100-0000-4000-8000-000000000001','CLIENT_MEMBER');
insert into public.platform_user_roles(user_id,role_code)values('e3840000-0000-4000-8000-000000000002','LIBRARY_MANAGER');
set local session_replication_role=replica;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3842000-0000-4000-8000-000000000001','ABANDON_E384','abandon-e384','e3841000-0000-4000-8000-000000000001','PUBLISHED','e3840000-0000-4000-8000-000000000002');
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,created_by,audience,effective_from,published_at)values('e3842100-0000-4000-8000-000000000001','e3842000-0000-4000-8000-000000000001','E384.ABANDON.V1','PUBLISHED',repeat('a',64),repeat('b',64),'e3840000-0000-4000-8000-000000000002','{"kind":"PUBLIC"}',now()-interval'30 days',now()-interval'30 days');
update public.catalog_libraries set current_release_id='e3842100-0000-4000-8000-000000000001'where id='e3842000-0000-4000-8000-000000000001';
insert into public.questionnaires(id,library_id,code,status,current_published_version_id,created_by)values('e3842200-0000-4000-8000-000000000001','e3842000-0000-4000-8000-000000000001','ABANDON_ENGINE','PUBLISHED','e3842300-0000-4000-8000-000000000001','e3840000-0000-4000-8000-000000000002');
insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,translation_review_status,translation_reviewer_user_id,translation_reviewed_at,translation_review_proof_hash,translation_review_version,change_reason,created_by,published_at)values
('e3842300-0000-4000-8000-000000000001','e3842200-0000-4000-8000-000000000001','e3842000-0000-4000-8000-000000000001','e3842100-0000-4000-8000-000000000001',1,'PUBLISHED','Questionnaire E384','استبيان E384','Agrégats abandon','تجميع الهجر','CLIENT','2.0.0','E384-1',repeat('0',64),'APPROVED','e3840000-0000-4000-8000-000000000002',now(),repeat('c',64),1,'Fixture E384 analytics','e3840000-0000-4000-8000-000000000002',now()-interval'30 days');
set local session_replication_role=origin;

create temporary table e384_period as select (current_date-14)::date period_start,(current_date-8)::date period_end;
grant select on e384_period to service_role,authenticated;
set local session_replication_role=replica;
insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,is_simulation,started_at,abandoned_at,expired_at,answer_manifest,answer_manifest_hash)
select ('e3843000-0000-4000-8000-'||lpad(gs::text,12,'0'))::uuid,'e3841000-0000-4000-8000-000000000001','e3840000-0000-4000-8000-000000000001','e3842000-0000-4000-8000-000000000001','e3842100-0000-4000-8000-000000000001','e3842300-0000-4000-8000-000000000001','CLIENT','fr-MA',case when gs<=7 then'ABANDONED'else'EXPIRED'end,false,(select period_start from e384_period)+((gs-1)%7)*interval'1 day',case when gs<=7 then(select period_start from e384_period)+((gs-1)%7)*interval'1 day'+interval'30 minutes'else null end,case when gs>7 then(select period_start from e384_period)+((gs-1)%7)*interval'1 day'+interval'1 hour'else null end,'{}',repeat('d',64)
from generate_series(1,12)gs;
set local session_replication_role=origin;

select throws_ok($$select * from public.get_questionnaire_abandonment_policy()$$,'42501','QUESTIONNAIRE_ANALYTICS_READ_DENIED','unauthenticated caller cannot read abandonment policy');
select throws_ok($$select * from public.get_questionnaire_abandonment_analytics(current_date-30,current_date-1,null,50)$$,'42501','QUESTIONNAIRE_ANALYTICS_READ_DENIED','unauthenticated caller cannot read abandonment analytics');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select * from public.get_questionnaire_abandonment_policy()$$,'42501','QUESTIONNAIRE_ANALYTICS_READ_DENIED','tenant member cannot read abandonment policy');
select throws_ok($$set local role authenticated;select set_config('request.jwt.claims','{"sub":"e3840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);select * from public.get_questionnaire_abandonment_analytics(current_date-30,current_date-1,null,50)$$,'42501','QUESTIONNAIRE_ANALYTICS_READ_DENIED','tenant member cannot read abandonment analytics');

create temporary table e384_observed(k text primary key,v jsonb);
grant select,insert on e384_observed to service_role,authenticated;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into e384_observed values('refresh',private.refresh_questionnaire_abandonment_analytics((select period_start from e384_period),(select period_end from e384_period),'e3844000-0000-4000-8000-000000000001'));
reset role;

select is((select v->>'outcome'from e384_observed where k='refresh'),'QUESTIONNAIRE_ABANDONMENT_SNAPSHOT_REFRESHED','refresh writes private thresholded aggregates');
select ok((select coalesce((v->>'aggregate_count')::integer,0)from e384_observed where k='refresh')>=1,'refresh inserts at least one questionnaire-level aggregate');
select is((select count(*)from private.questionnaire_abandonment_snapshots where questionnaire_version_id='e3842300-0000-4000-8000-000000000001'and dimension_type='QUESTIONNAIRE'and period_start=(select period_start from e384_period)),1::bigint,'exactly one questionnaire snapshot is materialized for the cohort');
select is((select sample_count from private.questionnaire_abandonment_snapshots where questionnaire_version_id='e3842300-0000-4000-8000-000000000001'and dimension_type='QUESTIONNAIRE'and period_start=(select period_start from e384_period)),12,'cohort size reflects every non-simulation session in the window');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e3840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into e384_observed values('policy',to_jsonb((select row_to_json(p)from public.get_questionnaire_abandonment_policy()p limit 1)));
insert into e384_observed values('analytics_count',to_jsonb((select count(*)from public.get_questionnaire_abandonment_analytics((select period_start from e384_period),(select period_end from e384_period),'e3842300-0000-4000-8000-000000000001',50))));
reset role;
select is((select v->>'minimum_group_size'from e384_observed where k='policy'),'10','platform reader sees active minimum group size through guarded RPC');
select is((select v::text::bigint from e384_observed where k='analytics_count'),1::bigint,'platform reader sees thresholded analytics without direct snapshot access');

select * from finish();
rollback;
