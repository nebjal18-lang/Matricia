begin;
set local search_path=public,private,extensions;
select plan(12);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
 ('f2110000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','modes-owner@example.invalid','',now(),'{}','{}',now(),now()),
 ('f2110000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','modes-accounting@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values('f2111000-0000-4000-8000-000000000001','Intervention Modes Test','Intervention Modes Test','ACTIVE','f2110000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
 ('f2112000-0000-4000-8000-000000000001','f2111000-0000-4000-8000-000000000001','f2110000-0000-4000-8000-000000000001','ACTIVE',now()),
 ('f2112000-0000-4000-8000-000000000002','f2111000-0000-4000-8000-000000000001','f2110000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('f2112000-0000-4000-8000-000000000001','PROVIDER_OWNER'),('f2112000-0000-4000-8000-000000000002','PROVIDER_ACCOUNTING');

insert into public.provider_match_profiles(provider_organization_id)values('f2111000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"f2110000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['ONSITE'],'Declaration',0,'f2114000-0000-4000-8000-000000000001')$$,'42501','PROVIDER_INTERVENTION_SCOPE_DENIED','accounting role cannot alter operational capabilities');
select set_config('request.jwt.claims','{"sub":"f2110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
create temporary table modes_result(value jsonb);
insert into modes_result select public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['ONSITE','ONSITE'],'Declaration',0,'f2114000-0000-4000-8000-000000000001');
select is((select value->>'version_number'from modes_result),'1','first capability version is recorded');
select is(public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['ONSITE'],'Declaration',0,'f2114000-0000-4000-8000-000000000001'),(select value from modes_result),'normalized replay reuses the same version');
select throws_ok($$select public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['REMOTE'],'Declaration',0,'f2114000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','same identity cannot silently alter modes');
select throws_ok($$select public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['REMOTE'],'Declaration',0,'f2114000-0000-4000-8000-000000000002')$$,'40001','PROVIDER_INTERVENTION_VERSION_CONFLICT','stale capability declaration is rejected');
select ok(private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{"intervention_mode":"ONSITE"}'),'exact supported mode matches');
select ok(not private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{"intervention_mode":"REMOTE"}'),'unsupported remote intervention is excluded');
select ok(not private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{"intervention_mode":"HYBRID"}'),'onsite does not invent a hybrid capability');
select ok(private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{}'),'unspecified mode preserves existing matching rules');
select is(public.declare_provider_intervention_modes('f2111000-0000-4000-8000-000000000001',array['REMOTE'],'New reviewed capability',1,'f2114000-0000-4000-8000-000000000002')->>'version_number','2','current base can append a new capability');
select is((select count(*)from public.provider_intervention_mode_versions where provider_organization_id='f2111000-0000-4000-8000-000000000001'),2::bigint,'previous declarations remain in immutable history');
select ok(not private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{"intervention_mode":"ONSITE"}')and private.provider_intervention_mode_matches('f2111000-0000-4000-8000-000000000001','{"intervention_mode":"REMOTE"}'),'matching uses the latest declaration');
select*from finish();rollback;
