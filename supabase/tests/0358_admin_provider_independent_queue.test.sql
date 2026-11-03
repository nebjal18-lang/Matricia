-- Synthetic rollback-only read fixtures. No membership/organization RLS grant.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a3580000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','queue358-provider@example.invalid','',now(),'{}','{}',now(),now()),
('a3580000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','queue358-reviewer@example.invalid','',now(),'{}','{}',now(),now()),
('a3580000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','queue358-client@example.invalid','',now(),'{}','{}',now(),now()),
('a3580000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','queue358-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('a3581000-0000-4000-8000-000000000001','TEST queue Provider','Prestataire de recette العربية','ACTIVE','a3580000-0000-4000-8000-000000000001'),
('a3581000-0000-4000-8000-000000000002','TEST queue Client','Client de recette','ACTIVE','a3580000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('a3582000-0000-4000-8000-000000000001','a3581000-0000-4000-8000-000000000001','a3580000-0000-4000-8000-000000000001','ACTIVE'),
('a3582000-0000-4000-8000-000000000002','a3581000-0000-4000-8000-000000000002','a3580000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values
('a3582000-0000-4000-8000-000000000001','PROVIDER_OWNER'),('a3582000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a3580000-0000-4000-8000-000000000002','COMPLIANCE_MANAGER');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.submit_provider_profile('a3581000-0000-4000-8000-000000000001','{"activity_summary":"TEST queue native Provider profile","team_size":2,"years_experience":3}',0,'TEST-0358-native-profile');
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.organizations),0,'independent reviewer still cannot SELECT raw organizations');
select is((select count(*)::integer from public.provider_profiles where provider_organization_id='a3581000-0000-4000-8000-000000000001'),1,'reviewer can read the genuine native Provider profile');
create temporary table queue358(k text primary key,v jsonb);grant select,insert on queue358 to authenticated;
insert into queue358 values('fr',public.get_admin_special_space_snapshot_v1('providers','fr')),('ar',public.get_admin_special_space_snapshot_v1('providers','ar'));
select is((select count(*)::integer from queue358 cross join lateral jsonb_array_elements(v->'rows')r where k='fr'and r->>'id'='a3581000-0000-4000-8000-000000000001'),1,'main queue includes the Provider without creating reviewer membership');
select is((select r->>'title'from queue358 cross join lateral jsonb_array_elements(v->'rows')r where k='fr'and r->>'id'='a3581000-0000-4000-8000-000000000001'),'Prestataire de recette العربية','queue resolves the real organization display name');
select is((select v->'rows'from queue358 where k='fr'),(select v->'rows'from queue358 where k='ar'),'FR and AR preserve organization names and canonical status codes');
select is((select v->>'complete'from queue358 where k='fr'),'true','queue retains the complete snapshot contract');
select ok(not exists(select 1 from queue358 cross join lateral jsonb_array_elements(v->'rows')r where r->>'id'='a3581000-0000-4000-8000-000000000002'),'a Client organization without Provider profile never enters the Provider queue');
select is((select count(*)::integer from public.organizations),0,'purpose-bound name resolution does not broaden organization RLS');
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1(null)$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','null locale fails closed');
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('en')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','unsupported locale fails closed');
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_admin_special_space_snapshot_v1('providers','fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','AAL1 cannot use the main queue');
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','AAL1 cannot bypass through the specialized queue');
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','Provider Owner is not a platform reviewer');
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','Client Owner cannot read the platform Provider queue');
select set_config('request.jwt.claims','{"sub":"a3580000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','foreign actor has no queue authority');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_admin_provider_queue_snapshot_v1('fr')$$,'42501','ADMIN_EXPORT_SCOPE_DENIED','absent user identity fails closed');
reset role;
select ok(not(select prosecdef from pg_proc where oid='public.get_admin_provider_queue_snapshot_v1(text)'::regprocedure),'new queue executes with caller RLS');
select ok(not has_function_privilege('anon','public.get_admin_provider_queue_snapshot_v1(text)','EXECUTE'),'anonymous role has no new API execution grant');
select ok(not has_function_privilege('service_role','public.get_admin_provider_queue_snapshot_v1(text)','EXECUTE'),'worker cannot bypass the reviewer queue');
select *from finish();
rollback;
