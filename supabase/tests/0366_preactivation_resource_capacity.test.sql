begin;
set local search_path=public,extensions;
select plan(3);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3660000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','capacity366@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3660000-0000-4000-8000-000000000001','Capacity 366','Capacity 366','ACTIVE','a3660000-0000-4000-8000-000000000001');

select lives_ok($$select private.assert_subscription_resource_capacity_v1('b3660000-0000-4000-8000-000000000001','DIAGNOSTICS',0,1)$$,'a client without a trial can open a questionnaire');
select lives_ok($$select private.assert_subscription_resource_capacity_v1('b3660000-0000-4000-8000-000000000001','PROJECTS',0,1)$$,'a client without a trial can open a project');

insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values
('c3660000-0000-4000-8000-000000000001','b3660000-0000-4000-8000-000000000001','VERIFIED',1,'a3660000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values
('c3660000-0000-4000-8000-000000000001','b3660000-0000-4000-8000-000000000001',1,'{}','{}',1,'a3660000-0000-4000-8000-000000000001');
insert into public.client_trials(id,organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)
select 'd3660000-0000-4000-8000-000000000001','b3660000-0000-4000-8000-000000000001','c3660000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',started,started+interval'30 days','a3660000-0000-4000-8000-000000000001'
from (select now()-interval'1 day' as started) bounds;
select throws_ok($$select private.assert_subscription_resource_capacity_v1('b3660000-0000-4000-8000-000000000001','DIAGNOSTICS',0,1)$$,'55000','SUBSCRIPTION_OPERATION_RESTRICTED','an existing trial never falls back to unmetered diagnostics');

select * from finish();
rollback;
